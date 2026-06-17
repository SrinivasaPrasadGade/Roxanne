"use strict";
/**
 * Custom error classes for the conversion engine.
 *
 * All errors carry a `code` field that maps directly to the
 * JSON error response shape: { error: string, code: string }.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnsupportedConversionError = exports.TimeoutError = exports.ConversionError = void 0;
/** Thrown when LibreOffice / an external tool exits with a non-zero code. */
class ConversionError extends Error {
    code = 'CONVERSION_FAILED';
    exitCode;
    stderr;
    constructor(message, exitCode, stderr) {
        super(message);
        this.name = 'ConversionError';
        this.exitCode = exitCode;
        this.stderr = stderr;
    }
}
exports.ConversionError = ConversionError;
/** Thrown when a conversion exceeds the allowed deadline (default 60 s). */
class TimeoutError extends Error {
    code = 'CONVERSION_TIMEOUT';
    constructor(timeoutMs) {
        super(`Conversion timed out after ${timeoutMs / 1000} seconds`);
        this.name = 'TimeoutError';
    }
}
exports.TimeoutError = TimeoutError;
/** Thrown when the requested source→target format pair is not supported. */
class UnsupportedConversionError extends Error {
    code = 'UNSUPPORTED_CONVERSION';
    constructor(sourceFormat, targetFormat) {
        super(`Conversion from "${sourceFormat}" to "${targetFormat}" is not supported`);
        this.name = 'UnsupportedConversionError';
    }
}
exports.UnsupportedConversionError = UnsupportedConversionError;
