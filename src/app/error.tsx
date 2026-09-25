'use client';
import { ui } from '@/components/ui';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className={ui.container}>
      <div className={ui.empty}>
        <h2>A moment of silence.</h2>
        <p>
          The archive could not be reached. Your collection is still here. Try the connection again.
        </p>
        <button className={ui.primaryButton} onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
