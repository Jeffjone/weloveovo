export type NamedSong = { id: string; title: string; key: string };
export const fanLevels = [
  { count: 0, title: 'First Listen' },
  { count: 5, title: 'In Rotation' },
  { count: 15, title: 'After-hours Regular' },
  { count: 30, title: 'Deep-cut Explorer' },
  { count: 60, title: 'OVO Archivist' },
  { count: 100, title: 'Walking Discography' },
  { count: 200, title: 'Legend of the 6' },
];
export function fanLevel(count: number) {
  return fanLevels.findLast((level) => count >= level.count) || fanLevels[0];
}
