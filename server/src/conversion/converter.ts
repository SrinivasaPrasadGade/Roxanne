import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import archiver from 'archiver';
import sharp from 'sharp';
import { PDFDocument, rgb, degrees } from 'pdf-lib';
import type { SupportedFormat } from '../../../shared/types';
import {
  ConversionError,
  TimeoutError,
  UnsupportedConversionError,
} from './errors';

const OUTPUTS_DIR = '/tmp/outputs';
const CONVERSION_TIMEOUT_MS = 180_000; // 3 minutes
const OUTPUT_TTL_MS = 60 * 60 * 1000;

const LIBREOFFICE_MATRIX: Record<string, Set<string>> = {
  pdf: new Set(['docx', 'pptx', 'xlsx', 'jpg', 'png', 'pdf']),
  docx: new Set(['pdf']),
  pptx: new Set(['pdf']),
  xlsx: new Set(['pdf']),
};

const PDF2PIC_TARGETS = new Set<string>(['jpg']);

function detectFormat(filePath: string): string {
  if (filePath === 'batch') return 'batch';
  const ext = path.extname(filePath).toLowerCase().replace('.', '');
  return ext === 'jpeg' ? 'jpg' : ext;
}

function scheduleCleanup(filePath: string): void {
  setTimeout(() => {
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (err) {}
  }, OUTPUT_TTL_MS).unref();
}

function runCommand(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      reject(new TimeoutError(CONVERSION_TIMEOUT_MS));
    }, CONVERSION_TIMEOUT_MS);

    const proc = spawn(cmd, args, { signal: controller.signal, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    
    if (proc.stdout) {
      proc.stdout.on('data', () => {}); // Consume stdout
    }
    
    if (proc.stderr) {
      proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    }

    proc.on('error', (err) => {
      clearTimeout(timer);
      if (err.name === 'AbortError') return;
      reject(new ConversionError(`Failed to start ${cmd}: ${err.message}`, -1, stderr));
    });

    proc.on('exit', (code) => {
      clearTimeout(timer);
      if (code !== 0) reject(new ConversionError(`${cmd} exited with code ${code}`, code ?? -1, stderr));
      else resolve();
    });
  });
}

function runLibreOffice(inputPath: string, targetFormat: string, outDir: string): Promise<void> {
  const soffice = process.platform === 'darwin' ? '/Applications/LibreOffice.app/Contents/MacOS/soffice' : 'libreoffice';
  let convertFormat = targetFormat;
  let infilter: string | undefined;

  if (inputPath.toLowerCase().endsWith('.pdf')) {
    if (targetFormat === 'docx') { convertFormat = 'docx:MS Word 2007 XML'; infilter = 'writer_pdf_import'; }
    else if (targetFormat === 'pptx') { convertFormat = 'pptx:Impress MS PowerPoint 2007 XML'; infilter = 'impress_pdf_import'; }
    else if (targetFormat === 'xlsx') { convertFormat = 'xlsx:Calc MS Excel 2007 XML'; infilter = 'calc_pdf_import'; }
  }

  const profileDir = path.join('/tmp', `lo_profile_${uuidv4()}`);
  const args = [
    `-env:UserInstallation=file://${profileDir}`,
    '--headless',
    '--nologo',
    '--norestore',
    '--nofirststartwizard',
    '--convert-to',
    convertFormat,
    '--outdir',
    outDir
  ];
  
  if (infilter) args.push('--infilter=' + infilter);
  args.push(inputPath);

  return runCommand(soffice, args).finally(() => {
    // Cleanup isolated user profile
    try {
      if (fs.existsSync(profileDir)) {
        fs.rmSync(profileDir, { recursive: true, force: true });
      }
    } catch (err) {
      console.warn(`Failed to cleanup LO profile at ${profileDir}`, err);
    }
  });
}

function renameLibreOfficeOutput(inputPath: string, targetFormat: string, finalOutputPath: string): void {
  const defaultName = `${path.basename(inputPath, path.extname(inputPath))}.${targetFormat}`;
  const defaultPath = path.join(OUTPUTS_DIR, defaultName);
  if (fs.existsSync(defaultPath)) fs.renameSync(defaultPath, finalOutputPath);
  else {
    const altPath = path.join(path.dirname(inputPath), defaultName);
    if (fs.existsSync(altPath)) fs.renameSync(altPath, finalOutputPath);
    else throw new ConversionError(`LibreOffice output not found.`, 0, '');
  }
}

