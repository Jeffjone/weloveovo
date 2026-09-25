export type Release = {
  id: string;
  title: string;
  release_date: string;
  cover_url: string | null;
  apple_url: string | null;
  featured: boolean;
  track_count?: number;
};
export type Track = {
  id: string;
  title: string;
  release_id: string;
  duration: string;
  bpm: number;
  musical_key: string;
  energy: number;
  dance: number;
  valence: number;
  acoustic: number;
  popularity: number;
  explicit: boolean;
  rank: number;
  artist_names: string[];
  artist_ids: string[];
  release_title: string;
  release_date: string;
  cover_url: string | null;
  apple_url: string | null;
  downloadable: boolean;
};
export type Era = {
  id: string;
  label: string;
  title: string;
  body: string;
  start_year: number;
  end_year: number;
  release_id: string;
  track_id: string | null;
  source_url: string;
  published: boolean;
  position: number;
  cover_url?: string | null;
};
export type Milestone = {
  id: string;
  title: string;
  body: string;
  year: number;
  era_id: string;
  source_url: string;
  published: boolean;
};
export type GraphNode = {
  id: string;
  kind: 'era' | 'release' | 'track' | 'artist' | 'milestone';
  label: string;
  description: string;
  href: string;
  x: number;
  y: number;
  image?: string | null;
};
export type GraphData = {
  nodes: GraphNode[];
  edges: { id: string; source: string; target: string; label?: string }[];
  root: string | null;
};
