const { Queue } = require("bullmq");
const { getRedisConnection } = require("../config/redis.js");

const websiteAnalysisQueue = new Queue("website-analysis", {
    connection: getRedisConnection(),
    defaultJobOptions: {
        attempts: 3, 
        backoff: {
            type: "exponential",
            delay: 2000, 
        },
        removeOnComplete: false, 
        removeOnFail: false, 
    },
});

websiteAnalysisQueue.on("error", (err) => {
    console.error(" Queue error:", err);
});

console.log(" Website Analysis Queue initialized");

module.exports = { websiteAnalysisQueue };