async function convertPdfToJpg(inputPath: string, outputPath: string): Promise<void> {
  // Dynamic import for ESM-only pdf-to-img
  const { pdf } = await import('pdf-to-img');
  const pdfBuffer = fs.readFileSync(inputPath);
  const document = await pdf(pdfBuffer, { scale: 2 });

  const jpgBuffers: Buffer[] = [];
  for await (const pngPage of document) {
    // Convert PNG buffer to JPG using sharp
    const jpgBuffer = await sharp(pngPage)
      .jpeg({ quality: 90 })
      .toBuffer();
    jpgBuffers.push(jpgBuffer);
  }

  // Clean up the pdf document
  if (typeof document.destroy === 'function') {
    await document.destroy();
  }

  if (jpgBuffers.length === 0) {
    throw new ConversionError('PDF to JPG conversion produced no output', -1, '');
  }

  if (jpgBuffers.length === 1) {
    // Single page → output a single JPG file
    const singlePath = outputPath.replace(/\.[^.]+$/, '.jpg');
    fs.writeFileSync(singlePath, jpgBuffers[0]);
    return;
  }

  // Multiple pages → create a ZIP of JPGs
  const zipPath = outputPath.replace(/\.[^.]+$/, '.zip');
  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 6 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    for (let i = 0; i < jpgBuffers.length; i++) {
      archive.append(jpgBuffers[i], { name: `page-${i + 1}.jpg` });
    }
    archive.finalize();
  });
}

async function mergePdf(inputPaths: string[], outputPath: string): Promise<void> {
  const mergedPdf = await PDFDocument.create();
  for (const p of inputPaths) {
    const pdfBytes = fs.readFileSync(p);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }
  const mergedBytes = await mergedPdf.save();
  fs.writeFileSync(outputPath, mergedBytes);
}

async function splitPdf(inputPath: string, outputPath: string): Promise<void> {
  const pdfBytes = fs.readFileSync(inputPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const numPages = pdfDoc.getPageCount();

  const zipPath = outputPath.replace(/\.[^.]+$/, '.zip');
  await new Promise<void>(async (resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 6 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);

    for (let i = 0; i < numPages; i++) {
      const newDoc = await PDFDocument.create();
      const [copiedPage] = await newDoc.copyPages(pdfDoc, [i]);
      newDoc.addPage(copiedPage);
      const newBytes = await newDoc.save();
      archive.append(Buffer.from(newBytes), { name: `page-${i + 1}.pdf` });
    }
    archive.finalize();
  });
}

async function rotatePdf(
  inputPath: string,
  outputPath: string,
  options?: { degrees?: number; pages?: string }
): Promise<void> {
  const pdfBytes = fs.readFileSync(inputPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  const pageCount = pages.length;

  const rotateDegrees = options?.degrees !== undefined ? options.degrees : 90;
  const pageOption = options?.pages || 'all';

  const targetIndices = new Set<number>();
  if (pageOption === 'all') {
    for (let i = 0; i < pageCount; i++) {
      targetIndices.add(i);
    }
  } else {
    const parts = pageOption.split(',');
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.includes('-')) {
        const [startStr, endStr] = trimmed.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!isNaN(start) && !isNaN(end)) {
          const lower = Math.min(start, end);
          const upper = Math.max(start, end);
          for (let i = lower; i <= upper; i++) {
            if (i >= 1 && i <= pageCount) {
              targetIndices.add(i - 1);
            }
          }
        }
      } else {
        const pageNum = parseInt(trimmed, 10);
        if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= pageCount) {
          targetIndices.add(pageNum - 1);
        }
      }
    }
  }

  pages.forEach((page, index) => {
    if (targetIndices.has(index)) {
      const currentRot = page.getRotation().angle;
      page.setRotation(degrees(currentRot + rotateDegrees));
    }
  });

  const newBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, newBytes);
}

async function watermarkPdf(inputPath: string, outputPath: string): Promise<void> {
  const pdfBytes = fs.readFileSync(inputPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  pages.forEach(page => {
    const { width, height } = page.getSize();
    page.drawText('CONFIDENTIAL', {
      x: width / 2 - 150,
      y: height / 2,
      size: 50,
      color: rgb(0.95, 0.1, 0.1),
      opacity: 0.3,
      rotate: degrees(45),
    });
  });
  const newBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, newBytes);
}

