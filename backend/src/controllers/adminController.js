const { websiteAnalysisQueue } = require("../queues/websiteAnalysisQueue.js");
const AnalysisStats = require("../models/AnalysisStats.js");

// GET /admin/queue-stats
// Real-time BullMQ queue visibility
exports.getQueueStats = async (req, res, next) => {
  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      websiteAnalysisQueue.getWaitingCount(),
      websiteAnalysisQueue.getActiveCount(),
      websiteAnalysisQueue.getCompletedCount(),
      websiteAnalysisQueue.getFailedCount(),
      websiteAnalysisQueue.getDelayedCount(),
    ]);

    return res.json({
      waiting,
      active,
      completed,
      failed,
      delayed,
    });
  } catch (error) {
    console.error("Error fetching queue stats:", error.message);
    next(error);
  }
};

// GET /admin/analysis-stats
// Historical analysis metrics from DB (singleton doc)
exports.getAnalysisStats = async (req, res, next) => {
  try {
    let stats = await AnalysisStats.findOne();

    if (!stats) {
      stats = {
        totalJobs: 0,
        successfulJobs: 0,
        failedJobs: 0,
        avgAnalysisTime: 0,
        lastUpdated: null,
      };
    }

    const successRate =
      stats.totalJobs > 0
        ? ((stats.successfulJobs / stats.totalJobs) * 100).toFixed(2)
        : 0;

    return res.json({
      totalJobs: stats.totalJobs,
      successfulJobs: stats.successfulJobs,
      failedJobs: stats.failedJobs,
      avgAnalysisTime: stats.avgAnalysisTime,
      successRate: `${successRate}%`,
      lastUpdated: stats.lastUpdated,
    });
  } catch (error) {
    console.error("Error fetching analysis stats:", error.message);
    next(error);
  }
};
