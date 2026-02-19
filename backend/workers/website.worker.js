require("dotenv").config();
const { Worker } = require("bullmq");
const { getRedisConnection } = require("../src/config/redis.js");
const connectDB = require("../src/config/db.js");
const Website = require("../src/models/website.js");
const AnalysisStats = require("../src/models/AnalysisStats.js");
const { collectWebsiteSignals } = require("../src/services/websiteSignalService.js");
const { interpretWebsite } = require("../src/services/websiteInterpreter.js");
const { generateImpact } = require("../src/services/websiteImpactService.js");
const logger = require("../src/utils/logger.js");

console.log(" Starting Website Analysis Worker...");

// Database connection
connectDB();
const redis = getRedisConnection();
redis.set("worker:node:health", "true").catch(console.error);


const processAnalysisJob = async (job) => {
    const startTime = Date.now();
    const { url } = job.data;

    try {
        console.log(`\n Processing job ${job.id} for URL: ${url}`);
        logger.analyzeStart(url);

        // Step 1: Check for existing website and cooldown
        const existingWebsite = await Website.findOne({ url });

        // Idempotency: If this job already ran successfully, skip re-processing
        if (existingWebsite && existingWebsite.lastJobId === job.id) {
            console.log(`⚠️ Job ${job.id} already processed. Skipping to avoid duplicates.`);
            return {
                url: existingWebsite.url,
                state: existingWebsite.state,
                riskLevel: existingWebsite.riskLevel,
                technicalFindings: existingWebsite.technicalFindings,
                impactSummary: existingWebsite.impactSummary,
                confidence: existingWebsite.confidence,
                analyzedAt: existingWebsite.analyzedAt,
                analysisCount: existingWebsite.analysisCount,
                fromCache: true, // Treat as cache hit to avoid stats increment
                analysisTimeMs: 0,
            };
        }

        if (existingWebsite && existingWebsite.analyzedAt) {
            const now = new Date();
            const timeDiffMs = now - existingWebsite.analyzedAt;
            const cooldownMs = 10 * 60 * 1000; // 10 minutes

            if (timeDiffMs < cooldownMs) {
                const analysisTimeMs = Date.now() - startTime;
                logger.analyzeComplete(url, existingWebsite.state, analysisTimeMs, true);

                console.log(` Job ${job.id} completed (from cache) in ${analysisTimeMs}ms`);


                return {
                    url: existingWebsite.url,
                    state: existingWebsite.state,
                    riskLevel: existingWebsite.riskLevel,
                    technicalFindings: existingWebsite.technicalFindings,
                    impactSummary: existingWebsite.impactSummary,
                    confidence: existingWebsite.confidence,
                    analyzedAt: existingWebsite.analyzedAt,
                    analysisCount: existingWebsite.analysisCount || 0,
                    fromCache: true,
                    analysisTimeMs,
                };
            }
        }


        console.log(` Collecting signals for ${url}...`);
        const signals = await collectWebsiteSignals(url);


        console.log(` Interpreting signals for ${url}...`);
        const interpretation = interpretWebsite(signals);


        console.log(` Generating impact summary for ${url}...`);
        const impactSummary = generateImpact(interpretation.technicalFindings);

        const structuredFindings = interpretation.technicalFindings.map((f) => ({
            type: f.type,
            severity: f.severity,
            message: f.message,
            code: f.code || null,
        }));


        let website;
        const stateChanged =
            !existingWebsite || existingWebsite.state !== interpretation.state;

        if (stateChanged) {
            console.log(`💾 Saving new/updated analysis for ${url}...`);
            website = await Website.findOneAndUpdate(
                { url: signals.url },
                {
                    $set: {
                        url: signals.url,
                        websiteExists: signals.websiteExists,
                        reachability: signals.reachability,
                        ssl: signals.ssl,
                        mobileFriendly: signals.mobileFriendly,
                        speed: signals.speed,
                        rawSignals: {
                            reachability: signals.reachability,
                            ssl: signals.ssl,
                            viewport: signals.viewport,
                            speed: signals.speed,
                            mobileFriendly: signals.mobileFriendly,
                        },
                        technicalFindings: structuredFindings,
                        impactSummary: impactSummary,
                        state: interpretation.state,
                        riskLevel: interpretation.riskLevel,
                        confidence: interpretation.confidence,
                        analyzedAt: new Date(),
                        lastJobId: job.id,
                    },
                    $inc: { analysisCount: 1 },
                    $unset: { reasons: "" },
                },
                { upsert: true, new: true }
            );
        } else {
            console.log(` Updating timestamp for ${url}...`);
            website = await Website.findOneAndUpdate(
                { url: signals.url },
                {
                    $set: {
                        analyzedAt: new Date(),
                        lastJobId: job.id,
                    },
                    $inc: { analysisCount: 1 },
                },
                { new: true }
            );
        }


        const analysisTimeMs = Date.now() - startTime;
        logger.analyzeComplete(url, website.state, analysisTimeMs, false);

        console.log(` Job ${job.id} completed successfully in ${analysisTimeMs}ms`);


        return {
            url: website.url,
            state: website.state,
            riskLevel: website.riskLevel,
            technicalFindings: website.technicalFindings,
            impactSummary: website.impactSummary,
            confidence: website.confidence,
            analyzedAt: website.analyzedAt,
            analysisCount: website.analysisCount || 0,
            fromCache: false,
            analysisTimeMs,
        };
    } catch (error) {
        const analysisTimeMs = Date.now() - startTime;
        logger.analyzeFail(url, error, analysisTimeMs);

        console.error(`❌ Job ${job.id} failed after ${analysisTimeMs}ms:`, error.message);

        throw error;
    }
};


