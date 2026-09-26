import Link from 'next/link';
import { PageHeader, ui } from '@/components/ui';
import { SongCards } from '@/components/song-cards';
import { vaultTracks, vaultSearch, vaultCategories } from '@/lib/vault';
import s from './vault.module.css';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'The vault' };
export default async function Vault({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsed = vaultSearch.safeParse(await searchParams);
  const filters = parsed.success ? parsed.data : vaultSearch.parse({});
  const result = await vaultTracks(filters);
  const pageLink = (page: number) =>
    '/vault?' +
    new URLSearchParams({ q: filters.q, category: filters.category, page: String(page) });
  return (
    <div className={ui.container}>
      <PageHeader
        number="06"
        eyebrow="The vault"
        title="Beyond the official record."
        description="Unreleased recordings, leaks, snippets, and unrecorded freestyle references. A place for the fragments and unfinished stories."
      />
      <p className={s.note}>
        The vault is being prepared. No entries have been added yet. This space will hold unreleased
        recordings, leaks, snippets, and unrecorded freestyle references, with source context and
        clear audio availability.
      </p>
      {!parsed.success && (
        <p role="alert" className={ui.error}>
          Some filters were invalid. Showing the full vault.
        </p>
      )}
      <form action="/vault" className={s.filters}>
        <label>
          Search the vault
          <input
            type="search"
            name="q"
            defaultValue={filters.q}
            maxLength={120}
            placeholder="A title you remember…"
          />
        </label>
        <label>
          Material type
          <select name="category" defaultValue={filters.category}>
            <option value="">All material</option>
            {Object.entries(vaultCategories).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className={ui.primaryButton}>Search vault</button>
        <Link className={ui.outlineButton} href="/vault">
          Reset
        </Link>
      </form>
      <div className={ui.sectionBar}>
        <h2>
          {result.total} {result.total === 1 ? 'entry' : 'entries'}
        </h2>
        <span>
          Page {result.page} of {result.pages}
        </span>
      </div>
      {result.total ? (
        <SongCards tracks={result.tracks} vaultEntries={result.entries} />
      ) : (
        <div className={s.empty}>
          <h2>Nothing filed here yet.</h2>
          <p>
            Try another category or clear your search. This drawer is ready for future additions.
          </p>
          <Link href="/vault">View all vault entries ↗</Link>
        </div>
      )}
      <nav aria-label="Vault pages" className={ui.actions}>
        {result.page > 1 && (
          <Link href={pageLink(result.page - 1)} className={ui.outlineButton}>
            Previous page
          </Link>
        )}
        {result.page < result.pages && (
          <Link href={pageLink(result.page + 1)} className={ui.outlineButton}>
            Next page
          </Link>
        )}
      </nav>
    </div>
  );
}
