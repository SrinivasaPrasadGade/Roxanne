import { Router, Request, Response } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import mime from 'mime-types';
import type {
  SupportedFormat,
  ConversionJob,
  ConversionResponse,
} from '../../../shared/types';
import {
  convertFile,
  logConversion,
  ConversionError,
  TimeoutError,
  UnsupportedConversionError,
} from '../conversion';

// ── Constants ────────────────────────────────────────────────────────────────

const UPLOADS_DIR = '/tmp/uploads';
const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10);

const SUPPORTED_FORMATS: Set<string> = new Set([
  'pdf',
  'docx',
  'pptx',
  'xlsx',
  'jpg',
  'png',
  'zip',
]);

// ── Ensure directories exist ─────────────────────────────────────────────────

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ── In-memory jobs store ─────────────────────────────────────────────────────

interface InternalJob extends ConversionJob {
  outputPath: string;
  originalName: string;
}

const jobsStore = new Map<string, InternalJob>();

// ── Multer configuration ─────────────────────────────────────────────────────

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
});

// ── Rate limiter ─────────────────────────────────────────────────────────────

const convertLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // 10 conversions per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many conversion requests. Please try again later.',
    code: 'RATE_LIMITED',
  },
});

// ── Router ───────────────────────────────────────────────────────────────────

export const convertRouter = Router();

// ── POST /api/convert ────────────────────────────────────────────────────────

convertRouter.post(
  '/api/convert',
  convertLimiter,
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    let inputFormat = '';
    let targetFormat = '';
    let fileSize = 0;

    try {
      // 1. Validate file exists
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded', code: 'MISSING_FILE' });
        return;
      }

      fileSize = req.file.size;
      inputFormat = path
        .extname(req.file.originalname)
        .toLowerCase()
        .replace('.', '');

      // 2. Validate targetFormat
      targetFormat = (req.body.targetFormat || '').toLowerCase().trim();
      if (!targetFormat) {
        res
          .status(400)
          .json({ error: 'Target format is required', code: 'MISSING_FORMAT' });
        return;
      }
      if (!SUPPORTED_FORMATS.has(targetFormat)) {
        res.status(415).json({
          error: `Unsupported target format: "${targetFormat}". Supported: ${[...SUPPORTED_FORMATS].join(', ')}`,
          code: 'UNSUPPORTED_FORMAT',
        });
        return;
      }

      // 3. Convert
      const inputPath = req.file.path;
      const operation = req.body.operation || '';

      let options: any;
      if (req.body.options) {
        try {
          options = JSON.parse(req.body.options);
          console.log('[convert route] parsed options from body.options:', JSON.stringify(options));
        } catch {
          console.log('[convert route] failed to parse body.options:', req.body.options);
          // Ignore parse errors
        }
      } else if (req.body.degrees !== undefined || req.body.pages !== undefined) {
        options = {
          degrees: req.body.degrees ? parseInt(req.body.degrees, 10) : undefined,
          pages: req.body.pages,
        };
      }
      console.log('[convert route] operation:', operation, 'final options:', JSON.stringify(options));

      const outputPath = await convertFile(
        inputPath,
        targetFormat as SupportedFormat,
        operation,
        options
      );

      // 4. Build job record
      const jobId = uuidv4();
      const outputFilename = path.basename(outputPath);
      const outputStats = fs.statSync(outputPath);

      const job: InternalJob = {
        id: jobId,
        status: 'done',
        inputFile: req.file.originalname,
        outputFile: outputFilename,
        outputPath,
        originalName: `${path.parse(req.file.originalname).name}.${path.extname(outputPath).replace('.', '')}`,
        createdAt: new Date().toISOString(),
      };
      jobsStore.set(jobId, job);

      // 5. Clean up uploaded file
      try {
        fs.unlinkSync(inputPath);
      } catch {
        // non-critical
      }

      // 6. Log conversion
      const durationMs = Date.now() - startTime;
      logConversion({
        timestamp: new Date().toISOString(),
        inputFormat,
        outputFormat: targetFormat,
        fileSize,
        durationMs,
        success: true,
      });

      // 7. Respond
      const response: ConversionResponse = {
        jobId,
        downloadUrl: `/api/download/${jobId}`,
        filename: job.originalName,
        size: outputStats.size,
      };
      res.status(200).json(response);
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;

      // Log the failure
      logConversion({
        timestamp: new Date().toISOString(),
        inputFormat,
        outputFormat: targetFormat,
        fileSize,
        durationMs,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });

      // Clean up upload on failure
      if (req.file?.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch {
          // non-critical
        }
      }

      // Map error types to HTTP status codes
      if (err instanceof UnsupportedConversionError) {
        res.status(415).json({ error: err.message, code: err.code });
      } else if (err instanceof TimeoutError) {
        res.status(500).json({ error: err.message, code: err.code });
      } else if (err instanceof ConversionError) {
        res.status(500).json({ error: err.message, code: err.code });
      } else if (
        err instanceof multer.MulterError &&
        err.code === 'LIMIT_FILE_SIZE'
      ) {
        res.status(413).json({
          error: `File exceeds the ${MAX_FILE_SIZE_MB}MB size limit`,
          code: 'FILE_TOO_LARGE',
        });
      } else {
        const message =
          err instanceof Error ? err.message : 'Internal server error';
        res.status(500).json({ error: message, code: 'SERVER_ERROR' });
      }
    }
  }
);

