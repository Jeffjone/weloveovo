import Link from 'next/link';
import { ui } from '@/components/ui';
export default function NotFound() {
  return (
    <div className={ui.container}>
      <div className={ui.empty}>
        <p className={ui.eyebrow}>404 / OFF THE RECORD</p>
        <h1>This room isn’t on the map.</h1>
        <p>The link may have changed, or this chapter is not published yet.</p>
        <Link className={ui.primaryButton} href="/">
          Return to the lobby
        </Link>
      </div>
    </div>
  );
}
