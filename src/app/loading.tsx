import { ui } from '@/components/ui';
export default function Loading() {
  return (
    <div className={ui.container} role="status">
      <p className={ui.eyebrow}>ENTERING THE ROOM</p>
      <div className={ui.skeleton} />
      <p className="sr-only">Loading the archive…</p>
    </div>
  );
}
