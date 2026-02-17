const { websiteAnalysisQueue } = require("../queues/websiteAnalysisQueue.js");
const Website = require("../models/website.js");

//  NEW FLOW: Just enqueue job and return immediately
exports.analyzeWebsite = async (req, res, next) => {
  try {
    const { url: inputUrl } = req.body;

    //  Step 1: Validate URL
    if (!inputUrl) {
      return res
        .status(400)
        .json({ success: false, error: "Website URL is required" });
    }

    let url = inputUrl.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }

    //  Step 2: Prepare minimal job payload
    const jobData = {
      url,
      requestedAt: new Date().toISOString(),
      requesterIP: req.ip || req.connection.remoteAddress || "unknown",
    };

    //  Step 3: Add job to queue
    const job = await websiteAnalysisQueue.add("analyze-website", jobData, {
      jobId: `analysis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    });

    //  Step 4: Return immediately with jobId
    return res.json({
      success: true,
      jobId: job.id,
      status: "queued",
      message: "Website analysis job queued successfully",
    });
  } catch (error) {
    console.error("Error enqueueing analysis job:", error.message);
    next(error);
  }
};

//Get Job Status - TASK 4
// TODO: Add auth middleware - currently anyone with jobId can view results
exports.getJobStatus = async (req, res, next) => {
  try {
    const { jobId } = req.params;

    //  Step 1: Fetch job from queue
    const job = await websiteAnalysisQueue.getJob(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Job not found. It may have expired or been cleaned up.",
      });
    }

    //  Step 2: Get job state from BullMQ
    const state = await job.getState();

    //  Step 3: Map BullMQ states to clean response
    let status;
    let responseData = {
      jobId: job.id,
      url: job.data.url,
      requestedAt: job.data.requestedAt,
    };

    switch (state) {
      case "waiting":
      case "delayed":
        status = "queued";
        responseData.status = status;
        responseData.message = "Job is waiting in queue";
        break;

      case "active":
        status = "processing";
        responseData.status = status;
        responseData.message = "Job is being processed";
        responseData.progress = job.progress || 0;
        break;

      case "completed":
        status = "completed";

        //  Step 4: Fetch result from DB by jobId (not URL - prevents race conditions)
        const website = await Website.findOne({ lastJobId: jobId });

        if (website) {
          responseData.status = status;
          responseData.message = "Analysis completed successfully";
          responseData.result = {
            url: website.url,
            state: website.state,
            riskLevel: website.riskLevel,
            technicalFindings: website.technicalFindings,
            impactSummary: website.impactSummary,
            confidence: website.confidence,
            analyzedAt: website.analyzedAt,
            analysisCount: website.analysisCount,
          };

          // Also include job return value if available
          const jobResult = job.returnvalue;
          if (jobResult) {
            responseData.analysisTimeMs = jobResult.analysisTimeMs;
            responseData.fromCache = jobResult.fromCache;
          }
        } else {
          // Fallback to job return value
          responseData.status = status;
          responseData.message = "Analysis completed";
          responseData.result = job.returnvalue;
        }
        break;

      case "failed":
        status = "failed";
        responseData.status = status;
        responseData.message = "Job failed after maximum retry attempts";
        responseData.error = {
          message: job.failedReason || "Unknown error",
          attempts: job.attemptsMade,
          maxAttempts: job.opts.attempts,
          failedAt: job.finishedOn ? new Date(job.finishedOn) : null,
        };

        // Try to fetch failure info from DB if available
       
        const failedWebsite = await Website.findOne({ url: job.data.url });
        if (failedWebsite && failedWebsite.lastFailureReason) {
          responseData.error.lastFailureReason = failedWebsite.lastFailureReason;
          responseData.error.lastFailureAt = failedWebsite.lastFailureAt;
        }
        break;

      default:
        status = "unknown";
        responseData.status = status;
        responseData.message = `Job is in ${state} state`;
    }

    return res.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error("Error fetching job status:", error.message);
    next(error);
  }
};

exports.getAllWebsites = async (req, res, next) => {
  try {
    let websites = await Website.find().sort({ analyzedAt: -1 });
    res.json({ success: true, count: websites.length, data: websites });
  } catch (error) {
    next(error);
  }
};
exports.getWebsite = async (req, res, next) => {
  try {
    let website = await Website.findById(req.params.id);

    if (!website) {
      return res
        .status(404)
        .json({ success: false, error: "Website not found" });
    }

    res.json({ success: true, data: website });
  } catch (error) {
    next(error);
  }
};
