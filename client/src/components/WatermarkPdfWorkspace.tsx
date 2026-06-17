import React, { useState, useCallback, useEffect } from 'react';
import { UploadCloud, X, Download, FileText, Stamp, Image as ImageIcon } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { PDFDocument, degrees, rgb, StandardFonts } from 'pdf-lib';
import { useOutletContext } from 'react-router-dom';
import type { LayoutContext } from './Layout';

interface WatermarkPdfWorkspaceProps {
  acceptFormats: Record<string, string[]>;
  toolName: string;
  toolDescription: string;
  acceptLabel: string;
}

const COLOR_PRESETS = [
  { name: 'Red', value: 'red', rgb: rgb(0.9, 0.1, 0.1) },
  { name: 'Blue', value: 'blue', rgb: rgb(0.1, 0.4, 0.9) },
  { name: 'Grey', value: 'grey', rgb: rgb(0.5, 0.5, 0.5) },
  { name: 'Black', value: 'black', rgb: rgb(0, 0, 0) },
  { name: 'Green', value: 'green', rgb: rgb(0.1, 0.7, 0.1) },
];

export default function WatermarkPdfWorkspace({
  acceptFormats,
  toolName,
  toolDescription,
  acceptLabel,
}: WatermarkPdfWorkspaceProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [watermarkType, setWatermarkType] = useState<'text' | 'image'>('text');
  
  // Text Watermark Settings
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
  const [textSize, setTextSize] = useState(60);
  const [textColor, setTextColor] = useState('red');
  const [textOpacity, setTextOpacity] = useState(0.3);
  const [textRotation, setTextRotation] = useState(45);

  // Image Watermark Settings
  const [watermarkImage, setWatermarkImage] = useState<File | null>(null);
  const [watermarkImageUrl, setWatermarkImageUrl] = useState<string | null>(null);
  const [imageScale, setImageScale] = useState(0.5);
  const [imageOpacity, setImageOpacity] = useState(0.4);
  const [imageRotation, setImageRotation] = useState(0);

  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadInfo, setDownloadInfo] = useState<{ name: string; url: string } | null>(null);
  const { showToast } = useOutletContext<LayoutContext>();

  // Cleanup object URLs for preview and watermark image
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (watermarkImageUrl) URL.revokeObjectURL(watermarkImageUrl);
    };
  }, [watermarkImageUrl]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        const selectedFile = acceptedFiles[0];
        setFile(selectedFile);
        setDownloadInfo(null);
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

  // Watermark Image dropzone
  const onDropWatermarkImage = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const selectedImage = acceptedFiles[0];
      setWatermarkImage(selectedImage);
      setWatermarkImageUrl(URL.createObjectURL(selectedImage));
    }
  }, []);

  const watermarkImageDropzone = useDropzone({
    onDrop: onDropWatermarkImage,
    accept: { 'image/png': ['.png'], 'image/jpeg': ['.jpg', '.jpeg'] },
    maxSize: 10485760, // 10MB
    maxFiles: 1,
  });

  const clearFile = () => {
    setFile(null);
    setDownloadInfo(null);
    setPreviewUrl(null);
  };

  const clearWatermarkImage = () => {
    setWatermarkImage(null);
    setWatermarkImageUrl(null);
  };

  // Automatically generate watermarked preview when inputs change
  useEffect(() => {
    if (!file) return;

    // Debounce preview updates to prevent lagging during active dragging
    const timer = setTimeout(() => {
      const applyWatermark = async () => {
        if (watermarkType === 'image' && !watermarkImage) {
          // In image mode but no image has been selected: show original PDF
          const originalUrl = URL.createObjectURL(file);
          setPreviewUrl((prev) => {
            if (prev && prev !== originalUrl) URL.revokeObjectURL(prev);
            return originalUrl;
          });
          setDownloadInfo(null);
          return;
        }

        try {
          const arrayBuffer = await file.arrayBuffer();
          const pdfDoc = await PDFDocument.load(arrayBuffer);
          const pages = pdfDoc.getPages();

          if (watermarkType === 'text') {
            if (!watermarkText.trim()) {
              const originalUrl = URL.createObjectURL(file);
              setPreviewUrl((prev) => {
                if (prev && prev !== originalUrl) URL.revokeObjectURL(prev);
                return originalUrl;
              });
              setDownloadInfo(null);
              return;
            }

            const helveticaFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            const colorPreset = COLOR_PRESETS.find((c) => c.value === textColor) || COLOR_PRESETS[0];

            pages.forEach((page) => {
              const { width, height } = page.getSize();
              const textWidth = helveticaFont.widthOfTextAtSize(watermarkText, textSize);

              page.drawText(watermarkText, {
                x: width / 2 - textWidth / 2,
                y: height / 2 - textSize / 2,
                size: textSize,
                font: helveticaFont,
                color: colorPreset.rgb,
                opacity: textOpacity,
                rotate: degrees(textRotation),
              });
            });
          } else if (watermarkType === 'image' && watermarkImage) {
            const imgBytes = await watermarkImage.arrayBuffer();
            let embeddedImage;
            if (watermarkImage.type === 'image/png') {
              embeddedImage = await pdfDoc.embedPng(imgBytes);
            } else {
              embeddedImage = await pdfDoc.embedJpg(imgBytes);
            }

            pages.forEach((page) => {
              const { width, height } = page.getSize();
              const imgDims = embeddedImage.scale(imageScale);

              page.drawImage(embeddedImage, {
                x: width / 2 - imgDims.width / 2,
                y: height / 2 - imgDims.height / 2,
                width: imgDims.width,
                height: imgDims.height,
                opacity: imageOpacity,
                rotate: degrees(imageRotation),
              });
            });
          }

          const watermarkedBytes = await pdfDoc.save();
          const blob = new Blob([watermarkedBytes], { type: 'application/pdf' });
          const newUrl = URL.createObjectURL(blob);
          const baseName = file.name.replace(/\.[^/.]+$/, '');

          setPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return newUrl;
          });

          setDownloadInfo({
            name: `${baseName}_watermarked.pdf`,
            url: newUrl,
          });
        } catch (err: any) {
          console.error('Error generating watermark preview:', err);
        }
      };

      applyWatermark();
    }, 250);

    return () => clearTimeout(timer);
  }, [
    file,
    watermarkType,
    watermarkText,
    textSize,
    textColor,
    textOpacity,
    textRotation,
    watermarkImage,
    imageScale,
    imageOpacity,
    imageRotation,
  ]);

  const handleDownload = () => {
    if (!downloadInfo) return;
    const link = document.createElement('a');
    link.href = downloadInfo.url;
    link.download = downloadInfo.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('PDF downloaded successfully!', 'success');
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
                  <p className="p-4 text-white/50">Your browser doesn't have a PDF plugin. You can still watermark the file using the options on the right.</p>
                </object>
              )}
            </div>

            {/* Watermark Control Panel */}
            <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6 bg-white/[0.02] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-xl">
              <div>
                <h3 className="text-sm tracking-widest uppercase font-semibold text-white/90 mb-1">
                  Watermark Settings
                </h3>
                <p className="text-xs text-white/40 font-light">Add customizable text or image watermarks</p>
              </div>

              {/* Watermark Type Tabs */}
              <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setWatermarkType('text')}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                    watermarkType === 'text'
                      ? 'bg-white text-black font-bold shadow-sm'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  Text Watermark
                </button>
                <button
                  type="button"
                  onClick={() => setWatermarkType('image')}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                    watermarkType === 'image'
                      ? 'bg-white text-black font-bold shadow-sm'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  Image Watermark
                </button>
              </div>

              <AnimatePresence mode="wait">
                {watermarkType === 'text' ? (
                  <motion.div
                    key="text-settings"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex flex-col gap-4"
                  >
                    {/* Watermark Text Input */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold tracking-wider text-white/70 uppercase">
                        Watermark Text
                      </label>
                      <input
                        type="text"
                        value={watermarkText}
                        onChange={(e) => setWatermarkText(e.target.value)}
                        placeholder="e.g. CONFIDENTIAL"
                        className="bg-white/5 border border-white/20 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-white transition-colors"
                      />
                    </div>

                    {/* Font Size Slider */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-xs text-white/70 font-semibold tracking-wider uppercase">
                        <span>Font Size</span>
                        <span className="font-mono">{textSize}px</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="120"
                        value={textSize}
                        onChange={(e) => setTextSize(parseInt(e.target.value, 10))}
                        className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
                      />
                    </div>

                    {/* Color Preset Selector */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold tracking-wider text-white/70 uppercase">
                        Color
                      </label>
                      <div className="flex gap-2">
                        {COLOR_PRESETS.map((preset) => {
                          const isSelected = textColor === preset.value;
                          return (
                            <button
                              key={preset.value}
                              type="button"
                              onClick={() => setTextColor(preset.value)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                isSelected
                                  ? 'bg-white text-black border-white font-bold'
                                  : 'bg-white/5 text-white/80 border-white/10 hover:border-white/30'
                              }`}
                            >
                              {preset.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Opacity Slider */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-xs text-white/70 font-semibold tracking-wider uppercase">
                        <span>Opacity</span>
                        <span className="font-mono">{Math.round(textOpacity * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.05"
                        max="1"
                        step="0.05"
                        value={textOpacity}
                        onChange={(e) => setTextOpacity(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
                      />
                    </div>

                    {/* Rotation Slider */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-xs text-white/70 font-semibold tracking-wider uppercase">
                        <span>Rotation</span>
                        <span className="font-mono">{textRotation}°</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="360"
                        value={textRotation}
                        onChange={(e) => setTextRotation(parseInt(e.target.value, 10))}
                        className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
                      />
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="image-settings"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex flex-col gap-4"
                  >
                    {/* Watermark Image Dropzone */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold tracking-wider text-white/70 uppercase">
                        Watermark Image (PNG/JPG)
                      </label>
                      {!watermarkImage ? (
                        <div
                          {...watermarkImageDropzone.getRootProps()}
                          className={`w-full min-h-[120px] border border-dashed rounded-xl flex flex-col items-center justify-center p-4 transition-all duration-200 cursor-pointer ${
                            watermarkImageDropzone.isDragActive
                              ? 'border-white bg-white/10'
                              : 'border-white/20 bg-white/5 hover:border-white/40'
                          }`}
                        >
                          <input {...watermarkImageDropzone.getInputProps()} />
                          <ImageIcon className="w-6 h-6 mb-2 text-white/40" />
                          <span className="text-xs text-white/60 text-center font-light">
                            Drop image here or browse
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl p-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {watermarkImageUrl && (
                              <img
                                src={watermarkImageUrl}
                                alt="Watermark preview"
                                className="w-8 h-8 rounded object-contain bg-black/40"
                              />
                            )}
                            <div className="min-w-0">
                              <p className="text-xs text-white font-medium truncate" title={watermarkImage.name}>
                                {watermarkImage.name}
                              </p>
                              <p className="text-[10px] text-white/40">
                                {(watermarkImage.size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={clearWatermarkImage}
                            className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Scale/Size Slider */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-xs text-white/70 font-semibold tracking-wider uppercase">
                        <span>Scale</span>
                        <span className="font-mono">{Math.round(imageScale * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="2"
                        step="0.05"
                        value={imageScale}
                        onChange={(e) => setImageScale(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
                      />
                    </div>

                    {/* Opacity Slider */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-xs text-white/70 font-semibold tracking-wider uppercase">
                        <span>Opacity</span>
                        <span className="font-mono">{Math.round(imageOpacity * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.05"
                        max="1"
                        step="0.05"
                        value={imageOpacity}
                        onChange={(e) => setImageOpacity(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
                      />
                    </div>

                    {/* Rotation Slider */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-xs text-white/70 font-semibold tracking-wider uppercase">
                        <span>Rotation</span>
                        <span className="font-mono">{imageRotation}°</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="360"
                        value={imageRotation}
                        onChange={(e) => setImageRotation(parseInt(e.target.value, 10))}
                        className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action Button */}
              <button
                type="button"
                onClick={handleDownload}
                disabled={!downloadInfo}
                className={`w-full mt-4 py-3 px-5 rounded-xl font-bold tracking-widest uppercase text-xs flex items-center justify-center gap-2 transition-all shadow-xl hover:shadow-2xl active:scale-[0.98] ${
                  !downloadInfo
                    ? 'bg-white/10 text-white/40 cursor-not-allowed border-white/10'
                    : 'bg-white hover:bg-white/90 text-black border-white'
                }`}
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
            </div>
          </div>

          {/* Download watermarked PDF Section */}
          {downloadInfo && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-6"
            >
              <h4 className="text-xs tracking-widest uppercase font-semibold text-white/80">
                Watermarked Document Ready
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
