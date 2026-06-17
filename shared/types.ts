export type ConversionStatus = "pending" | "processing" | "done" | "error";

export type SupportedFormat = "pdf" | "docx" | "pptx" | "xlsx" | "jpg" | "png" | "zip";

export interface ConversionJob {
  id: string;
  status: ConversionStatus;
  inputFile: string;
  outputFile: string;
  createdAt: string;
  error?: string;
}

export interface ConversionResponse {
  jobId: string;
  downloadUrl: string;
  filename: string;
  size: number;
}

export interface ConversionErrorResponse {
  error: string;
  code: string;
}

export interface ConversionLogEntry {
  timestamp: string;
  inputFormat: string;
  outputFormat: string;
  fileSize: number;
  durationMs: number;
  success: boolean;
  error?: string;
}

export interface ConversionResult {
  fileName: string;
  targetFormat: SupportedFormat;
  status: 'success' | 'error';
  jobId?: string;
  downloadUrl?: string;
  outputFilename?: string;
  outputSize?: number;
  error?: string;
}
