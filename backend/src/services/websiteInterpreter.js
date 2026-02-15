const { evaluateRules } = require("./websiteRuleService");

function interpretWebsite(signals) {
  const technicalFindings = evaluateRules(signals);
  const criticalCount = technicalFindings.filter(f => f.severity === "critical").length;
  const majorCount = technicalFindings.filter(f => f.severity === "major").length;
  const minorCount = technicalFindings.filter(f => f.severity === "minor").length;
  const issueCount = criticalCount + majorCount + minorCount;

  let state = "good";

  if (criticalCount > 0) {
    if (technicalFindings.some(f => f.type === "dns_resolution_failed")) {
      state = "no_website";
    } else {
      state = "critical";
    }
  }
  else if (technicalFindings.some(f => f.type === "client_error")) {
    state = "needs_attention";
  }
  else if (majorCount >= 2) {
    state = "needs_attention";
  }
  else if (majorCount === 1) {
    state = "acceptable";
  }
  else if (minorCount >= 2) {
    state = "acceptable";
  }
  else {
    state = "good";
  }

  let confidence = "medium";

  if (state === "good" && issueCount === 0) {
    confidence = "high";
  } else if (state === "no_website") {
    confidence = "high";
  } else if (technicalFindings.some(f => f.type === "timeout")) {
    confidence = "medium";
  } else if (technicalFindings.some(f => f.type === "server_error")) {
    confidence = "high";
  } else if (technicalFindings.some(f => f.type === "client_error")) {
    confidence = "high";
  } else if (majorCount >= 2) {
    confidence = "high";
  } else {
    confidence = "medium";
  }

  let riskLevel = "low";
  switch (state) {
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

  return {
    technicalFindings,
    issueCount,
    state,
    confidence,
    riskLevel,
    reasons: []
  };
}

module.exports = { interpretWebsite };
