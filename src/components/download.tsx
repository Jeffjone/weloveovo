'use client';
import { useState } from 'react';
import { Download } from 'lucide-react';
import s from './ui.module.css';
export function DownloadButton({ trackId }: { trackId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function download() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/tracks/${trackId}/download`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || 'The download is unavailable. Please retry.');
      const link = document.createElement('a');
      link.href = result.url;
      link.referrerPolicy = 'no-referrer';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'The download is unavailable. Please retry.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <button className={s.outlineButton} disabled={busy} onClick={() => void download()}>
        <Download size={15} />
        {busy ? 'Preparing download…' : error ? 'Retry download' : 'Download MP3'}
      </button>
      {error && (
        <p role="status" className={s.subtle}>
          {error}
        </p>
      )}
    </div>
  );
}
