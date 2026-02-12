const mongoose = require("mongoose");
const WebsiteSchema = new mongoose.Schema({
  url: { type: String, required: true, unique: true },
  websiteExists: { type: Boolean, default: false },
  reachability: {
    isReachable: Boolean,
    httpStatus: Number,
    statusText: String,
    dnsResolved: Boolean,
    responseTimeMs: Number,
  },
  ssl: {
    hasSSL: Boolean,
    browserWarningRisk: Boolean,
  },
  mobileFriendly: {
    hasViewportMeta: Boolean,
    isMobileFriendly: Boolean,
    viewportContent: String,
  },
  speed: {
    classification: {
      type: String,
      enum: ["slow", "acceptable", "fast", "unknown"],
      default: "unknown",
    },
  },
  state: {
    type: String,
    enum: [
      "unknown",
      "no_website",
      "critical",
      "needs_attention",
      "acceptable",
      "good",
    ],
    default: "unknown",
  },
  reasons: [String],

  technicalFindings: [String],

  impactSummary: [String],

  riskLevel: {
    type: String,
    enum: ["low", "medium", "high"],
    default: "low",
  },


  confidence: {
    type: String,
    enum: ["low", "medium", "high"],
  },

  analyzedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Website", WebsiteSchema);
