const Website = require("../models/website.js");
const { interpretWebsite } = require("../services/websiteInterpreter.js");
const { evaluateWebsite } = require("../services/websiteServices.js");
const { generateImpact } = require("../services/websiteImpactService.js");

exports.analyzeWebsite = async (req, res, next) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res
        .status(400)
        .json({ success: false, error: "Website URL is required" });
    }

    // 1. Collect Signals
    const evaluation = await evaluateWebsite(url);

    // 2. Interpret Signals (Technical Layer)
    const interpretation = interpretWebsite(evaluation);
    console.log("DEBUG: Interpretation Result:", JSON.stringify(interpretation, null, 2));

    // 3. Generate Impact (Business Layer)
    const impactSummary = generateImpact(interpretation.technicalFindings);

    // 4. Map State to Risk Level
    let riskLevel = "low";
    if (interpretation.technicalFindings.length === 0 && interpretation.state !== "good") {
      interpretation.state = "good";
    }

    switch (interpretation.state) {
      case "critical":
      case "no_website":
        riskLevel = "high";
        break;
      case "needs_attention":
        riskLevel = "medium";
        break;
      case "acceptable":
      case "good":
      default:
        riskLevel = "low";
        break;
    }

    // 5. Prepare Data for Persistence
    const technicalFindingStrings = interpretation.technicalFindings.map(
      (f) => f.message || "Unknown issue",
    );

    const website = await Website.findOneAndUpdate(
      { url: evaluation.url },
      {
        $set: {
          ...evaluation,
          state: interpretation.state,
          technicalFindings: technicalFindingStrings,
          impactSummary: impactSummary,
          riskLevel: riskLevel,
          confidence: interpretation.confidence,
          analyzedAt: new Date(),
        },
        $unset: { reasons: "", issueCount: "" },
      },
      { upsert: true, new: true },
    );

    // 6. Final Structured Response
    const responseData = {
      url: website.url,
      state: website.state,
      riskLevel: website.riskLevel,
      technicalFindings: website.technicalFindings,
      impactSummary: website.impactSummary,
      confidence: website.confidence,
      analyzedAt: website.analyzedAt,
    };

    res.json({ success: true, data: responseData });
  } catch (error) {
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
