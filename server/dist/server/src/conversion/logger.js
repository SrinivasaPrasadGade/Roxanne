"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logConversion = logConversion;
/**
 * Logs every conversion attempt as structured JSON to stdout.
 *
 * In production this could be piped to a log aggregator (Datadog, ELK, etc.)
 * but structured JSON to stdout is the twelve-factor-app best practice.
 */
function logConversion(entry) {
    const logLine = JSON.stringify({
        level: entry.success ? 'info' : 'error',
        event: 'conversion',
        ...entry,
    });
    console.log(logLine);
}
