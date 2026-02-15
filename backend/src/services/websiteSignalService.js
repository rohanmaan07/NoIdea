const axios = require("axios");
const cheerio = require("cheerio");
const dns = require("dns").promises;
const https = require("https");

async function checkReachability(url) {
    let isReachable = false;
    let httpStatus = null;
    let statusText = null;
    let dnsResolved = false;
    let responseTimeMs = null;
    let html = null;

    // 1. DNS Check
    try {
        const hostname = new URL(url).hostname;
        await dns.lookup(hostname);
        dnsResolved = true;
    } catch (err) {
        if (err.code === "ENOTFOUND") {
            return {
                isReachable: false,
                httpStatus: null,
                statusText: "DNS_RESOLUTION_FAILED",
                dnsResolved: false,
                responseTimeMs: null,
                html: null,
            };
        }
        return {
            isReachable: false,
            httpStatus: null,
            statusText: "DNS_RESOLUTION_FAILED",
            dnsResolved: false,
            responseTimeMs: null,
            html: null,
        };
    }

    // 2. HTTP Request
    try {
        const start = Date.now();
        const res = await axios.get(url, {
            timeout: 5000,
            maxRedirects: 5,
            headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0" },
            httpsAgent: new https.Agent({ rejectUnauthorized: false }),
            validateStatus: () => true,
        });

        responseTimeMs = Date.now() - start;
        httpStatus = res.status;
        statusText = res.statusText || String(res.status);
        isReachable = true;

        const contentType = res.headers['content-type'] || "";
        if (contentType.includes('text/html') || contentType.includes('application/xhtml+xml')) {
            if (typeof res.data === "string") {
                html = res.data;
            }
        }
    } catch (err) {
        if (err.code === "ECONNABORTED" || err.message.includes("timeout")) {
            statusText = "TIMEOUT";
        } else {
            statusText = err.code || err.message;
        }
        isReachable = false;
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

function extractViewportSignal($) {
    if (!$) {
        return {
            hasViewportMeta: false,
            viewportContent: null,
        };
    }

    let viewport = $('meta[name="viewport"]');
    if (viewport.length === 0) {
        viewport = $('meta').filter((i, el) => {
            const name = $(el).attr('name');
            return name && name.toLowerCase() === 'viewport';
        });
    }

    const hasViewportMeta = viewport.length > 0;
    const viewportContent = hasViewportMeta ? viewport.attr("content") : null;

    return {
        hasViewportMeta,
        viewportContent
    };
}

async function collectWebsiteSignals(inputUrl) {
    let url = inputUrl.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = "https://" + url;
    }

    let reach = await checkReachability(url);

    // HTTP Fallback Logic
    if (!reach.isReachable && reach.dnsResolved && url.startsWith("https://")) {
        console.log("HTTPS failed, trying HTTP fallback...");
        const httpUrl = url.replace("https://", "http://");
        const httpTry = await checkReachability(httpUrl);
        if (httpTry.isReachable) {
            reach = httpTry;
            url = httpUrl;
        }
    }

    const websiteExists = reach.dnsResolved;
    let speedClassification = "unknown";
    if (typeof reach.responseTimeMs === "number") {
        if (reach.responseTimeMs < 1000) {
            speedClassification = "fast";
        } else if (reach.responseTimeMs < 3000) {
            speedClassification = "acceptable";
        } else {
            speedClassification = "slow";
        }
    }
    const signals = {
        url,
        websiteExists,
        reachability: {
            isReachable: reach.isReachable,
            httpStatus: reach.httpStatus,
            statusText: reach.statusText,
            dnsResolved: reach.dnsResolved,
            responseTimeMs: reach.responseTimeMs,
        },
        ssl: {
            hasSSL: url.startsWith("https://"),
        },
        viewport: {
            hasViewportMeta: false,
            viewportContent: null,
        },
        speed: {
            classification: speedClassification
        },
        mobileFriendly: {
            hasViewportMeta: false,
            isMobileFriendly: false,
            viewportContent: null
        }
    };

    if (reach.isReachable && reach.html) {
        try {
            const $ = cheerio.load(reach.html);
            const viewportData = extractViewportSignal($);
            signals.viewport = viewportData;


            let isMobileFriendly = false;
            if (viewportData.hasViewportMeta && viewportData.viewportContent) {
                const lower = viewportData.viewportContent.toLowerCase();
                isMobileFriendly = lower.includes("width=device-width") && lower.includes("initial-scale");
            }

            signals.mobileFriendly = {
                hasViewportMeta: viewportData.hasViewportMeta,
                isMobileFriendly: isMobileFriendly,
                viewportContent: viewportData.viewportContent
            };
        } catch (e) {
            console.error("Cheerio load failed", e);
        }
    }

    return signals;
}

module.exports = { collectWebsiteSignals };
