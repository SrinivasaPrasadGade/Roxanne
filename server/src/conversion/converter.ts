import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { fromPath } from 'pdf2pic';
import archiver from 'archiver';
import type { SupportedFormat } from '../../../shared/types';
import {
  ConversionError,
  TimeoutError,
  UnsupportedConversionError,
} from './errors';

// ── Constants ────────────────────────────────────────────────────────────────

const OUTPUTS_DIR = '/tmp/outputs';
const CONVERSION_TIMEOUT_MS = 60_000; // 60 seconds
const OUTPUT_TTL_MS = 60 * 60 * 1000; // 1 hour

/** Formats that LibreOffice can convert *to* a given target. */
const LIBREOFFICE_MATRIX: Record<string, Set<string>> = {
  pdf: new Set(['docx', 'pptx', 'xlsx', 'jpg', 'png', 'pdf']),
  docx: new Set(['pdf']),
  pptx: new Set(['docx']),
};

/** Source formats where pdf2pic should be used (PDF → image). */
const PDF2PIC_TARGETS = new Set<string>(['jpg']);

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Detect the source format from a file extension. */
function detectFormat(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase().replace('.', '');
  return ext === 'jpeg' ? 'jpg' : ext;
}

/**
 * Spawn LibreOffice headless and wait for it to finish.
 * Rejects with ConversionError (non-zero exit) or TimeoutError.
 */
function runLibreOffice(
  inputPath: string,
  targetFormat: string,
  outDir: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      reject(new TimeoutError(CONVERSION_TIMEOUT_MS));
    }, CONVERSION_TIMEOUT_MS);

    // Determine the correct LibreOffice binary name
    const soffice = process.platform === 'darwin' ? '/Applications/LibreOffice.app/Contents/MacOS/soffice' : 'libreoffice';

    let convertFormat = targetFormat;
    let infilter: string | undefined;

    if (inputPath.toLowerCase().endsWith('.pdf')) {
      if (targetFormat === 'docx') {
        convertFormat = 'docx:MS Word 2007 XML';
        infilter = 'writer_pdf_import';
      } else if (targetFormat === 'pptx') {
        convertFormat = 'pptx:Impress MS PowerPoint 2007 XML';
        infilter = 'impress_pdf_import';
      }
    }

    const args = [
      '--headless',
      '--convert-to',
      convertFormat,
      '--outdir',
      outDir,
    ];
    if (infilter) {
      args.push('--infilter=' + infilter);
    }
    args.push(inputPath);

    const proc = spawn(soffice, args, { signal: controller.signal });

    let stderr = '';
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on('error', (err: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      if (err.name === 'AbortError') return; // handled by timer
      reject(
        new ConversionError(
          `Failed to start LibreOffice: ${err.message}`,
          -1,
          stderr
        )
      );
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(
          new ConversionError(
            `LibreOffice exited with code ${code}`,
            code ?? -1,
            stderr
          )
        );
      } else {
        resolve();
      }
    });
  });
}

/**
 * After LibreOffice finishes, it names the output based on the input filename.
 * Find and rename it to our UUID-based output path.
 */
function renameLibreOfficeOutput(
  inputPath: string,
  targetFormat: string,
  finalOutputPath: string
): void {
  const inputBasename = path.basename(
    inputPath,
    path.extname(inputPath)
  );
  const defaultName = `${inputBasename}.${targetFormat}`;
  const defaultPath = path.join(OUTPUTS_DIR, defaultName);

  if (fs.existsSync(defaultPath)) {
    fs.renameSync(defaultPath, finalOutputPath);
  } else {
    // Sometimes LibreOffice puts it in the same directory as input
    const altPath = path.join(path.dirname(inputPath), defaultName);
    if (fs.existsSync(altPath)) {
      fs.renameSync(altPath, finalOutputPath);
    } else {
      throw new ConversionError(
        `LibreOffice completed but output file not found. Expected: ${defaultPath}`,
        0,
        ''
      );
    }
  }
}

/**
 * Convert PDF pages to JPG images at 150 DPI, then bundle them
 * into a single ZIP archive so the caller gets one output file.
 */
