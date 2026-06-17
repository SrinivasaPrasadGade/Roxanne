import React, { useState, useCallback } from 'react';
import { UploadCloud, X, Download, FileText, LockOpen, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { motion } from 'framer-motion';
import { useOutletContext } from 'react-router-dom';
import type { LayoutContext } from './Layout';
import { useConversion } from '../hooks/useConversion';
import { useConversionStore } from '../stores/conversionStore';

interface UnlockPdfWorkspaceProps {
  acceptFormats: Record<string, string[]>;
  toolName: string;
  toolDescription: string;
  acceptLabel: string;
}

export default function UnlockPdfWorkspace({
  acceptFormats,
  toolName,
  toolDescription,
  acceptLabel,
}: UnlockPdfWorkspaceProps) {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentQueueId, setCurrentQueueId] = useState<string | null>(null);
  
  const { convert } = useConversion();
  const { queue, addToQueue } = useConversionStore();
  const { showToast } = useOutletContext<LayoutContext>();

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        setFile(acceptedFiles[0]);
        setPassword('');
        setCurrentQueueId(null);
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
    setPassword('');
    setCurrentQueueId(null);
  };

  const handleUnlock = async () => {
    if (!file) return;

    if (!password.trim()) {
      showToast('Please enter the PDF password to unlock it.', 'error');
      return;
    }

    setIsProcessing(true);

    // 1. Create a queue item using the store
    const item = {
      file,
      targetFormat: 'pdf' as const,
      toolSlug: 'unlock-pdf',
    };
    
    // We add to queue first
    addToQueue([item]);
    await new Promise((r) => setTimeout(r, 50));
    
    // Find the newly added item in the store
    const currentQueue = useConversionStore.getState().queue;
    const addedItem = currentQueue[currentQueue.length - 1];
    const queueId = addedItem.queueId;
    setCurrentQueueId(queueId);

    try {
      await convert(
        queueId,
        file,
        'pdf',
        'unlock-pdf',
        { password }
      );
      showToast('PDF unlocked successfully!', 'success');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Error unlocking PDF', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Find the current item status in the queue
  const currentItem = queue.find((q) => q.queueId === currentQueueId);

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
              Drop your locked PDF here
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
              disabled={isProcessing}
              className="p-2 hover:bg-white/10 rounded-full transition-colors focus:outline-none disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <X className="w-5 h-5 text-white/50 hover:text-white" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Password input card */}
            <div className="flex flex-col gap-4 bg-white/[0.02] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-xl">
              <div>
                <h3 className="text-sm tracking-widest uppercase font-semibold text-white/90 mb-1">
                  Unlock Settings
                </h3>
                <p className="text-xs text-white/40 font-light">Enter the current password to remove protection</p>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold tracking-wider text-white/70 uppercase">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isProcessing || currentItem?.status === 'done'}
                    placeholder="Enter PDF password..."
                    className="w-full bg-white/5 border border-white/20 text-white rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:border-white transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleUnlock}
                disabled={isProcessing || !password.trim() || currentItem?.status === 'done'}
                className="w-full mt-2 py-3 px-5 rounded-xl bg-white hover:bg-white/90 text-black font-bold tracking-widest uppercase text-xs flex items-center justify-center gap-2 transition-all shadow-xl hover:shadow-2xl active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LockOpen className="w-4 h-4" />
                {isProcessing ? 'Unlocking...' : 'Unlock PDF'}
              </button>
            </div>

            {/* Status / Output Section */}
            <div className="flex flex-col gap-4">
              {currentItem && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 sm:p-6 flex flex-col gap-4">
                  <h4 className="text-xs tracking-widest uppercase font-semibold text-white/80">
                    Status Information
                  </h4>

                  {/* Upload/Conversion Progress bar */}
                  {(currentItem.status === 'uploading' || currentItem.status === 'converting') && (
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between text-xs text-white/60">
                        <span>
                          {currentItem.status === 'uploading' ? 'Uploading PDF...' : 'Removing protection...'}
                        </span>
                        <span className="font-mono">
                          {currentItem.status === 'uploading'
                            ? `${currentItem.uploadProgress}%`
                            : `${currentItem.conversionProgress}%`}
                        </span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-white h-full transition-all duration-200"
                          style={{
                            width: `${
                              currentItem.status === 'uploading'
                                ? currentItem.uploadProgress
                                : currentItem.conversionProgress
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Done State */}
                  {currentItem.status === 'done' && currentItem.downloadUrl && (
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-2 text-white/80 text-xs">
                        <LockOpen className="w-4 h-4 text-emerald-400" />
                        <span>PDF unlocked — no password required to open!</span>
                      </div>
                      
                      <a
                        href={`${import.meta.env.VITE_API_URL || ''}${currentItem.downloadUrl}`}
                        download={currentItem.outputFilename || 'unlocked.pdf'}
                        className="w-full py-3 px-5 rounded-xl bg-white hover:bg-white/95 text-black font-bold tracking-widest uppercase text-xs flex items-center justify-center gap-2 transition-all shadow-lg group"
                      >
                        <Download className="w-4 h-4 text-black/60 group-hover:text-black transition-colors" />
                        Download Unlocked PDF
                      </a>
                    </div>
                  )}

                  {/* Error State */}
                  {currentItem.status === 'error' && (
                    <div className="text-xs text-red-400 font-medium bg-red-500/10 border border-red-500/20 p-3 rounded-lg flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                      <span>{currentItem.error || 'Failed to unlock PDF. Check your password and try again.'}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
