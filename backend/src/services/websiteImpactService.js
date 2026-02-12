const IMPACT_MAPPINGS = {
    dns_resolution_failed: "Customers cannot access your website because the domain is not reachable.",
    timeout: "Customers cannot load your site because the server is taking too long to respond.",
    unreachable: "Your website is not responding, which prevents customers from visiting your site.",
    server_error: "The server is failing to process requests, preventing users from accessing your site.",
    client_error: "Visitors may see an error page instead of your intended content.",
    no_ssl: "Browsers may show security warnings, which can reduce user trust.",
    slow_performance: "Slow loading times may cause visitors to leave before interacting.",
    no_viewport_meta: "Mobile users may experience layout issues requiring zoom and manual adjustment."
};

const DEFAULT_IMPACT = "This technical issue may affect user experience or site accessibility.";


function generateImpact(technicalFindings) {
    if (!Array.isArray(technicalFindings)) return [];

    return technicalFindings.map(finding => {
        return IMPACT_MAPPINGS[finding.type] || DEFAULT_IMPACT;
    });
}

module.exports = { generateImpact };
