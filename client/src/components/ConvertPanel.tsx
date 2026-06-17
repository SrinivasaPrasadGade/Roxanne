import React, { useState, useCallback, useRef } from 'react';
import { ArrowRightLeft, Loader2, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SupportedFormat, ConversionResult } from '../../../shared/types';
import { useConversionStore } from '../stores/conversionStore';
import { useConversion } from '../hooks/useConversion';
import ConversionStatus from './ConversionStatus';

// ── Format mapping by MIME type ─────────────────────────────────────────────

type FormatOption = { value: SupportedFormat; label: string };

const FORMAT_MAP: Record<string, FormatOption[]> = {
  'application/pdf': [
    { value: 'docx', label: 'Word (.docx)' },
    { value: 'pptx', label: 'PowerPoint (.pptx)' },
    { value: 'xlsx', label: 'Excel (.xlsx)' },
    { value: 'jpg', label: 'JPG Image (.jpg)' },
    { value: 'png', label: 'PNG Image (.png)' },
  ],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    { value: 'pdf', label: 'PDF (.pdf)' },
  ],
  'application/msword': [
    { value: 'pdf', label: 'PDF (.pdf)' },
  ],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': [
    { value: 'pdf', label: 'PDF (.pdf)' },
    { value: 'jpg', label: 'JPG Image (.jpg)' },
    { value: 'png', label: 'PNG Image (.png)' },
  ],
  'application/vnd.ms-powerpoint': [
    { value: 'pdf', label: 'PDF (.pdf)' },
  ],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
    { value: 'pdf', label: 'PDF (.pdf)' },
  ],
  'application/vnd.ms-excel': [
    { value: 'pdf', label: 'PDF (.pdf)' },
  ],
  'image/jpeg': [
    { value: 'pdf', label: 'PDF (.pdf)' },
    { value: 'png', label: 'PNG Image (.png)' },
  ],
  'image/png': [
    { value: 'pdf', label: 'PDF (.pdf)' },
    { value: 'jpg', label: 'JPG Image (.jpg)' },
  ],
};

/** Fallback options for unknown MIME types */
const DEFAULT_FORMATS: FormatOption[] = [
  { value: 'pdf', label: 'PDF (.pdf)' },
];

function getFormatsForFile(file: File): FormatOption[] {
  return FORMAT_MAP[file.type] || DEFAULT_FORMATS;
}

// ── Props ───────────────────────────────────────────────────────────────────