const websiteAnalysisWorker = new Worker(
    "website-analysis",
    processAnalysisJob,
    {
        connection: getRedisConnection(),
        concurrency: 5,
        limiter: {
            max: 10,
            duration: 1000,
        },
    }
);

websiteAnalysisWorker.on("completed", async (job, result) => {
    console.log(` Job ${job.id} completed successfully`);
    console.log(`   URL: ${result.url}`);
    console.log(`   State: ${result.state}`);
    console.log(`   Risk Level: ${result.riskLevel}`);
    console.log(`   Time: ${result.analysisTimeMs}ms`);

    // Cache hits ko stats mein count nahi karte — real analysis hi count hogi
    if (result.fromCache) {
        console.log(`   Skipping stats update (served from cache)`);
        return;
    }

    try {
        // Pehle current stats fetch karo
        const currentStats = await AnalysisStats.findOne();
        const oldAvg = currentStats ? currentStats.avgAnalysisTime : 0;
        const oldSuccessful = currentStats ? currentStats.successfulJobs : 0;

        // Rolling average formula: newAvg = ((oldAvg * (n-1)) + currentTime) / n
        const n = oldSuccessful + 1; // n = new successfulJobs count
        const newAvg = ((oldAvg * (n - 1)) + result.analysisTimeMs) / n;

        await AnalysisStats.findOneAndUpdate(
            {},
            {
                $inc: {
                    totalJobs: 1,
                    successfulJobs: 1,
                },
                $set: {
                    avgAnalysisTime: Math.round(newAvg),
                    lastUpdated: new Date(),
                },
            },
            { upsert: true, new: true }
        );

        console.log(`   Stats updated — avgTime: ${Math.round(newAvg)}ms, total successful: ${n}`);
    } catch (statsError) {
        console.error(`   Failed to update AnalysisStats:`, statsError.message);
    }
});

websiteAnalysisWorker.on("failed", async (job, err) => {
    console.error(` Job ${job.id} failed:`, err.message);
    console.error(`   Attempts: ${job.attemptsMade}/${job.opts.attempts}`);
    try {
        const url = job.data.url;

        await Website.findOneAndUpdate(
            { url },
            {
                $set: {
                    lastFailureReason: err.message || "Unknown error",
                    lastFailureAt: new Date(),
                    permanentFailure: job.attemptsMade >= job.opts.attempts, // Mark permanent only on last try
                }
            },
            { upsert: false } // Don't create if doesn't exist
        );


        console.log(` Failure info stored in DB for ${url}`);
    } catch (dbError) {
        console.error(` Failed to store failure info in DB:`, dbError.message);
    }

    // AnalysisStats sirf FINAL retry ke baad update karo
    // (BullMQ failed event har retry pe fire hota hai)
    const isFinalAttempt = job.attemptsMade >= job.opts.attempts;
    if (isFinalAttempt) {
        try {
            await AnalysisStats.findOneAndUpdate(
                {},
                {
                    $inc: {
                        totalJobs: 1,
                        failedJobs: 1,
                    },
                    $set: {
                        lastUpdated: new Date(),
                    },
                },
                { upsert: true, new: true }
            );
            console.log(` AnalysisStats updated — failedJobs incremented (final attempt)`);
        } catch (statsError) {
            console.error(` Failed to update AnalysisStats on failure:`, statsError.message);
        }
    }
});

websiteAnalysisWorker.on("error", (err) => {
    console.error(" Worker error:", err);
    redis.set("worker:node:health", "false").catch(console.error);
});


websiteAnalysisWorker.on("active", (job) => {
    console.log(` Job ${job.id} is now active`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
    console.log("\n⏸  SIGTERM received, closing worker gracefully...");
    await redis.set("worker:node:health", "false");
    await websiteAnalysisWorker.close();
    process.exit(0);
});


process.on("SIGINT", async () => {
    console.log("\n⏸  SIGINT received, closing worker gracefully...");
    await redis.set("worker:node:health", "false");
    await websiteAnalysisWorker.close();
    process.exit(0);
});


console.log(" Website Analysis Worker is running and listening for jobs...");
console.log(" Queue: website-analysis");
console.log("  Concurrency: 5 jobs");
console.log(" Rate Limit: 10 jobs/second");
console.log(" Retry Strategy: 3 attempts with exponential backoff\n");
