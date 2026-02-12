function interpretWebsite(data) {
  const technicalFindings = [];
  const status = data.reachability.httpStatus;
  const rawStatusText = data.reachability.statusText || "";
  const statusText = String(rawStatusText).toUpperCase();

  // --- 1. DNS Failure ---
  if (!data.websiteExists) {
    technicalFindings.push({
      type: "dns_resolution_failed",
      severity: "critical",
      message: "Domain could not be resolved."
    });
  }

  // --- 2. Network Timeout / Connection Failure ---
  else if (!data.reachability.isReachable) {
    if (statusText.includes("TIMEOUT")) {
      technicalFindings.push({
        type: "timeout",
        severity: "critical",
        message: "Server did not respond in time."
      });
    } else {
      technicalFindings.push({
        type: "unreachable",
        severity: "critical",
        message: "Website unreachable (Network Error)."
      });
    }
  }

  // --- 3. HTTP Response Received (Status Code Checks) ---
  else if (status >= 500) {
    technicalFindings.push({
      type: "server_error",
      severity: "critical",
      message: "Server returned HTTP 5xx error."
    });
  }
  else if (status >= 400 && status < 500) {
    technicalFindings.push({
      type: "client_error",
      severity: "major",
      message: "Website returned HTTP 4xx error."
    });
  }

  // --- 4. Normal Checks (200 OK, or possibly 4xx if we want to check SSL anyway) ---
  if (data.websiteExists && data.reachability.isReachable && (status < 500 || status == null)) {

    // Check: SSL (Major)
    if (!data.ssl.hasSSL) {
      technicalFindings.push({
        type: "no_ssl",
        severity: "major",
        message: "SSL certificate not detected."
      });
    }

    // Check: Speed (Major)
    if (data.speed.classification === "slow") {
      technicalFindings.push({
        type: "slow_performance",
        severity: "major",
        message: "Server response time is slow."
      });
    }

    // Check: Mobile Friendly (Minor)
    if (!data.mobileFriendly.isMobileFriendly) {
      technicalFindings.push({
        type: "no_viewport_meta",
        severity: "minor",
        message: "Viewport meta tag missing."
      });
    }
  }

  // --- 5. Calculate Stats ---
  const criticalCount = technicalFindings.filter(f => f.severity === "critical").length;
  const majorCount = technicalFindings.filter(f => f.severity === "major").length;
  const minorCount = technicalFindings.filter(f => f.severity === "minor").length;
  const issueCount = criticalCount + majorCount + minorCount;

  // --- 6. Determine State ---
  let state = "good";

  // Priority 1: Critical / DNS Issues
  if (criticalCount > 0) {
    if (technicalFindings.some(f => f.type === "dns_resolution_failed")) {
      state = "no_website";
    } else {
      state = "critical";
    }
  }
  // Priority 2: 4xx Expectation ("needs_attention")
  else if (technicalFindings.some(f => f.type === "client_error")) {
    state = "needs_attention";
  }
  // Priority 3: Multiple Majors
  else if (majorCount >= 2) {
    state = "needs_attention";
  }
  // Priority 4: Single Major (Note: 4xx handled above, so this is No SSL or Slow)
  else if (majorCount === 1) {
    state = "acceptable";
  }
  // Priority 5: Multiple Minors
  else if (minorCount >= 2) {
    state = "acceptable";
  }
  else {
    state = "good";
  }

  // --- 7. Determine Confidence (Refined) ---
  let confidence = "medium";

  if (state === "good" && issueCount === 0) {
    confidence = "high";
  } else if (state === "no_website") {
    confidence = "high";
  } else if (technicalFindings.some(f => f.type === "server_error")) {
    confidence = "high";
  } else if (technicalFindings.some(f => f.type === "client_error")) {
    confidence = "high";
  } else if (majorCount >= 2) {
    confidence = "high";
  } else {
    confidence = "medium";
  }

  return { technicalFindings, issueCount, state, confidence, reasons: [] };
}

module.exports = { interpretWebsite };
