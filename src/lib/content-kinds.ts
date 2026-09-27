export const editorialKinds = [
  'eras',
  'milestones',
  'connections',
  'stories',
  'song_notes',
  'homepage_features',
  'era_releases',
  'vault_entries',
] as const;
export const contentLabels: Record<string, string> = {
  tracks: 'Songs',
  releases: 'Records',
  artists: 'Artists',
  eras: 'Eras',
  milestones: 'Milestones',
  connections: 'Connections',
  stories: 'Page Stories',
  song_notes: 'Song Notes',
  homepage_features: 'Homepage Artwork',
  era_releases: 'Era Records',
  vault_entries: 'Vault',
  audio: 'Audio',
};
