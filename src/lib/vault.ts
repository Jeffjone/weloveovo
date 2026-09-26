import { z } from 'zod';
import { query } from './db';
import { searchTracks } from './catalog';
export const vaultCategories = {
  unreleased: 'Unreleased / references',
  leaked: 'Leaks',
  snippet: 'Snippets',
  freestyle: 'Unrecorded freestyle references',
};
export const vaultSearch = z.object({
  q: z.string().trim().max(120).default(''),
  category: z.enum(['', 'unreleased', 'leaked', 'snippet', 'freestyle']).default(''),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
export type VaultEntry = {
  track_id: string;
  category: keyof typeof vaultCategories;
  note: string;
  source_url: string;
};
export async function vaultTracks(input: z.input<typeof vaultSearch>) {
  const filters = vaultSearch.parse(input);
  const entries = await query<VaultEntry>(
    "SELECT * FROM vault_entries WHERE ($1='' OR category=$1) ORDER BY track_id",
    [filters.category],
  );
  const results = await searchTracks({
    q: filters.q,
    page: filters.page,
    sort: 'title',
    ids: entries.map((e) => e.track_id).join(','),
  });
  return { ...results, entries: Object.fromEntries(entries.map((e) => [e.track_id, e])) };
}
