const mongoose = require("mongoose");

const WebsiteSchema = new mongoose.Schema({
  url: { type: String, required: true, unique: true },
  websiteExists: { type: Boolean, default: false },
  rawSignals: {
    reachability: {
      isReachable: Boolean,
      httpStatus: Number,
      statusText: String,
      dnsResolved: Boolean,
      responseTimeMs: Number,
    },
    ssl: {
      hasSSL: Boolean,
    },
    viewport: {
      hasViewportMeta: Boolean,
      viewportContent: String,
    },
    speed: {
      classification: String,
    },
    mobileFriendly: {
      hasViewportMeta: Boolean,
      isMobileFriendly: Boolean,
      viewportContent: String,
    }
  },

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

  technicalFindings: [{
    type: { type: String, required: true },
    severity: { type: String, enum: ["critical", "major", "minor"], required: true },
    message: { type: String, required: true },
    code: { type: String }
  }],


  impactSummary: [String],

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
  riskLevel: {
    type: String,
    enum: ["low", "medium", "high"],
    default: "low",
  },
  confidence: {
    type: String,
    enum: ["low", "medium", "high"],
  },

  analysisCount: { type: Number, default: 0 },

  lastJobId: { type: String },
  lastFailureReason: { type: String },
  lastFailureAt: { type: Date },

  analyzedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Website", WebsiteSchema);
