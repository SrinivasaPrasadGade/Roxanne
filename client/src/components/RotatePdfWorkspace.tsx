import React, { useState, useCallback } from 'react';
import { UploadCloud, X, Download, FileText, RotateCw } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { PDFDocument, degrees } from 'pdf-lib';
import { useOutletContext } from 'react-router-dom';
import type { LayoutContext } from './Layout';

interface RotatePdfWorkspaceProps {
  acceptFormats: Record<string, string[]>;
  toolName: string;
  toolDescription: string;
  acceptLabel: string;
}

export default function RotatePdfWorkspace({
  acceptFormats,
  toolName,
  toolDescription,
  acceptLabel,
}: RotatePdfWorkspaceProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rotateAngleStr, setRotateAngleStr] = useState<string>('90');
  const [pagesOption, setPagesOption] = useState<'all' | 'specific'>('all');
  const [customPagesStr, setCustomPagesStr] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadInfo, setDownloadInfo] = useState<{ name: string; url: string } | null>(null);
  const { showToast } = useOutletContext<LayoutContext>();

  // Cleanup object URLs when they change or component unmounts
  React.useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        const selectedFile = acceptedFiles[0];
        setFile(selectedFile);
        setDownloadInfo(null);
        setRotateAngleStr('90');
        setPagesOption('all');
        setCustomPagesStr('');
        setPreviewUrl(URL.createObjectURL(selectedFile));
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
    setDownloadInfo(null);
    setPreviewUrl(null);
  };

  const handleRotate = async () => {
    if (!file) return;

    const rotateAngle = parseInt(rotateAngleStr, 10);
    if (isNaN(rotateAngle)) {
      showToast('Please enter a valid numeric angle for rotation.', 'error');
      return;
    }

    setIsProcessing(true);
    setDownloadInfo(null);

    // Simulate micro-animation delay for premium feel
    await new Promise((resolve) => setTimeout(resolve, 600));

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pages = pdfDoc.getPages();
      const pageCount = pages.length;

      const targetIndices = new Set<number>();
      if (pagesOption === 'all') {
        for (let i = 0; i < pageCount; i++) {
          targetIndices.add(i);
        }
      } else {
        const trimmedPages = customPagesStr.trim();
        if (!trimmedPages) {
          showToast('Please specify the pages you want to rotate.', 'error');
          setIsProcessing(false);
          return;
        }

        const parts = trimmedPages.split(',');
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
            } else {
              showToast(`Invalid range syntax: "${trimmed}"`, 'error');
              setIsProcessing(false);
              return;
            }
          } else {
            const pageNum = parseInt(trimmed, 10);
            if (!isNaN(pageNum)) {
              if (pageNum >= 1 && pageNum <= pageCount) {
                targetIndices.add(pageNum - 1);
              } else {
                showToast(`Page number ${pageNum} is out of range (PDF has ${pageCount} pages).`, 'error');
                setIsProcessing(false);
                return;
              }
            } else {
              showToast(`Invalid page entry: "${trimmed}"`, 'error');
              setIsProcessing(false);
              return;
            }
          }
        }
      }

      if (targetIndices.size === 0) {
        showToast('No valid pages matched the specified criteria.', 'error');
        setIsProcessing(false);
        return;
      }

      pages.forEach((page, index) => {
        if (targetIndices.has(index)) {
          const currentRot = page.getRotation().angle;
          page.setRotation(degrees(currentRot + rotateAngle));
        }
      });

      const rotatedBytes = await pdfDoc.save();
      const blob = new Blob([rotatedBytes], { type: 'application/pdf' });
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      const newUrl = URL.createObjectURL(blob);

      setDownloadInfo({
        name: `${baseName}_rotated.pdf`,
        url: newUrl,
      });

      setPreviewUrl(newUrl);

      showToast('PDF rotated successfully!', 'success');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Error rotating PDF', 'error');
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

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* PDF Preview Screen */}
            <div className="lg:col-span-7 xl:col-span-8 w-full h-[60vh] min-h-[400px] border border-white/20 rounded-xl overflow-hidden bg-white/5 shadow-inner">
              {previewUrl && (
                <object
                  key={previewUrl}
                  data={previewUrl}
                  type="application/pdf"
                  className="w-full h-full"
                >
                  <p className="p-4 text-white/50">Your browser doesn't have a PDF plugin. You can still rotate the file using the options on the right.</p>
                </object>
              )}
            </div>

            {/* Rotation Control Panel */}
            <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6 bg-white/[0.02] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-xl">
              <div>
                <h3 className="text-sm tracking-widest uppercase font-semibold text-white/90 mb-1">
                  Rotation Settings
                </h3>
                <p className="text-xs text-white/40 font-light">Configure rotation angles and target pages</p>
              </div>

              {/* Degrees / Rotation Angle Selection */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold tracking-wider text-white/70 uppercase">
                  Rotation Angle
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: '90', label: '90°' },
                    { value: '180', label: '180°' },
                    { value: '270', label: '270°' },
                  ].map((preset) => {
                    const isSelected = rotateAngleStr === preset.value;
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setRotateAngleStr(preset.value)}
                        className={`py-2 rounded-lg text-xs font-bold transition-all border ${
                          isSelected
                            ? 'bg-white text-black border-white shadow-md'
                            : 'bg-white/5 text-white border-white/10 hover:border-white/30'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-2 flex items-center gap-3">
                  <span className="text-xs text-white/40 whitespace-nowrap">Custom Angle:</span>
                  <div className="relative flex-1">
                    <input
                      type="number"
                      value={rotateAngleStr}
                      onChange={(e) => setRotateAngleStr(e.target.value)}
                      placeholder="e.g. 90"
                      className="w-full bg-white/5 border border-white/20 text-white rounded-lg px-3 py-1.5 pr-8 text-xs font-mono focus:outline-none focus:border-white/60 transition-colors text-right"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-white/40">
                      °
                    </span>
                  </div>
                </div>
              </div>

              {/* Pages Selection Mode */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold tracking-wider text-white/70 uppercase">
                  Pages to Rotate
                </label>
                <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => setPagesOption('all')}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                      pagesOption === 'all'
                        ? 'bg-white text-black font-bold shadow-sm'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    All Pages
                  </button>
                  <button
                    type="button"
                    onClick={() => setPagesOption('specific')}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                      pagesOption === 'specific'
                        ? 'bg-white text-black font-bold shadow-sm'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    Select Pages
                  </button>
                </div>
              </div>

              {/* Page Numbers Input (visible only for 'specific') */}
              <AnimatePresence>
                {pagesOption === 'specific' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden flex flex-col gap-2"
                  >
                    <label className="text-xs font-semibold tracking-wider text-white/60 uppercase">
                      Numeric Page Input
                    </label>
                    <input
                      type="text"
                      value={customPagesStr}
                      onChange={(e) => setCustomPagesStr(e.target.value)}
                      placeholder="e.g. 1, 3, 5-8"
                      className="bg-white/5 border border-white/20 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-white transition-colors placeholder:text-white/20"
                    />
                    <p className="text-[10px] text-white/40 leading-relaxed font-light">
                      Use comma-separated numbers or ranges (e.g. <span className="font-mono text-white/60">1, 2, 5-8</span>).
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action Button */}
              <button
                type="button"
                onClick={handleRotate}
                disabled={isProcessing}
                className="w-full mt-4 py-3 px-5 rounded-xl bg-white hover:bg-white/90 text-black font-bold tracking-widest uppercase text-xs flex items-center justify-center gap-2 transition-all shadow-xl hover:shadow-2xl active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RotateCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
                {isProcessing ? 'Rotating PDF...' : 'Rotate PDF'}
              </button>
            </div>
          </div>

          {/* Download rotated PDF Section */}
          {downloadInfo && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-6"
            >
              <h4 className="text-xs tracking-widest uppercase font-semibold text-white/80">
                Rotated Document Ready
              </h4>
              <div className="flex">
                <a
                  href={downloadInfo.url}
                  download={downloadInfo.name}
                  className="flex-1 flex items-center justify-between p-4 bg-white hover:bg-white/95 text-black rounded-xl transition-all shadow-lg font-semibold group"
                >
                  <span className="text-sm truncate mr-4">{downloadInfo.name}</span>
                  <Download className="w-5 h-5 text-black/60 group-hover:text-black transition-colors shrink-0" />
                </a>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
