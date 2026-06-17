"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertRouter = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const uuid_1 = require("uuid");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const mime_types_1 = __importDefault(require("mime-types"));
const conversion_1 = require("../conversion");
// ── Constants ────────────────────────────────────────────────────────────────
const UPLOADS_DIR = '/tmp/uploads';
const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10);
const SUPPORTED_FORMATS = new Set([
    'pdf',
    'docx',
    'pptx',
    'xlsx',
    'jpg',
    'png',
]);
// ── Ensure directories exist ─────────────────────────────────────────────────
if (!fs_1.default.existsSync(UPLOADS_DIR)) {
    fs_1.default.mkdirSync(UPLOADS_DIR, { recursive: true });
}
const jobsStore = new Map();
// ── Multer configuration ─────────────────────────────────────────────────────
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
        const uniqueName = `${(0, uuid_1.v4)()}-${file.originalname}`;
        cb(null, uniqueName);
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
});
// ── Rate limiter ─────────────────────────────────────────────────────────────
const convertLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 conversions per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Too many conversion requests. Please try again later.',
        code: 'RATE_LIMITED',
    },
});
// ── Router ───────────────────────────────────────────────────────────────────
exports.convertRouter = (0, express_1.Router)();
// ── POST /api/convert ────────────────────────────────────────────────────────
exports.convertRouter.post('/api/convert', convertLimiter, upload.single('file'), async (req, res) => {
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
        inputFormat = path_1.default
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
        const outputPath = await (0, conversion_1.convertFile)(inputPath, targetFormat);
        // 4. Build job record
        const jobId = (0, uuid_1.v4)();
        const outputFilename = path_1.default.basename(outputPath);
        const outputStats = fs_1.default.statSync(outputPath);
        const job = {
            id: jobId,
            status: 'done',
            inputFile: req.file.originalname,
            outputFile: outputFilename,
            outputPath,
            originalName: `${path_1.default.parse(req.file.originalname).name}.${path_1.default.extname(outputPath).replace('.', '')}`,
            createdAt: new Date().toISOString(),
        };
        jobsStore.set(jobId, job);
        // 5. Clean up uploaded file
        try {
            fs_1.default.unlinkSync(inputPath);
        }
        catch {
            // non-critical
        }
        // 6. Log conversion
        const durationMs = Date.now() - startTime;
        (0, conversion_1.logConversion)({
            timestamp: new Date().toISOString(),
            inputFormat,
            outputFormat: targetFormat,
            fileSize,
            durationMs,
            success: true,
        });
        // 7. Respond
        const response = {
            jobId,
            downloadUrl: `/api/download/${jobId}`,
            filename: job.originalName,
            size: outputStats.size,
        };
        res.status(200).json(response);
    }
    catch (err) {
        const durationMs = Date.now() - startTime;
        // Log the failure
        (0, conversion_1.logConversion)({
            timestamp: new Date().toISOString(),
            inputFormat,
            outputFormat: targetFormat,
            fileSize,
            durationMs,
            success: false,
            error: err instanceof Error ? err.message : String(err),
        });
        // Clean up upload on failure
        if (req.file?.path && fs_1.default.existsSync(req.file.path)) {
            try {
                fs_1.default.unlinkSync(req.file.path);
            }
            catch {
                // non-critical
            }
        }
        // Map error types to HTTP status codes
        if (err instanceof conversion_1.UnsupportedConversionError) {
            res.status(415).json({ error: err.message, code: err.code });
        }
        else if (err instanceof conversion_1.TimeoutError) {
            res.status(500).json({ error: err.message, code: err.code });
        }
        else if (err instanceof conversion_1.ConversionError) {
            res.status(500).json({ error: err.message, code: err.code });
        }
        else if (err instanceof multer_1.default.MulterError &&
            err.code === 'LIMIT_FILE_SIZE') {
            res.status(413).json({
                error: `File exceeds the ${MAX_FILE_SIZE_MB}MB size limit`,
                code: 'FILE_TOO_LARGE',
            });
        }
        else {
            const message = err instanceof Error ? err.message : 'Internal server error';
            res.status(500).json({ error: message, code: 'SERVER_ERROR' });
        }
    }
});
// ── GET /api/download/:jobId ─────────────────────────────────────────────────
exports.convertRouter.get('/api/download/:jobId', (req, res) => {
    const job = jobsStore.get(req.params.jobId);
    if (!job) {
        res.status(404).json({ error: 'Job not found', code: 'JOB_NOT_FOUND' });
        return;
    }
    if (!fs_1.default.existsSync(job.outputPath)) {
        res.status(404).json({
            error: 'Output file has expired or been deleted',
            code: 'FILE_EXPIRED',
        });
        jobsStore.delete(req.params.jobId);
        return;
    }
    // Determine content type
    const ext = path_1.default.extname(job.outputPath).toLowerCase();
    const contentType = mime_types_1.default.contentType(ext) || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${job.originalName}"`);
    const stream = fs_1.default.createReadStream(job.outputPath);
    stream.pipe(res);
    // Delete file after streaming completes
    res.on('finish', () => {
        try {
            if (fs_1.default.existsSync(job.outputPath)) {
                fs_1.default.unlinkSync(job.outputPath);
            }
            jobsStore.delete(req.params.jobId);
        }
        catch {
            // non-critical cleanup
        }
    });
});
// ── GET /api/jobs/:id (status check) ─────────────────────────────────────────
exports.convertRouter.get('/api/jobs/:id', (req, res) => {
    const job = jobsStore.get(req.params.id);
    if (!job) {
        res.status(404).json({ error: 'Job not found', code: 'JOB_NOT_FOUND' });
        return;
    }
    // Return job without internal fields
    const { outputPath, originalName, ...publicJob } = job;
    res.json(publicJob);
});
