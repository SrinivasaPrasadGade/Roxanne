import { useCallback, useRef } from 'react';
import axios, { CancelTokenSource } from 'axios';
import type { SupportedFormat, ConversionResponse } from '../../../shared/types';
import { useConversionStore } from '../stores/conversionStore';

/**
 * Custom hook that handles a single file conversion:
 * 1. Uploads the file via XMLHttpRequest (for upload progress tracking)
 * 2. Fakes conversion progress from 0→80% while waiting for the response
 * 3. Jumps to 100% on completion
 *
 * Returns a `convert` function and a `cancel` function.
 */
export function useConversion() {
  const { updateItem } = useConversionStore();
  const cancelRef = useRef<CancelTokenSource | null>(null);
  const fakeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopFakeProgress = () => {
    if (fakeTimerRef.current) {
      clearInterval(fakeTimerRef.current);
      fakeTimerRef.current = null;
    }
  };

  /**
   * Convert a single file. Updates the Zustand store as progress changes.
   * Returns the ConversionResponse on success or throws on failure.
   */
  const convert = useCallback(
    async (
      queueId: string,
      file: File,
      targetFormat: SupportedFormat
    ): Promise<ConversionResponse> => {
      const source = axios.CancelToken.source();
      cancelRef.current = source;

      // Mark as uploading
      updateItem(queueId, {
        status: 'uploading',
        uploadProgress: 0,
        conversionProgress: 0,
        error: undefined,
      });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('targetFormat', targetFormat);

      const API_BASE = import.meta.env.VITE_API_URL || '';

      try {
        // Phase 1: Upload with progress tracking via axios
        const response = await axios.post<ConversionResponse>(
          `${API_BASE}/api/convert`,
          formData,
          {
            cancelToken: source.token,
            onUploadProgress: (progressEvent) => {
              const total = progressEvent.total ?? file.size;
              const percent = Math.round((progressEvent.loaded / total) * 100);
              updateItem(queueId, { uploadProgress: percent });

              // Switch to "converting" once upload reaches 100%
              if (percent >= 100) {
                updateItem(queueId, {
                  status: 'converting',
                  uploadProgress: 100,
                });

                // Phase 2: Fake conversion progress 0→80% while waiting
                let fakeProgress = 0;
                fakeTimerRef.current = setInterval(() => {
                  fakeProgress = Math.min(fakeProgress + Math.random() * 8, 80);
                  updateItem(queueId, {
                    conversionProgress: Math.round(fakeProgress),
                  });
                }, 300);
              }
            },
          }
        );

        // Phase 3: Done — stop fake timer, set to 100%
        stopFakeProgress();

        updateItem(queueId, {
          status: 'done',
          conversionProgress: 100,
          jobId: response.data.jobId,
          downloadUrl: response.data.downloadUrl,
          outputFilename: response.data.filename,
          outputSize: response.data.size,
        });

        return response.data;
      } catch (err: unknown) {
        stopFakeProgress();

        if (axios.isCancel(err)) {
          updateItem(queueId, {
            status: 'error',
            error: 'Conversion cancelled',
          });
          throw new Error('Conversion cancelled', { cause: err });
        }

        let errorMessage = 'Conversion failed';
        if (axios.isAxiosError(err) && err.response?.data) {
          const data = err.response.data as { error?: string };
          errorMessage = data.error || err.message;
        } else if (err instanceof Error) {
          errorMessage = err.message;
        }

        updateItem(queueId, {
          status: 'error',
          error: errorMessage,
        });

        throw new Error(errorMessage, { cause: err });
      }
    },
    [updateItem]
  );

  const cancel = useCallback(() => {
    stopFakeProgress();
    cancelRef.current?.cancel('User cancelled conversion');
  }, []);

  return { convert, cancel };
}
