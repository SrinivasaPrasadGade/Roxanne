import React, { useState, useCallback } from 'react';
import { UploadCloud, X, Download, FileText } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { PDFDocument } from 'pdf-lib';
import { useOutletContext } from 'react-router-dom';
import type { LayoutContext } from './Layout';

interface SplitPdfWorkspaceProps {
  acceptFormats: Record<string, string[]>;
  toolName: string;
  toolDescription: string;
  acceptLabel: string;
}

export default function SplitPdfWorkspace({
  acceptFormats,
  toolName,
  toolDescription,
  acceptLabel,
}: SplitPdfWorkspaceProps) {
  const [file, setFile] = useState<File | null>(null);
  const [splitPageStr, setSplitPageStr] = useState<string>('1');
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloads, setDownloads] = useState<{ name: string; url: string }[]>([]);
  const { showToast } = useOutletContext<LayoutContext>();

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        setFile(acceptedFiles[0]);
        setDownloads([]);
        setSplitPageStr('1');
      }
    },
    []
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: acceptFormats,
    maxSize: 52428800, // 50MB
    maxFiles: 1,
    noClick: false,
  });

  const clearFile = () => {
    setFile(null);
    setDownloads([]);
  };

  const handleSplit = async () => {
    if (!file) return;
    
    const splitPage = parseInt(splitPageStr, 10);
    if (isNaN(splitPage) || splitPage < 1) {
      showToast('Split page must be a valid number of at least 1', 'error');
      return;
    }

    setIsProcessing(true);
    setDownloads([]);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pageCount = pdfDoc.getPageCount();

      if (splitPage >= pageCount) {
        showToast(`PDF only has ${pageCount} pages. Choose a smaller page number.`, 'error');
        setIsProcessing(false);
        return;
      }

      // First part: 0 to splitPage - 1
      const doc1 = await PDFDocument.create();
      const indices1 = Array.from({ length: splitPage }, (_, i) => i);
      const pages1 = await doc1.copyPages(pdfDoc, indices1);
      pages1.forEach((page) => doc1.addPage(page));

      // Second part: splitPage to pageCount - 1
      const doc2 = await PDFDocument.create();
      const indices2 = Array.from({ length: pageCount - splitPage }, (_, i) => i + splitPage);
      const pages2 = await doc2.copyPages(pdfDoc, indices2);
      pages2.forEach((page) => doc2.addPage(page));

      const bytes1 = await doc1.save();
      const bytes2 = await doc2.save();

      const blob1 = new Blob([bytes1], { type: 'application/pdf' });
      const blob2 = new Blob([bytes2], { type: 'application/pdf' });

      const baseName = file.name.replace(/\.[^/.]+$/, '');
      
      setDownloads([
        {
          name: `${baseName}_part1.pdf`,
          url: URL.createObjectURL(blob1),
        },
        {
          name: `${baseName}_part2.pdf`,
          url: URL.createObjectURL(blob2),
        },
      ]);
      
      showToast('PDF split successfully!', 'success');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Error splitting PDF', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-6 sm:p-8 flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-serif font-light tracking-wide text-white">{toolName}</h2>
        <p className="text-sm text-white/50 mt-1 font-light tracking-wide">{toolDescription}</p>
      </div>

      {!file ? (
        <>
          <div
            {...getRootProps()}
            className={`w-full min-h-[240px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-8 transition-all duration-200 cursor-pointer ${
              isDragActive
                ? 'border-white bg-white/20'
                : 'border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10'
            }`}
          >
            <input {...getInputProps()} />
            <UploadCloud
              className={`w-12 h-12 mb-4 transition-colors duration-200 ${
                isDragActive ? 'text-white' : 'text-white/40'
              }`}
            />
            <h3 className="text-2xl font-serif font-light text-white text-center mb-1 tracking-wide">
              Drop your PDF here
            </h3>
            <p className="text-sm text-white/50 text-center font-light tracking-wide">
              {acceptLabel} · Max 50MB
            </p>
          </div>
          <div className="flex flex-col items-center justify-center gap-3">
            <span className="text-sm text-white/40 font-medium tracking-wider uppercase">or</span>
            <button
              type="button"
              onClick={open}
              className="py-2.5 px-8 rounded-full bg-white hover:bg-white/90 text-black font-medium tracking-widest text-xs uppercase shadow-xl hover:shadow-2xl transition-all focus:outline-none"
            >
              Browse files
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-white/80" />
              <div>
                <p className="text-white font-medium">{file.name}</p>
                <p className="text-white/50 text-xs tracking-wider">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <button
              onClick={clearFile}
              className="p-2 hover:bg-white/10 rounded-full transition-colors focus:outline-none"
            >
              <X className="w-5 h-5 text-white/50 hover:text-white" />
            </button>
          </div>

          <div className="w-full h-[75vh] min-h-[600px] border border-white/20 rounded-xl overflow-hidden bg-white/5">
            <object
              data={URL.createObjectURL(file)}
              type="application/pdf"
              className="w-full h-full"
            >
              <p className="p-4 text-white/50">Your browser doesn't have a PDF plugin. You can still split the file below.</p>
            </object>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              <label className="text-white/80 text-sm tracking-wide">Split after page:</label>
              <input
                type="number"
                min="1"
                value={splitPageStr}
                onChange={(e) => setSplitPageStr(e.target.value)}
                className="bg-white/5 border border-white/20 text-white rounded-lg px-3 py-2 w-24 text-center focus:outline-none focus:border-white transition-colors"
              />
            </div>
            <button
              onClick={handleSplit}
              disabled={isProcessing}
              className="py-3 px-8 rounded-full bg-white hover:bg-white/90 text-black font-medium tracking-widest text-xs uppercase shadow-xl hover:shadow-2xl transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {isProcessing ? 'Processing...' : 'Split PDF'}
            </button>
          </div>

          {downloads.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex flex-col gap-3"
            >
              <h4 className="text-xs tracking-widest uppercase font-semibold text-white/80 mb-2">
                Download Split Files
              </h4>
              <div className="flex flex-col sm:flex-row gap-4">
                {downloads.map((dl, i) => (
                  <a
                    key={i}
                    href={dl.url}
                    download={dl.name}
                    className="flex-1 flex items-center justify-between p-4 bg-white/5 border border-white/10 hover:border-white/30 rounded-xl transition-all group"
                  >
                    <span className="text-sm text-white truncate mr-4">{dl.name}</span>
                    <Download className="w-5 h-5 text-white/50 group-hover:text-white transition-colors shrink-0" />
                  </a>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
