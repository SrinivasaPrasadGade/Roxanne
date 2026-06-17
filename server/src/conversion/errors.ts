/**
 * Custom error classes for the conversion engine.
 *
 * All errors carry a `code` field that maps directly to the
 * JSON error response shape: { error: string, code: string }.
 */

/** Thrown when LibreOffice / an external tool exits with a non-zero code. */
export class ConversionError extends Error {
  public readonly code = 'CONVERSION_FAILED';
  public readonly exitCode: number;
  public readonly stderr: string;

  constructor(message: string, exitCode: number, stderr: string) {
    super(message);
    this.name = 'ConversionError';
    this.exitCode = exitCode;
    this.stderr = stderr;
  }
}

/** Thrown when a conversion exceeds the allowed deadline (default 60 s). */
export class TimeoutError extends Error {
  public readonly code = 'CONVERSION_TIMEOUT';

  constructor(timeoutMs: number) {
    super(`Conversion timed out after ${timeoutMs / 1000} seconds`);
    this.name = 'TimeoutError';
  }
}

/** Thrown when the requested source→target format pair is not supported. */
export class UnsupportedConversionError extends Error {
  public readonly code = 'UNSUPPORTED_CONVERSION';

  constructor(sourceFormat: string, targetFormat: string) {
    super(
      `Conversion from "${sourceFormat}" to "${targetFormat}" is not supported`
    );
    this.name = 'UnsupportedConversionError';
  }
}