async function convertPdfToJpg(
  inputPath: string,
  outputPath: string
): Promise<void> {
  const options = {
    density: 150,
    saveFilename: 'page',
    savePath: path.dirname(outputPath),
    format: 'jpg' as const,
    width: 1200,
    height: 1600,
  };

  const converter = fromPath(inputPath, options);

  // Determine page count by trying bulk conversion
  // pdf2pic exposes a .bulk() method that converts all pages
  const results = await converter.bulk(-1, { responseType: 'image' });

  if (!Array.isArray(results) || results.length === 0) {
    throw new ConversionError('pdf2pic produced no output pages', -1, '');
  }

  // If single page, just rename the output
  if (results.length === 1) {
    const singlePagePath = results[0].path;
    if (singlePagePath && fs.existsSync(singlePagePath)) {
      // Change output extension to .jpg for single page
      const jpgOutputPath = outputPath.replace(/\.[^.]+$/, '.jpg');
      fs.renameSync(singlePagePath, jpgOutputPath);
      // Update outputPath reference — caller will use the returned path
      return;
    }
    throw new ConversionError('pdf2pic output file not found', -1, '');
  }

  // Multiple pages → ZIP them
  const zipPath = outputPath.replace(/\.[^.]+$/, '.zip');
  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 6 } });

    output.on('close', resolve);
    archive.on('error', reject);

    archive.pipe(output);

    for (const result of results) {
      if (result.path && fs.existsSync(result.path)) {
        archive.file(result.path, { name: path.basename(result.path) });
      }
    }

    archive.finalize();
  });

  // Clean up individual page files
  for (const result of results) {
    if (result.path && fs.existsSync(result.path)) {
      fs.unlinkSync(result.path);
    }
  }
}

/**
 * Schedule deletion of the output file after the TTL expires.
 */
function scheduleCleanup(filePath: string): void {
  setTimeout(() => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[cleanup] Deleted expired output: ${filePath}`);
      }
    } catch (err) {
      console.error(`[cleanup] Failed to delete ${filePath}:`, err);
    }
  }, OUTPUT_TTL_MS).unref(); // .unref() so timer doesn't keep process alive
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Convert a file from its current format to the requested target format.
 *
 * @param inputPath    Absolute path to the uploaded source file.
 * @param targetFormat The desired output format.
 * @returns            Absolute path to the converted output file.
 *
 * @throws ConversionError            if the external tool exits non-zero.
 * @throws TimeoutError               if conversion exceeds 60 seconds.
 * @throws UnsupportedConversionError if the format pair is not supported.
 */
export async function convertFile(
  inputPath: string,
  targetFormat: SupportedFormat
): Promise<string> {
  const sourceFormat = detectFormat(inputPath);
  const outputId = uuidv4();
  const outputFileName = `${outputId}.${targetFormat}`;
  const outputPath = path.join(OUTPUTS_DIR, outputFileName);

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUTS_DIR)) {
    fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
  }

  // ── PDF → JPG (via pdf2pic) ──────────────────────────────────────────────
  if (sourceFormat === 'pdf' && PDF2PIC_TARGETS.has(targetFormat)) {
    await convertPdfToJpg(inputPath, outputPath);

    // pdf2pic may have produced a .jpg or .zip depending on page count
    const jpgPath = outputPath.replace(/\.[^.]+$/, '.jpg');
    const zipPath = outputPath.replace(/\.[^.]+$/, '.zip');
    const actualOutput = fs.existsSync(zipPath) ? zipPath : jpgPath;

    if (!fs.existsSync(actualOutput)) {
      throw new ConversionError(
        'PDF to JPG conversion produced no output',
        -1,
        ''
      );
    }

    scheduleCleanup(actualOutput);
    return actualOutput;
  }

  // ── PDF → XLSX (deferred — not yet implemented) ──────────────────────────
  if (sourceFormat === 'pdf' && targetFormat === 'xlsx') {
    throw new UnsupportedConversionError(sourceFormat, targetFormat);
  }

  // ── LibreOffice-based conversions ────────────────────────────────────────
  const supportedSources = LIBREOFFICE_MATRIX[targetFormat];
  if (!supportedSources || !supportedSources.has(sourceFormat)) {
    throw new UnsupportedConversionError(sourceFormat, targetFormat);
  }

  await runLibreOffice(inputPath, targetFormat, OUTPUTS_DIR);
  renameLibreOfficeOutput(inputPath, targetFormat, outputPath);

  if (!fs.existsSync(outputPath)) {
    throw new ConversionError(
      'Conversion completed but output file is missing',
      0,
      ''
    );
  }

  scheduleCleanup(outputPath);
  return outputPath;
}