// ── POST /api/convert-batch ──────────────────────────────────────────────────

convertRouter.post(
  '/api/convert-batch',
  convertLimiter,
  upload.array('files', 10),
  async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    let targetFormat = '';

    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        res.status(400).json({ error: 'No files uploaded', code: 'MISSING_FILE' });
        return;
      }

      targetFormat = (req.body.targetFormat || '').toLowerCase().trim();
      if (!targetFormat || !SUPPORTED_FORMATS.has(targetFormat)) {
        res.status(400).json({ error: 'Invalid or missing target format', code: 'INVALID_FORMAT' });
        return;
      }

      const inputPaths = files.map((f) => f.path);
      const operation = req.body.operation || '';
      const outputPath = await convertFile(
        inputPaths.length === 1 ? inputPaths[0] : (inputPaths as any),
        targetFormat as SupportedFormat,
        operation
      );

      const jobId = uuidv4();
      const outputFilename = path.basename(outputPath);
      const outputStats = fs.statSync(outputPath);

      const job: InternalJob = {
        id: jobId,
        status: 'done',
        inputFile: 'batch',
        outputFile: outputFilename,
        outputPath,
        originalName: `merged.${targetFormat}`,
        createdAt: new Date().toISOString(),
      };
      jobsStore.set(jobId, job);

      inputPaths.forEach((p) => {
        try { fs.unlinkSync(p); } catch {}
      });

      logConversion({
        timestamp: new Date().toISOString(),
        inputFormat: 'batch',
        outputFormat: targetFormat,
        fileSize: files.reduce((acc, f) => acc + f.size, 0),
        durationMs: Date.now() - startTime,
        success: true,
      });

      res.status(200).json({
        jobId,
        downloadUrl: `/api/download/${jobId}`,
        filename: job.originalName,
        size: outputStats.size,
      });
    } catch (err: unknown) {
      const files = req.files as Express.Multer.File[];
      if (files) {
        files.forEach((f) => { try { fs.unlinkSync(f.path); } catch {} });
      }
      res.status(500).json({ error: err instanceof Error ? err.message : 'Batch conversion failed', code: 'SERVER_ERROR' });
    }
  }
);

// ── GET /api/download/:jobId ─────────────────────────────────────────────────

convertRouter.get(
  '/api/download/:jobId',
  (req: Request, res: Response): void => {
    const job = jobsStore.get(req.params.jobId);

    if (!job) {
      res.status(404).json({ error: 'Job not found', code: 'JOB_NOT_FOUND' });
      return;
    }

    if (!fs.existsSync(job.outputPath)) {
      res.status(404).json({
        error: 'Output file has expired or been deleted',
        code: 'FILE_EXPIRED',
      });
      jobsStore.delete(req.params.jobId);
      return;
    }

    // Determine content type
    const ext = path.extname(job.outputPath).toLowerCase();
    const contentType =
      mime.contentType(ext) || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${job.originalName}"`
    );

    const stream = fs.createReadStream(job.outputPath);
    stream.pipe(res);

    // Delete file after streaming completes
    res.on('finish', () => {
      try {
        if (fs.existsSync(job.outputPath)) {
          fs.unlinkSync(job.outputPath);
        }
        jobsStore.delete(req.params.jobId);
      } catch {
        // non-critical cleanup
      }
    });
  }
);

// ── GET /api/jobs/:id (status check) ─────────────────────────────────────────

convertRouter.get(
  '/api/jobs/:id',
  (req: Request, res: Response): void => {
    const job = jobsStore.get(req.params.id);
    if (!job) {
      res.status(404).json({ error: 'Job not found', code: 'JOB_NOT_FOUND' });
      return;
    }
    // Return job without internal fields
    const { outputPath, originalName, ...publicJob } = job;
    res.json(publicJob);
  }
);
