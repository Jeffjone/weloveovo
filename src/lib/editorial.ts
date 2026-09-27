import { query } from './db';
export type Story = {
  id: string;
  title: string;
  body: string;
  source_url: string;
  published: boolean;
};
export async function story(id: 'home' | 'legacy') {
  return (await query<Story>('SELECT * FROM stories WHERE id=$1 AND published', [id]))[0] || null;
}
export async function songNote(id: string) {
  return (
    (await query<Story>('SELECT * FROM song_notes WHERE id=$1 AND published', [id]))[0] || null
  );
}
export async function homepageFeatures() {
  return query<{ id: string; release_id: string; title: string; cover_url: string | null }>(
    'SELECT f.id,f.release_id,r.title,r.cover_url FROM homepage_features f JOIN releases r ON r.id=f.release_id WHERE f.published',
  );
}
