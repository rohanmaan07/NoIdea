const Website = require("../models/website.js");
const { interpretWebsite } = require("../services/websiteInterpreter.js");
const { collectWebsiteSignals } = require("../services/websiteSignalService.js");
const { generateImpact } = require("../services/websiteImpactService.js");
const logger = require("../utils/logger.js");

exports.analyzeWebsite = async (req, res, next) => {
  const startTime = Date.now(); 
  let url = null;

  try {
    const { url: inputUrl } = req.body;

    if (!inputUrl) {
      return res
        .status(400)
        .json({ success: false, error: "Website URL is required" });
    }
    url = inputUrl.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }
    logger.analyzeStart(url);

    const existingWebsite = await Website.findOne({ url });

    if (existingWebsite && existingWebsite.analyzedAt) {
      const now = new Date();
      const timeDiffMs = now - existingWebsite.analyzedAt;
      const cooldownMs = 10 * 60 * 1000; 

      if (timeDiffMs < cooldownMs) {
        const analysisTimeMs = Date.now() - startTime; 
        logger.analyzeComplete(url, existingWebsite.state, analysisTimeMs, true);
        logger.analyzeComplete(url, existingWebsite.state, analysisTimeMs, true);

        const cachedResponse = {
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

        return res.json({ success: true, data: cachedResponse });
      }
    }
    const signals = await collectWebsiteSignals(url);
    const interpretation = interpretWebsite(signals);
    const impactSummary = generateImpact(interpretation.technicalFindings);
    const structuredFindings = interpretation.technicalFindings.map(f => ({
      type: f.type,
      severity: f.severity,
      message: f.message,
      code: f.code || null
    }));

    let website;
    const stateChanged = !existingWebsite || existingWebsite.state !== interpretation.state;

    if (stateChanged) {
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
              mobileFriendly: signals.mobileFriendly
            },
            technicalFindings: structuredFindings,
            impactSummary: impactSummary,
            state: interpretation.state,
            riskLevel: interpretation.riskLevel,
            confidence: interpretation.confidence,
            analyzedAt: new Date(),
          },
          $inc: { analysisCount: 1 },  
          $unset: { reasons: "" },
        },
        { upsert: true, new: true },
      );
    } else {
      website = await Website.findOneAndUpdate(
        { url: signals.url },
        {
          $set: {
            analyzedAt: new Date(),
          },
          $inc: { analysisCount: 1 }, 
        },
        { new: true },
      );
    }

    const analysisTimeMs = Date.now() - startTime; 
    logger.analyzeComplete(url, website.state, analysisTimeMs, false);
    const responseData = {
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

    res.json({ success: true, data: responseData });
  } catch (error) {
    const analysisTimeMs = Date.now() - startTime;

    if (url) {
      logger.analyzeFail(url, error, analysisTimeMs);
    }
    console.error("Error analyzing website:", error.message);
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
