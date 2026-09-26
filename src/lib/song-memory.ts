export type NamedSong = { id: string; title: string; key: string };
export const fanLevels = [
  { count: 0, title: 'First listen' },
  { count: 5, title: 'In rotation' },
  { count: 15, title: 'After-hours regular' },
  { count: 30, title: 'Deep-cut explorer' },
  { count: 60, title: 'OVO archivist' },
  { count: 100, title: 'Walking discography' },
  { count: 200, title: 'Legend of the 6' },
];
export function fanLevel(count: number) {
  return fanLevels.findLast((level) => count >= level.count) || fanLevels[0];
}