interface ConvertPanelProps {
  files: File[];
  onConversionComplete: (results: ConversionResult[]) => void;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function ConvertPanel({ files, onConversionComplete }: ConvertPanelProps) {
  // Per-file target format selections: file index → target format
  const [formatSelections, setFormatSelections] = useState<Record<number, SupportedFormat>>({});
  const [isConverting, setIsConverting] = useState(false);
  const { addToQueue, queue } = useConversionStore();
  const { convert } = useConversion();
  const resultsRef = useRef<ConversionResult[]>([]);

  const getSelectedFormat = useCallback(
    (index: number, file: File): SupportedFormat => {
      if (formatSelections[index]) return formatSelections[index];
      const options = getFormatsForFile(file);
      return options[0]?.value ?? 'pdf';
    },
    [formatSelections]
  );

  const handleFormatChange = useCallback((index: number, format: SupportedFormat) => {
    setFormatSelections((prev) => ({ ...prev, [index]: format }));
  }, []);

  /**
   * Convert files sequentially (one at a time) to avoid server overload.
   * After all files have been processed, fire onConversionComplete.
   */
  const handleConvert = useCallback(async () => {
    if (files.length === 0 || isConverting) return;

    setIsConverting(true);
    resultsRef.current = [];

    // Build queue items
    const items = files.map((file, idx) => ({
      file,
      targetFormat: getSelectedFormat(idx, file),
    }));

    // Add all to the Zustand queue first (so they appear in the status panel)
    addToQueue(items);

    // Wait a tick so the store updates and we can read the queueIds
    await new Promise((r) => setTimeout(r, 50));

    // Grab the newly-added queue IDs (they are the last N items)
    const currentQueue = useConversionStore.getState().queue;
    const newItems = currentQueue.slice(-items.length);

    // Process sequentially
    for (let i = 0; i < newItems.length; i++) {
      const queueItem = newItems[i];
      try {
        const response = await convert(
          queueItem.queueId,
          queueItem.file,
          queueItem.targetFormat
        );
        resultsRef.current.push({
          fileName: queueItem.file.name,
          targetFormat: queueItem.targetFormat,
          status: 'success',
          jobId: response.jobId,
          downloadUrl: response.downloadUrl,
          outputFilename: response.filename,
          outputSize: response.size,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        resultsRef.current.push({
          fileName: queueItem.file.name,
          targetFormat: queueItem.targetFormat,
          status: 'error',
          error: message,
        });
      }
    }

    setIsConverting(false);
    onConversionComplete(resultsRef.current);
  }, [files, isConverting, getSelectedFormat, addToQueue, convert, onConversionComplete]);

  const activeCount = queue.filter(
    (q) => q.status === 'uploading' || q.status === 'converting'
  ).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Per-file format selectors */}
      {files.length > 0 && (
        <div className="flex flex-col gap-3">
          <h4 className="text-xs tracking-widest uppercase font-semibold text-white/80">
            Target Formats
          </h4>
          <motion.div
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: { opacity: 1, transition: { staggerChildren: 0.06 } },
            }}
            className="flex flex-col gap-2"
          >
            <AnimatePresence>
              {files.map((file, idx) => {
                const options = getFormatsForFile(file);
                const selected = getSelectedFormat(idx, file);

                return (
                  <motion.div
                    key={`${file.name}-${file.size}-${idx}`}
                    variants={{
                      hidden: { opacity: 0, y: 8 },
                      show: { opacity: 1, y: 0 },
                    }}
                    exit={{ opacity: 0, x: -16, transition: { duration: 0.15 } }}
                    layout
                    className="flex items-center gap-3 bg-white/5 border border-white/10 hover:border-white/20 transition-colors rounded-xl p-3 shadow-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-light tracking-wide text-white truncate"
                        title={file.name}
                      >
                        {file.name}
                      </p>
                    </div>

                    {/* Arrow indicator */}
                    <ArrowRightLeft className="w-4 h-4 text-white/20 shrink-0" />

                    {/* Format dropdown */}
                    <div className="relative shrink-0">
                      <select
                        id={`format-select-${idx}`}
                        value={selected}
                        onChange={(e) =>
                          handleFormatChange(idx, e.target.value as SupportedFormat)
                        }
                        disabled={isConverting}
                        className="appearance-none bg-white/5 border border-white/20 rounded-lg px-3 py-1.5 pr-7 text-xs font-bold tracking-widest uppercase text-white cursor-pointer hover:border-white/40 focus:border-white focus:ring-2 focus:ring-white/20 transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {options.map((opt) => (
                          <option key={opt.value} value={opt.value} className="text-black">
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/50 pointer-events-none" />
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        </div>
      )}

      {/* Convert button */}
      <button
        id="convert-btn"
        type="button"
        disabled={files.length === 0 || isConverting}
        onClick={handleConvert}
        className={`
          w-full py-3.5 px-5 rounded-xl font-bold tracking-widest uppercase text-xs
          flex items-center justify-center gap-2 transition-all focus:outline-none
          ${
            files.length === 0 || isConverting
              ? 'bg-white/10 border-white/10 shadow-none cursor-not-allowed text-white/40'
              : 'bg-white hover:bg-white/90 text-black shadow-xl hover:shadow-2xl active:scale-[0.98]'
          }
        `}
      >
        {isConverting ? (
          <>
            <Loader2 className="w-4.5 h-4.5 animate-spin" />
            Converting {activeCount > 0 ? `(${activeCount} active)` : '…'}
          </>
        ) : (
          <>
            <ArrowRightLeft className="w-4.5 h-4.5" />
            Convert{' '}
            {files.length > 0
              ? `${files.length} Document${files.length > 1 ? 's' : ''}`
              : 'Documents'}
          </>
        )}
      </button>

      {/* Live conversion status feed */}
      {queue.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs tracking-widest uppercase font-semibold text-white/80">Conversion Progress</h4>
            <span className="text-[10px] tracking-widest uppercase font-semibold text-white/50 bg-white/10 px-2 py-0.5 rounded-full">
              {queue.length} item{queue.length !== 1 ? 's' : ''}
            </span>
          </div>
          <ConversionStatus />
        </div>
      )}
    </div>
  );
}
