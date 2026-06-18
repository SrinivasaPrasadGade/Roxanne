import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import fs from 'fs';
import dotenv from 'dotenv';
import { convertRouter } from './routes/convert';

// Load environment variables
dotenv.config();

// Simple in-memory log buffer for remote debugging
const logBuffer: string[] = [];
const maxLogLines = 1000;

function appendToBuffer(type: string, args: any[]) {
  const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
  const logLine = `[${new Date().toISOString()}] [${type}] ${message}`;
  logBuffer.push(logLine);
  if (logBuffer.length > maxLogLines) {
    logBuffer.shift();
  }
}

const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = (...args: any[]) => {
  appendToBuffer('INFO', args);
  originalLog.apply(console, args);
};

console.error = (...args: any[]) => {
  appendToBuffer('ERROR', args);
  originalError.apply(console, args);
};

console.warn = (...args: any[]) => {
  appendToBuffer('WARN', args);
  originalWarn.apply(console, args);
};

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 7860;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || 'http://localhost:5173';

// Create temp directories
const UPLOADS_DIR = '/tmp/uploads';
const OUTPUTS_DIR = '/tmp/outputs';

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(OUTPUTS_DIR)) {
  fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
}

// Setup CORS
app.use(cors({
  origin: ALLOWED_ORIGINS.split(','),
  credentials: true
}));

app.use(express.json());

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.send('<h1>Roxanne API Server</h1><p>Status: Running</p><p>Use /api/health to check status.</p>');
});

// Health endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

// Debug logs endpoint
app.get('/api/debug-logs', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send(logBuffer.join('\n'));
});

// Temp exec endpoint for remote container diagnosis
app.get('/api/exec', async (req: Request, res: Response): Promise<void> => {
  const cmd = req.query.cmd as string;
  if (!cmd) {
    res.status(400).send('Missing cmd parameter');
    return;
  }
  
  const { exec } = require('child_process');
  exec(cmd, (err: any, stdout: string, stderr: string) => {
    res.setHeader('Content-Type', 'text/plain');
    res.send(`--- ERROR ---\n${err ? err.message : 'None'}\n\n--- STDOUT ---\n${stdout}\n\n--- STDERR ---\n${stderr}`);
  });
});

// Mount conversion routes
app.use(convertRouter);

// Global error handler — always returns JSON { error, code }
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled server error:', err);

  // Handle multer file-size errors that bubble up
  if (err.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({
      error: 'File exceeds the maximum allowed size',
      code: 'FILE_TOO_LARGE',
    });
    return;
  }

  res.status(500).json({
    error: err.message || 'Internal server error',
    code: 'SERVER_ERROR',
  });
});

app.listen(PORT, () => {
  console.log(`Roxanne backend running on http://localhost:${PORT}`);
  console.log(`Uploads directory: ${UPLOADS_DIR}`);
  console.log(`Outputs directory: ${OUTPUTS_DIR}`);
});
