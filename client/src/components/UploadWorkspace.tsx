import React, { useState, useCallback } from 'react';
import {
  UploadCloud,
  X,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Presentation,
  File as FileIcon,
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { useOutletContext } from 'react-router-dom';
import type { ConversionResult } from '../../../shared/types';
import ConvertPanel from './ConvertPanel';
import type { LayoutContext } from './Layout';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.2 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 350, damping: 25 },
  },
};

interface UploadWorkspaceProps {
  /** MIME → extension map passed directly to react-dropzone accept */
  acceptFormats: Record<string, string[]>;
  /** Heading text (e.g. "Merge PDF") */
  toolName: string;
  /** Sub-heading text */
  toolDescription: string;
  /** Human-readable list of accepted file types for the dropzone label */
  acceptLabel: string;
}

export default function UploadWorkspace({
  acceptFormats,
  toolName,
  toolDescription,
  acceptLabel,
}: UploadWorkspaceProps) {
  const [files, setFiles] = useState<File[]>([]);
  const { showToast } = useOutletContext<LayoutContext>();

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      setFiles((prev) => {
        const combined = [...prev, ...acceptedFiles];
        if (combined.length > 10) {
          showToast('Maximum of 10 files allowed in the queue', 'error');
          return combined.slice(0, 10);
        }
        return combined;
      });
    },
    [showToast]
  );

  const onDropRejected = useCallback(
    (fileRejections: { file: File; errors: { code: string; message: string }[] }[]) => {
      fileRejections.forEach((rejection) => {
        rejection.errors.forEach((error: { code: string; message: string }) => {
          let message = `${rejection.file.name}: ${error.message}`;
          if (error.code === 'file-too-large') {
            message = 'File exceeds 50MB limit';
          } else if (error.code === 'file-invalid-type') {
            message = 'File type not supported for this tool';
          } else if (error.code === 'too-many-files') {
            message = 'Maximum of 10 files allowed';
          }
          showToast(message, 'error');
        });
      });
    },
    [showToast]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    onDropRejected,
    accept: acceptFormats,
    maxSize: 52428800, // 50MB
    maxFiles: 10,
    noClick: false,
  });

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAllFiles = () => {
    setFiles([]);
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    switch (mimeType) {
      case 'application/pdf':
        return <FileText className="w-5 h-5 text-white/60" />;
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'application/msword':
        return <FileText className="w-5 h-5 text-white/60" />;
      case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      case 'application/vnd.ms-powerpoint':
        return <Presentation className="w-5 h-5 text-white/60" />;
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      case 'application/vnd.ms-excel':
        return <FileSpreadsheet className="w-5 h-5 text-white/60" />;
      case 'image/jpeg':
      case 'image/png':
        return <ImageIcon className="w-5 h-5 text-white/60" />;
      default:
        return <FileIcon className="w-5 h-5 text-white/40" />;
    }
  };

  const handleConversionComplete = useCallback(
    (results: ConversionResult[]) => {
      const successCount = results.filter((r) => r.status === 'success').length;
      const errorCount = results.filter((r) => r.status === 'error').length;

      if (successCount > 0 && errorCount === 0) {
        showToast(
          `${successCount} file${successCount > 1 ? 's' : ''} converted successfully!`,
          'success'
        );
      } else if (successCount > 0 && errorCount > 0) {
        showToast(`${successCount} converted, ${errorCount} failed`, 'error');
      } else if (errorCount > 0) {
        showToast(
          `${errorCount} file${errorCount > 1 ? 's' : ''} failed to convert`,
          'error'
        );
      }

      setFiles([]);
    },
    [showToast]
  );

  return (
    <div className="glass-panel rounded-2xl p-6 sm:p-8 flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-serif font-light tracking-wide text-white">{toolName}</h2>
        <p className="text-sm text-white/50 mt-1 font-light tracking-wide">{toolDescription}</p>
      </div>

      {/* Drag and Drop Zone */}
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
          Drop your files here
        </h3>
        <p className="text-sm text-white/50 text-center font-light tracking-wide">
          {acceptLabel} · Max 50MB
        </p>
      </div>

      {/* Browse files separator and button */}
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

      {/* Selected File List */}
      {files.length > 0 && (
        <div className="mt-2 border-t border-white/10 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs tracking-widest uppercase font-semibold text-white/80">
              Selected Files ({files.length})
            </h4>
            {files.length >= 2 && (
              <button
                type="button"
                onClick={clearAllFiles}
                className="text-xs font-semibold tracking-widest uppercase text-white/40 hover:text-white hover:underline transition-colors focus:outline-none"
              >
                Clear all
              </button>
            )}
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="flex flex-col gap-2"
          >
            <AnimatePresence>
              {files.map((f, index) => (
                <motion.div
                  key={`${f.name}-${f.size}-${index}`}
                  variants={itemVariants}
                  exit={{ opacity: 0, x: -20, transition: { duration: 0.15 } }}
                  layout
                  className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-3 shadow-sm hover:border-white/20 transition-colors"
                >
                  <div className="shrink-0">{getFileIcon(f.type)}</div>
                  <div className="flex-1 min-w-0 pr-2">
                    <p
                      className="font-light text-white text-sm truncate"
                      title={f.name}
                    >
                      {f.name}
                    </p>
                    <p className="text-xs text-white/50 mt-0.5 tracking-wider font-mono">
                      {formatBytes(f.size)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="text-white/40 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors focus:outline-none shrink-0"
                    title="Remove file"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
      )}

      {/* ConvertPanel handles format selection, convert button, and live status */}
      <ConvertPanel files={files} onConversionComplete={handleConversionComplete} />
    </div>
  );
}
