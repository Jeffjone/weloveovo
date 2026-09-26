import { GameRoomGames } from '@/components/game-room';
import { PageHeader, ui } from '@/components/ui';
import { statistics } from '@/lib/catalog';
import { gameMode } from '@/lib/game-server';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'The game room' };
export default async function GameRoom({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const [stats, params] = await Promise.all([statistics(), searchParams]);
  const parsed = gameMode.safeParse(params.mode);
  return (
    <div className={ui.container}>
      <PageHeader
        number="05"
        eyebrow="The game room"
        title="Know it by heart."
        description="Turn a familiar sound into a familiar story. Learn the songs, the records, and the people in between."
      />
      <GameRoomGames total={stats.tracks} initialMode={parsed.success ? parsed.data : 'release'} />
    </div>
  );
}
