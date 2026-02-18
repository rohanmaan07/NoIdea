const mongoose = require("mongoose");


const AnalysisStatsSchema = new mongoose.Schema({
    totalJobs: {
        type: Number,
        default: 0,
    },
    successfulJobs: {
        type: Number,
        default: 0,
    },
    failedJobs: {
        type: Number,
        default: 0,
    },
    avgAnalysisTime: {
        type: Number,
        default: 0,
    },
    lastUpdated: {
        type: Date,
        default: null,
    },
});

module.exports = mongoose.model("AnalysisStats", AnalysisStatsSchema);
