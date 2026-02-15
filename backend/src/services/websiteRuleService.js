
const RULES = {
    // DNS Rules
    DNS_RESOLUTION_FAILED: {
        check: (signals) => !signals.websiteExists,
        finding: {
            type: "dns_resolution_failed",
            severity: "critical",
            message: "Domain could not be resolved.",
            code: "ERR_DNS_FAIL"
        }
    },

    // Network Rules
    TIMEOUT: {
        check: (signals) => {
            const statusText = String(signals.reachability.statusText || "").toUpperCase();
            return !signals.reachability.isReachable && statusText.includes("TIMEOUT");
        },
        finding: {
            type: "timeout",
            severity: "critical",
            message: "Server did not respond within 5 seconds.",
            code: "ERR_TIMEOUT"
        }
    },

    UNREACHABLE: {
        check: (signals) => {
            const statusText = String(signals.reachability.statusText || "").toUpperCase();
            return !signals.reachability.isReachable && !statusText.includes("TIMEOUT");
        },
        finding: {
            type: "unreachable",
            severity: "critical",
            message: "Website unreachable (Network Error).",
            code: "ERR_UNREACHABLE"
        }
    },


    SERVER_ERROR: {
        check: (signals) => {
            const status = signals.reachability.httpStatus;
            return status >= 500;
        },
        finding: {
            type: "server_error",
            severity: "critical",
            message: "Server returned HTTP 5xx error.",
            code: "ERR_HTTP_5XX"
        }
    },

    CLIENT_ERROR: {
        check: (signals) => {
            const status = signals.reachability.httpStatus;
            return status >= 400 && status < 500;
        },
        finding: {
            type: "client_error",
            severity: "major",
            message: "Website returned HTTP 4xx error.",
            code: "ERR_HTTP_4XX"
        }
    },


    NO_SSL: {
        check: (signals) => {
            if (!signals.websiteExists || !signals.reachability.isReachable) {
                return false;
            }
            const status = signals.reachability.httpStatus;
            if (status >= 500) return false;

            return !signals.ssl.hasSSL;
        },
        finding: {
            type: "no_ssl",
            severity: "major",
            message: "SSL certificate not detected.",
            code: "ERR_NO_SSL"
        }
    },


    SLOW_PERFORMANCE: {
        check: (signals) => {
            if (!signals.websiteExists || !signals.reachability.isReachable) {
                return false;
            }
            const status = signals.reachability.httpStatus;
            if (status >= 500) return false;

            const responseTime = signals.reachability.responseTimeMs;
            return typeof responseTime === "number" && responseTime >= 3000;
        },
        finding: {
            type: "slow_performance",
            severity: "major",
            message: "Server response time is slow.",
            code: "ERR_SLOW_PERF"
        }
    },

    // Viewport Rule
    NO_VIEWPORT_META: {
        check: (signals) => {
            if (!signals.websiteExists || !signals.reachability.isReachable) {
                return false;
            }
            const status = signals.reachability.httpStatus;
            if (status >= 500) return false;

            if (!signals.viewport.hasViewportMeta) {
                return true;
            }
            const content = signals.viewport.viewportContent;
            if (!content) return true;

            const lower = content.toLowerCase();
            const hasMobileSettings =
                lower.includes("width=device-width") &&
                lower.includes("initial-scale");

            return !hasMobileSettings;
        },
        finding: {
            type: "no_viewport_meta",
            severity: "minor",
            message: "Viewport meta tag missing or improperly configured.",
            code: "ERR_NO_VIEWPORT"
        }
    }
};

/**
 * Saare rules ko evaluate karta hai
 * @param {Object} signals - Raw signals from signal service
 * @returns {Array} - Array of findings
 */
function evaluateRules(signals) {
    const findings = [];

    for (const [ruleName, rule] of Object.entries(RULES)) {
        try {
            if (rule.check(signals)) {
                findings.push({ ...rule.finding });
            }
        } catch (error) {
            console.error(`Rule ${ruleName} evaluation failed:`, error.message);
        }
    }

    return findings;
}

module.exports = { evaluateRules, RULES };
