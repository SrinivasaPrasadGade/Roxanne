import type { ConversionLogEntry } from '../../../shared/types';

/**
 * Logs every conversion attempt as structured JSON to stdout.
 *
 * In production this could be piped to a log aggregator (Datadog, ELK, etc.)
 * but structured JSON to stdout is the twelve-factor-app best practice.
 */
export function logConversion(entry: ConversionLogEntry): void {
  const logLine = JSON.stringify({
    level: entry.success ? 'info' : 'error',
    event: 'conversion',
    ...entry,
  });
  console.log(logLine);
}
