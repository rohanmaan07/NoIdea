const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

class Logger {
    constructor() {
        this.logFile = path.join(logsDir, 'analysis.log');
    }

    getTimestamp() {
        return new Date().toISOString();
    }
    log(level, event, data = {}) {
        const timestamp = this.getTimestamp();
        const dataStr = Object.entries(data)
            .map(([key, value]) => `${key}=${value}`)
            .join(' ');

        const logEntry = `[${timestamp}] ${level.toUpperCase()} ${event} ${dataStr}\n`;

        fs.appendFile(this.logFile, logEntry, (err) => {
            if (err) console.error('Log write failed:', err);
        });
        console.log(logEntry.trim());
    }
    analyzeStart(url) {
        this.log('info', 'ANALYZE_START', { url });
    }
    analyzeComplete(url, state, timeMs, fromCache = false) {
        this.log('info', 'ANALYZE_COMPLETE', {
            url,
            state,
            time: `${timeMs}ms`,
            cached: fromCache ? 'true' : 'false'
        });
    }
    analyzeFail(url, error, timeMs) {
        this.log('error', 'ANALYZE_FAIL', {
            url,
            error: error.message || error,
            time: `${timeMs}ms`
        });
    }
}

module.exports = new Logger();
