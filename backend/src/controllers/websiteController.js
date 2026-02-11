const Website = require("../models/website.js");
const { interpretWebsite } = require("../services/websiteInterpreter.js");
const { evaluateWebsite } = require("../services/websiteServices.js");

exports.analyzeWebsite = async (req, res, next) => {
  try {
    let { url } = req.body;

    if (!url) {
      return res
        .status(400)
        .json({ success: false, error: "Website URL is required" });
    }

    let evaluation = await evaluateWebsite(url);
    let interpretation = interpretWebsite(evaluation);
    let website = await Website.findOneAndUpdate(
      { url: evaluation.url },
      {
        $set: {
          ...evaluation,
          state: interpretation.state,
          reasons: interpretation.reasons,
          confidence: interpretation.confidence,
          lastCheckedAt: new Date(),
        },
        $unset: { signals: "", hasWebsite: "" },
      },
      { upsert: true, new: true },
    );

    let responseData = {
      url: website.url,
      state: website.state,
      reasons: website.reasons,
      confidence: website.confidence,
      signals: {
        reachability: website.reachability,
        ssl: website.ssl,
        mobileFriendly: website.mobileFriendly,
        speed: website.speed,
      },
      lastCheckedAt: website.lastCheckedAt,
    };

    res.json({ success: true, data: responseData });
  } catch (error) {
    next(error);
  }
};

exports.getAllWebsites = async (req, res, next) => {
  try {
    let websites = await Website.find().sort({ lastCheckedAt: -1 });
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