async function jpgToPdf(inputPaths: string[], outputPath: string): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  for (const p of inputPaths) {
    const imgBytes = fs.readFileSync(p);
    let image;
    if (p.toLowerCase().endsWith('.png')) image = await pdfDoc.embedPng(imgBytes);
    else image = await pdfDoc.embedJpg(imgBytes);
    const page = pdfDoc.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
}

export async function convertFile(
  inputPathOrPaths: string | string[],
  targetFormat: SupportedFormat | string,
  operation?: string,
  options?: { degrees?: number; pages?: string; password?: string }
): Promise<string> {
  if (!fs.existsSync(OUTPUTS_DIR)) fs.mkdirSync(OUTPUTS_DIR, { recursive: true });

  const isBatch = Array.isArray(inputPathOrPaths);
  const inputPaths = isBatch ? (inputPathOrPaths as string[]) : [inputPathOrPaths as string];
  const firstInput = inputPaths[0];
  const sourceFormat = detectFormat(firstInput);
  
  const outputId = uuidv4();
  const outputFileName = `${outputId}.${targetFormat}`;
  let outputPath = path.join(OUTPUTS_DIR, outputFileName);

  if (operation === 'merge-pdf' || operation === 'jpg-to-pdf' || (isBatch && targetFormat === 'pdf')) {
    if (sourceFormat === 'jpg' || sourceFormat === 'png') await jpgToPdf(inputPaths, outputPath);
    else await mergePdf(inputPaths, outputPath);
    scheduleCleanup(outputPath);
    return outputPath;
  }

  if (operation === 'split-pdf') {
    await splitPdf(firstInput, outputPath);
    outputPath = outputPath.replace(/\.[^.]+$/, '.zip');
    scheduleCleanup(outputPath);
    return outputPath;
  }

  if (operation === 'rotate-pdf') {
    await rotatePdf(firstInput, outputPath, options);
    scheduleCleanup(outputPath);
    return outputPath;
  }

  if (operation === 'watermark-pdf') {
    await watermarkPdf(firstInput, outputPath);
    scheduleCleanup(outputPath);
    return outputPath;
  }

  if (operation === 'compress-pdf') {
    await runCommand('gs', ['-sDEVICE=pdfwrite', '-dCompatibilityLevel=1.4', '-dPDFSETTINGS=/screen', '-dNOPAUSE', '-dQUIET', '-dBATCH', `-sOutputFile=${outputPath}`, firstInput]);
    scheduleCleanup(outputPath);
    return outputPath;
  }

  if (operation === 'protect-pdf') {
    const password = options?.password || 'password';
    await runCommand('qpdf', [
      '--encrypt',
      password,
      password,
      '256',
      '--',
      firstInput,
      outputPath
    ]);
    scheduleCleanup(outputPath);
    return outputPath;
  }

  if (operation === 'unlock-pdf') {
    const password = options?.password || '';
    await runCommand('qpdf', ['--password=' + password, '--decrypt', firstInput, outputPath]);
    scheduleCleanup(outputPath);
    return outputPath;
  }

  if (operation === 'ocr-pdf') {
    try {
      await runCommand('tesseract', [firstInput, outputPath.replace(/\.pdf$/, ''), 'pdf']);
    } catch (err) {
      console.warn('Tesseract failed, falling back to copy:', err);
      fs.copyFileSync(firstInput, outputPath);
    }
    scheduleCleanup(outputPath);
    return outputPath;
  }

  if (sourceFormat === 'pdf' && PDF2PIC_TARGETS.has(targetFormat)) {
    await convertPdfToJpg(firstInput, outputPath);
    const jpgPath = outputPath.replace(/\.[^.]+$/, '.jpg');
    const zipPath = outputPath.replace(/\.[^.]+$/, '.zip');
    const actualOutput = fs.existsSync(zipPath) ? zipPath : jpgPath;
    if (!fs.existsSync(actualOutput)) throw new ConversionError('PDF to JPG conversion produced no output', -1, '');
    scheduleCleanup(actualOutput);
    return actualOutput;
  }

  const supportedSources = LIBREOFFICE_MATRIX[targetFormat];
  if (!supportedSources || !supportedSources.has(sourceFormat)) {
    throw new UnsupportedConversionError(sourceFormat, targetFormat);
  }

  await runLibreOffice(firstInput, targetFormat, OUTPUTS_DIR);
  renameLibreOfficeOutput(firstInput, targetFormat, outputPath);

  if (!fs.existsSync(outputPath)) {
    throw new ConversionError('Conversion completed but output file is missing', 0, '');
  }

  scheduleCleanup(outputPath);
  return outputPath;
}
