import React from 'react';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  UploadCloud,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useConversionStore, type ConversionQueueItem } from '../stores/conversionStore';
import DownloadButton from './DownloadButton';

/**
 * ConversionStatus — renders the real-time progress for every queue item:
 * - Pending:    gray circle + filename
 * - Uploading:  blue circle + upload progress bar
 * - Converting: spinning blue circle + "Converting…" + faked progress bar
 * - Done:       green checkmark + DownloadButton
 * - Error:      red X + error message + "Retry" button
 */
export default function ConversionStatus() {
  const { queue, retryItem } = useConversionStore();

  if (queue.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <AnimatePresence mode="popLayout">
        {queue.map((item) => (
          <motion.div
            key={item.queueId}
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: -30, scale: 0.95, transition: { duration: 0.2 } }}
            layout
            className="border border-white/10 rounded-xl p-4 bg-white/5 hover:bg-white/10 transition-colors relative overflow-hidden"
          >
            <StatusRow item={item} onRetry={retryItem} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ── Individual row ────────────────────────────────────────────────────────────

function StatusRow({
  item,
  onRetry,
}: {
  item: ConversionQueueItem;
  onRetry: (queueId: string) => void;
}) {
  const { queueId, file, targetFormat, status, uploadProgress, conversionProgress } = item;

  return (
    <div className="flex flex-col gap-2.5">
      {/* Header: icon + filename + badge */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <StatusIcon status={status} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-light tracking-wide text-white truncate" title={file.name}>
              {file.name}
            </p>
            <p className="text-[10px] text-white/50 mt-0.5 tracking-widest uppercase">
              → {targetFormat}
              {item.outputSize != null && (
                <span className="ml-1.5 text-white/50 font-mono tracking-wider">
                  · {formatBytes(item.outputSize)}
                </span>
              )}
            </p>
          </div>
        </div>

        <StatusBadge status={status} />
      </div>

      {/* Progress bar for uploading/converting */}
      {(status === 'uploading' || status === 'converting') && (
        <div className="w-full">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-widest font-medium text-white/50">
              {status === 'uploading' ? 'Uploading…' : 'Converting…'}
            </span>
            <span className="text-[10px] font-bold text-white font-mono">
              {status === 'uploading' ? `${uploadProgress}%` : `${conversionProgress}%`}
            </span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-1 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-white"
              initial={{ width: 0 }}
              animate={{
                width: `${status === 'uploading' ? uploadProgress : conversionProgress}%`,
              }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>
        </div>
      )}

      {/* Download button on success */}
      {status === 'done' && item.jobId && (
        <DownloadButton jobId={item.jobId} filename={item.outputFilename} />
      )}

      {/* Error block */}
      {status === 'error' && (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-red-500/10 border border-red-500/20 rounded-lg p-2">
            <p className="text-[11px] text-red-200 font-medium leading-tight">
              {item.error || 'Conversion failed'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRetry(queueId)}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-widest font-bold bg-white/10 border border-white/20 text-white/80 hover:bg-white/20 hover:text-white transition-all active:scale-[0.95] focus:outline-none"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: ConversionQueueItem['status'] }) {
  switch (status) {
    case 'pending':
      return (
        <div className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
          <Clock className="w-3.5 h-3.5 text-white/40" />
        </div>
      );
    case 'uploading':
      return (
        <div className="w-7 h-7 rounded-full bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
          <UploadCloud className="w-3.5 h-3.5 text-white" />
        </div>
      );
    case 'converting':
      return (
        <div className="w-7 h-7 rounded-full bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
          <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
        </div>
      );
    case 'done':
      return (
        <div className="w-7 h-7 rounded-full bg-white/20 border border-white/30 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
          <CheckCircle2 className="w-3.5 h-3.5 text-white" />
        </div>
      );
    case 'error':
      return (
        <div className="w-7 h-7 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center shrink-0">
          <XCircle className="w-3.5 h-3.5 text-red-300" />
        </div>
      );
  }
}

function StatusBadge({ status }: { status: ConversionQueueItem['status'] }) {
  const config = {
    pending: {
      bg: 'bg-white/5',
      text: 'text-white/50',
      border: 'border-white/10',
      label: 'Queued',
    },
    uploading: {
      bg: 'bg-white/10',
      text: 'text-white',
      border: 'border-white/20',
      label: 'Uploading',
    },
    converting: {
      bg: 'bg-white/10',
      text: 'text-white',
      border: 'border-white/20',
      label: 'Converting',
    },
    done: {
      bg: 'bg-white/20',
      text: 'text-white',
      border: 'border-white/30',
      label: 'Complete',
    },
    error: {
      bg: 'bg-red-500/20',
      text: 'text-red-200',
      border: 'border-red-500/40',
      label: 'Failed',
    },
  };

  const c = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${c.bg} ${c.text} border ${c.border} shrink-0`}
    >
      {(status === 'uploading' || status === 'converting') && (
        <Loader2 className="w-2.5 h-2.5 animate-spin" />
      )}
      {c.label}
    </span>
  );
}

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
