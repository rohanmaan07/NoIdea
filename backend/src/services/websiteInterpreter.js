function interpretWebsite(data) {
  let reasons = [];
  let state = "good";
  let confidence = "medium";

  if (!data.websiteExists) {
    return {
      state: "no_website",
      reasons: ["No website detected for this domain."],
      confidence: "high",
    };
  }

  if (!data.reachability.isReachable) {
    return {
      state: "critical",
      reasons: ["Website is not reachable."],
      confidence: "high",
    };
  }

  if (!data.ssl.hasSSL) {
    reasons.push("Website does not use HTTPS which may reduce trust.");
  }

  if (data.speed.classification === "slow") {
    reasons.push("Server response time appears slow.");
  }

  if (!data.mobileFriendly.isMobileFriendly) {
    reasons.push("Website may not be optimized for mobile devices.");
  }

  if (reasons.length === 0) {
    return { state: "good", reasons: [], confidence: "high" };
  }

  state = reasons.length === 1 ? "acceptable" : "needs_attention";

  return { state, reasons, confidence };
}

module.exports = { interpretWebsite };
