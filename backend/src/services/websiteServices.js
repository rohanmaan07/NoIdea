const axios = require("axios");
const cheerio = require("cheerio");
const dns = require("dns").promises;
const https = require("https");

// Website reachable hai ya nahi + HTML fetch
async function checkReachability(url) {
  let isReachable = false;
  let httpStatus = null;
  let statusText = null;
  let dnsResolved = false;
  let responseTimeMs = null;
  let html = null;

  // Pehle DNS check - domain exist karta hai ya nahi
  try {
    const hostname = new URL(url).hostname;
    await dns.lookup(hostname);
    dnsResolved = true;
  } catch (err) {
    return {
      isReachable,
      httpStatus,
      statusText: "DNS_FAILED",
      dnsResolved,
      responseTimeMs,
      html,
    };
  }

  try {
    const start = Date.now();
    const res = await axios.get(url, {
      timeout: 15000,
      maxRedirects: 5,
      headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0" },
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      validateStatus: () => true,
    });

    responseTimeMs = Date.now() - start;
    httpStatus = res.status;
    statusText = String(res.status);
    isReachable = res.status >= 200 && res.status < 400;

    if (typeof res.data === "string") {
      html = res.data;
    }
  } catch (err) {
    statusText = err.code || err.message;
  }

  return {
    isReachable,
    httpStatus,
    statusText,
    dnsResolved,
    responseTimeMs,
    html,
  };
}

function checkMobileFriendly($) {
  if (!$) {
    return {
      hasViewportMeta: false,
      isMobileFriendly: false,
      viewportContent: null,
    };
  }

  const viewport = $('meta[name="viewport"]');
  const hasViewportMeta = viewport.length > 0;
  const viewportContent = hasViewportMeta ? viewport.attr("content") : null;

  let isMobileFriendly = false;
  if (hasViewportMeta && viewportContent) {
    const lower = viewportContent.toLowerCase();
    if (
      lower.includes("width=device-width") &&
      lower.includes("initial-scale")
    ) {
      isMobileFriendly = true;
    }
  }

  return { hasViewportMeta, isMobileFriendly, viewportContent };
}

function checkSpeed(responseTimeMs) {
  let classification = "unknown";

  if (typeof responseTimeMs === "number") {
    if (responseTimeMs < 1000) {
      classification = "fast";
    } else if (responseTimeMs < 3000) {
      classification = "acceptable";
    } else {
      classification = "slow";
    }
  }

  return { classification };
}
// function decideOverallState(data) {
//   if (!data.websiteExists) return "no_website";
//   if (!data.reachability.isReachable) return "critical";

//   let issues = 0;

//   if (!data.ssl.hasSSL) issues++;
//   if (!data.mobileFriendly.isMobileFriendly) issues++;
//   if (data.speed.classification === "slow") issues++;

//   if (issues === 0) return "good";
//   if (issues === 1) return "acceptable";
//   return "needs_attention";
// }

async function evaluateWebsite(inputUrl) {
  let url = inputUrl.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }
  let reach = await checkReachability(url);
  if (!reach.isReachable && reach.dnsResolved && url.startsWith("https://")) {
    url = url.replace("https://", "http://");
    let httpTry = await checkReachability(url);
    if (httpTry.isReachable) {
      reach = httpTry;
    }
  }

  let websiteExists = reach.dnsResolved;
  if (!reach.isReachable) {
    return {
      url,
      websiteExists,
      reachability: {
        isReachable: false,
        httpStatus: reach.httpStatus,
        statusText: reach.statusText,
        dnsResolved: reach.dnsResolved,
        responseTimeMs: reach.responseTimeMs,
      },
      ssl: {
        hasSSL: url.startsWith("https://"),
        browserWarningRisk: !url.startsWith("https://"),
      },
      mobileFriendly: {
        hasViewportMeta: false,
        isMobileFriendly: false,
        viewportContent: null,
      },
      speed: { classification: "unknown" },
      state: websiteExists ? "critical" : "no_website",
    };
  }
  let $ = null;
  if (reach.html) {
    $ = cheerio.load(reach.html);
  }
  let ssl = {
    hasSSL: url.startsWith("https://"),
    browserWarningRisk: !url.startsWith("https://"),
  };

  let mobileFriendly = checkMobileFriendly($);
  let speed = checkSpeed(reach.responseTimeMs);
  
  // let state = decideOverallState({
  //   websiteExists: true,
  //   reachability: reach,
  //   ssl,
  //   mobileFriendly,
  //   speed,
  // });

  return {
    url,
    websiteExists: true,
    reachability: {
      isReachable: reach.isReachable,
      httpStatus: reach.httpStatus,
      statusText: reach.statusText,
      dnsResolved: reach.dnsResolved,
      responseTimeMs: reach.responseTimeMs,
    },
    ssl,
    mobileFriendly,
    speed,
    // state,
  };
}

module.exports = { evaluateWebsite };
