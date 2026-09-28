'use client';
import { useState } from 'react';
import { Disc3 } from 'lucide-react';
import s from './ui.module.css';
export function Cover({
  release,
  className = '',
}: {
  release: { cover_url: string | null; title: string };
  className?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  return release.cover_url && failed !== release.cover_url ? (
    <img
      className={className}
      src={release.cover_url}
      alt={`${release.title} cover`}
      width="600"
      height="600"
      loading="lazy"
      onError={() => setFailed(release.cover_url)}
    />
  ) : (
    <span
      className={`${s.coverFallback} ${className}`}
      role="img"
      aria-label={`${release.title} artwork unavailable`}
    >
      <Disc3 aria-hidden="true" />
      <small>{release.title}</small>
    </span>
  );
}
