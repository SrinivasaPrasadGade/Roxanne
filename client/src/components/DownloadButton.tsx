import React, { useState, useCallback } from 'react';
import { Download, Check, Loader2 } from 'lucide-react';

interface DownloadButtonProps {
  jobId: string;
  filename?: string;
}

/**
 * DownloadButton — fetches the converted file from /api/download/{jobId},
 * creates a blob URL, triggers a programmatic <a> click, then shows a
 * "Downloaded!" confirmation for 3 seconds.
 */
export default function DownloadButton({ jobId, filename }: DownloadButtonProps) {
  const [state, setState] = useState<'idle' | 'downloading' | 'downloaded'>('idle');

  const handleDownload = useCallback(async () => {
    if (state !== 'idle') return;

    setState('downloading');

    try {
      const API_BASE = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${API_BASE}/api/download/${jobId}`);

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      // Programmatic download via <a> click
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename || `converted-${jobId}`;
      document.body.appendChild(anchor);
      anchor.click();

      // Cleanup
      document.body.removeChild(anchor);
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      setState('downloaded');
      setTimeout(() => setState('idle'), 3000);
    } catch (err) {
      console.error('Download error:', err);
      setState('idle');
    }
  }, [jobId, filename, state]);

  return (
    <button
      type="button"
      id={`download-btn-${jobId}`}
      onClick={handleDownload}
      disabled={state === 'downloading'}
      className={`
        w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl
        text-xs font-bold transition-all duration-300 focus:outline-none
        ${state === 'downloaded'
          ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 cursor-default'
          : state === 'downloading'
            ? 'bg-blue-50 border border-blue-200 text-blue-600 cursor-wait'
            : 'bg-white border border-slate-200 text-slate-700 hover:border-blue-400 hover:text-blue-600 hover:shadow-sm active:scale-[0.97]'
        }
      `}
    >
      {state === 'downloading' && (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Downloading…
        </>
      )}
      {state === 'downloaded' && (
        <>
          <Check className="w-3.5 h-3.5" />
          Downloaded!
        </>
      )}
      {state === 'idle' && (
        <>
          <Download className="w-3.5 h-3.5" />
          Download File
        </>
      )}
    </button>
  );
}
