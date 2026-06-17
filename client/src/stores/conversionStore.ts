import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { SupportedFormat } from '../../../shared/types';

export type QueueItemStatus = 'pending' | 'uploading' | 'converting' | 'done' | 'error';

export interface ConversionQueueItem {
  /** Internal queue ID (not the backend jobId) */
  queueId: string;
  file: File;
  targetFormat: SupportedFormat;
  status: QueueItemStatus;
  /** 0–100 upload progress */
  uploadProgress: number;
  /** 0–100 conversion progress (faked while waiting) */
  conversionProgress: number;
  /** Backend job ID returned after successful upload */
  jobId?: string;
  /** URL to download the converted file */
  downloadUrl?: string;
  /** Human-readable output filename */
  outputFilename?: string;
  /** Size of the output file in bytes */
  outputSize?: number;
  /** Error message if conversion failed */
  error?: string;
}

interface ConversionStore {
  queue: ConversionQueueItem[];

  /** Add files to the queue with their individual target formats */
  addToQueue: (items: { file: File; targetFormat: SupportedFormat }[]) => void;
  /** Update a queue item by its queueId */
  updateItem: (queueId: string, updates: Partial<ConversionQueueItem>) => void;
  /** Remove a specific item from the queue */
  removeItem: (queueId: string) => void;
  /** Clear all completed or errored items */
  clearFinished: () => void;
  /** Clear entire queue */
  clearAll: () => void;
  /** Reset an errored item back to pending for retry */
  retryItem: (queueId: string) => void;
}

export const useConversionStore = create<ConversionStore>((set) => ({
  queue: [],

  addToQueue: (items) =>
    set((state) => ({
      queue: [
        ...state.queue,
        ...items.map(({ file, targetFormat }) => ({
          queueId: uuidv4(),
          file,
          targetFormat,
          status: 'pending' as const,
          uploadProgress: 0,
          conversionProgress: 0,
        })),
      ],
    })),

  updateItem: (queueId, updates) =>
    set((state) => ({
      queue: state.queue.map((item) =>
        item.queueId === queueId ? { ...item, ...updates } : item
      ),
    })),

  removeItem: (queueId) =>
    set((state) => ({
      queue: state.queue.filter((item) => item.queueId !== queueId),
    })),

  clearFinished: () =>
    set((state) => ({
      queue: state.queue.filter(
        (item) => item.status !== 'done' && item.status !== 'error'
      ),
    })),

  clearAll: () => set({ queue: [] }),

  retryItem: (queueId) =>
    set((state) => ({
      queue: state.queue.map((item) =>
        item.queueId === queueId
          ? {
              ...item,
              status: 'pending' as const,
              uploadProgress: 0,
              conversionProgress: 0,
              error: undefined,
              jobId: undefined,
              downloadUrl: undefined,
              outputFilename: undefined,
              outputSize: undefined,
            }
          : item
      ),
    })),
}));
