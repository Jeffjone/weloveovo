'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload } from 'tus-js-client';
import { UploadCloud, Check, LogOut, Eye, Save, Plus } from 'lucide-react';
import { suggestTracks } from '@/lib/audio';
import { ui } from './ui';
import s from './curator.module.css';
type Row = Record<string, unknown>;
type Content = Record<string, Row[]>;
const fields: Record<string, string[]> = {
  tracks: [
    'title',
    'bpm',
    'musical_key',
    'energy',
    'dance',
    'valence',
    'acoustic',
    'popularity',
    'explicit',
  ],
  releases: ['title', 'release_date', 'featured'],
  artists: ['name'],
  eras: [
    'id',
    'label',
    'title',
    'body',
    'start_year',
    'end_year',
    'release_id',
    'track_id',
    'source_url',
    'position',
  ],
  milestones: ['id', 'title', 'body', 'year', 'era_id', 'source_url'],
  connections: ['source', 'target', 'label'],
};
const numeric = new Set([
  'bpm',
  'energy',
  'dance',
  'valence',
  'acoustic',
  'popularity',
  'start_year',
  'end_year',
  'year',
  'position',
]);
async function post(url: string, data: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'The request failed.');
  return result;
}
export function CuratorLogin({ expired = false }: { expired?: boolean }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState(
    expired ? 'That sign-in link expired. Request a new one.' : '',
  );
  const [busy, setBusy] = useState(false);
  return (
    <form
      className={s.login}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const result = await post('/api/admin/login', { email });
          setMessage(result.message);
        } catch (e) {
          setMessage((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className={ui.eyebrow}>INVITATION ONLY</p>
      <h2>The curator’s room.</h2>
      <p>Sign in to look after the records, the stories, and the connections between them.</p>
      <label>
        Your curator email
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </label>
      <button className={ui.primaryButton} disabled={busy}>
        {busy ? 'Sending…' : 'Send sign-in link'}
      </button>
      <p role="status">{message}</p>
    </form>
  );
}
export function Curator({ initial }: { initial: Content }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [kind, setKind] = useState('tracks');
  const [selected, setSelected] = useState('');
  const [record, setRecord] = useState<Row | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  async function refresh() {
    const r = await fetch('/api/admin/content', { cache: 'no-store' });
    if (!r.ok) throw new Error('Could not refresh the curator collection.');
    setData(await r.json());
  }
  function choose(id: string) {
    setSelected(id);
    const draft = data.drafts.find((d) => d.kind === kind && d.entity_id === id);
    setRecord(draft ? (draft.content as Row) : { ...data[kind].find((r) => r.id === id) });
    setPreview(false);
  }
  function changeKind(value: string) {
    setKind(value);
    setSelected('');
    setRecord(null);
    setMessage('');
    setPreview(false);
  }
  async function save(action: string) {
    if (!record) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await post('/api/admin/content', { kind, action, record });
      await refresh();
      setSelected(result.id || selected);
      if (result.id) setRecord((current) => (current ? { ...current, id: result.id } : current));
      setMessage(
        action === 'draft'
          ? 'Draft saved. The published version is unchanged.'
          : action === 'unpublish'
            ? 'Removed from public view.'
            : 'Changes published.',
      );
      router.refresh();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const editorial = ['eras', 'milestones', 'connections'].includes(kind);
  const items = [
    ...(data[kind] || []),
    ...data.drafts
      .filter((d) => d.kind === kind && !data[kind]?.some((r) => r.id === d.entity_id))
      .map((d) => d.content as Row),
  ];
  function create() {
    const base: Row = { published: false };
    if (kind === 'milestones')
      Object.assign(base, {
        id: '',
        title: '',
        body: '',
        year: new Date().getFullYear(),
        era_id: String(data.eras[0]?.id || ''),
        source_url: '',
      });
    if (kind === 'connections') Object.assign(base, { source: '', target: '', label: 'Connected' });
    setRecord(base);
    setSelected('new');
  }
  return (
    <>
      <div className={s.adminBar}>
        <span>CATALOG & EDITORIAL STUDIO</span>
        <button
          onClick={async () => {
            try {
              await post('/api/admin/logout', {});
              router.refresh();
            } catch (e) {
              setMessage((e as Error).message);
            }
          }}
        >
          <LogOut size={13} />
          Sign out
        </button>
      </div>
      <div className={s.tabs}>
        {['tracks', 'releases', 'artists', 'eras', 'milestones', 'connections', 'audio'].map(
          (tab) => (
            <button key={tab} aria-pressed={kind === tab} onClick={() => changeKind(tab)}>
              {tab}
            </button>
          ),
        )}
      </div>
      {kind === 'audio' ? (
        <AudioManager tracks={data.tracks} assets={data.audio} onRefresh={refresh} />
      ) : (
        <div className={s.editor}>
          <aside>
            <label>
              Select {kind}
              <select value={selected} onChange={(e) => choose(e.target.value)}>
                <option value="">Choose a record…</option>
                {items.map((r) => (
                  <option value={String(r.id)} key={String(r.id)}>
                    {String(r.title || r.name || r.label || r.id)}
                    {data.drafts.some((d) => d.kind === kind && d.entity_id === r.id)
                      ? ' · DRAFT'
                      : ''}
                  </option>
                ))}
              </select>
            </label>
            {['milestones', 'connections'].includes(kind) && (
              <button className={ui.outlineButton} onClick={create}>
                <Plus size={13} />
                Create new
              </button>
            )}
            <p>Drafts stay private. Publishing makes an editorial change visible to everyone.</p>
            <p>
              Connection references use an entity type and ID, for example{' '}
              <code>era:the-blue-hour</code>.
            </p>
          </aside>
          <div>
            {record ? (
              <>
                <div className={s.formHeading}>
                  <h2>{String(record.title || record.name || record.label || 'New connection')}</h2>
                  {editorial && (
                    <button onClick={() => setPreview(!preview)} className={ui.outlineButton}>
                      <Eye size={13} />
                      {preview ? 'Edit' : 'Preview'}
                    </button>
                  )}
                </div>
                {preview ? (
                  <article className={s.preview}>
                    <span>{String(record.start_year || record.year || '')}</span>
                    <h2>{String(record.title || record.label || 'Connection')}</h2>
                    <p>{String(record.body || `${record.source} → ${record.target}`)}</p>
                    {typeof record.source_url === 'string' && (
                      <span className={ui.source}>{record.source_url}</span>
                    )}
                  </article>
                ) : (
                  <div className={s.formFields}>
                    {fields[kind].map((field) => (
                      <label key={field}>
                        {field.replaceAll('_', ' ')}
                        {field === 'explicit' ? (
                          <select
                            value={record[field] === null ? 'unknown' : String(record[field])}
                            onChange={(e) =>
                              setRecord({
                                ...record,
                                [field]:
                                  e.target.value === 'unknown' ? null : e.target.value === 'true',
                              })
                            }
                          >
                            <option value="unknown">Unknown</option>
                            <option value="true">Explicit</option>
                            <option value="false">Not explicit</option>
                          </select>
                        ) : typeof record[field] === 'boolean' ? (
                          <input
                            type="checkbox"
                            checked={Boolean(record[field])}
                            onChange={(e) => setRecord({ ...record, [field]: e.target.checked })}
                          />
                        ) : field === 'body' ? (
                          <textarea
                            value={String(record[field] ?? '')}
                            onChange={(e) => setRecord({ ...record, [field]: e.target.value })}
                            rows={8}
                          />
                        ) : (
                          <input
                            type={numeric.has(field) ? 'number' : 'text'}
                            disabled={field === 'id' && selected !== 'new'}
                            value={String(record[field] ?? '')}
                            onChange={(e) =>
                              setRecord({
                                ...record,
                                [field]: numeric.has(field)
                                  ? e.target.value === ''
                                    ? null
                                    : Number(e.target.value)
                                  : e.target.value || (field === 'track_id' ? null : ''),
                              })
                            }
                          />
                        )}
                      </label>
                    ))}
                  </div>
                )}
                <div className={ui.actions}>
                  {editorial ? (
                    <>
                      <button
                        disabled={busy}
                        onClick={() => save('draft')}
                        className={ui.outlineButton}
                      >
                        <Save size={13} />
                        Save draft
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => save('publish')}
                        className={ui.primaryButton}
                      >
                        Publish changes
                      </button>
                      <button
                        disabled={busy || selected === 'new'}
                        onClick={() => save('unpublish')}
                        className={ui.outlineButton}
                      >
                        Unpublish
                      </button>
                    </>
                  ) : (
                    <button
                      disabled={busy}
                      onClick={() => save('save')}
                      className={ui.primaryButton}
                    >
                      Save metadata
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className={ui.empty}>
                <h2>Keep the story moving.</h2>
                <p>Select a record to begin editing.</p>
              </div>
            )}
          </div>
        </div>
      )}
      <p role="status" className={s.message}>
        {message}
      </p>
    </>
  );
}
type AudioRow = {
  key: string;
  file: File;
  trackId: string;
  approved: boolean;
  status: string;
  progress: number;
  matchText: string;
  error?: string;
};
type Ticket = {
  id: string;
  path: string;
  token: string;
  endpoint: string;
  trackId?: string;
  createdAt?: number;
  transferred?: boolean;
};
export function AudioManager({
  tracks,
  assets,
  onRefresh,
}: {
  tracks: Row[];
  assets: Row[];
  onRefresh: () => Promise<void>;
}) {
  const [files, setFiles] = useState<AudioRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const tickets = useRef(new Map<string, Ticket>());
  function rememberTickets() {
    try {
      sessionStorage.setItem('weloveovo.upload-tickets', JSON.stringify([...tickets.current]));
    } catch {}
  }
  useEffect(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem('weloveovo.upload-tickets') || '[]');
      if (Array.isArray(stored))
        tickets.current = new Map(
          stored.filter(
            (pair: [string, Ticket]) =>
              Array.isArray(pair) &&
              pair[1]?.createdAt &&
              Date.now() - pair[1].createdAt < 90 * 60 * 1000,
          ),
        );
    } catch {}
  }, []);
  const trackOptions = tracks.map((t) => ({ id: String(t.id), title: String(t.title) }));
  function update(key: string, change: Partial<AudioRow>) {
    setFiles((items) => items.map((item) => (item.key === key ? { ...item, ...change } : item)));
  }
  async function addFiles(list: FileList | null) {
    if (!list) return;
    setMessage('Reading audio metadata…');
    const { parseBlob } = await import('music-metadata');
    const next: AudioRow[] = [];
    for (const file of Array.from(list)) {
      let metadata: { title?: string; artist?: string } = {};
      let error = '';
      if (!/\.mp3$/i.test(file.name) || file.size > 100 * 1024 * 1024)
        error = 'Choose an MP3 under 100 MB.';
      else
        try {
          metadata = (await parseBlob(file, { skipCovers: true, duration: false })).common;
        } catch {
          error = 'Could not read this audio file.';
        }
      const matches = suggestTracks(file.name, metadata, trackOptions);
      const key = file.name + ':' + file.size + ':' + file.lastModified;
      const matched =
        tickets.current.get(key)?.trackId || (matches.length === 1 ? matches[0].id : '');
      next.push({
        key,
        file,
        trackId: matched,
        matchText: matched
          ? `${trackOptions.find((t) => t.id === matched)?.title} · ${matched}`
          : '',
        approved: false,
        status: 'review',
        progress: tickets.current.get(key)?.transferred ? 100 : 0,
        error:
          error || (matches.length > 1 ? 'Multiple matches: choose the correct track.' : undefined),
      });
    }
    setFiles((previous) => [
      ...previous,
      ...next.filter((n) => !previous.some((p) => p.key === n.key)),
    ]);
    setMessage('Review each track match and confirm before uploading.');
  }
  async function upload(row: AudioRow) {
    let ticket = tickets.current.get(row.key);
    if (!ticket) {
      ticket = await post('/api/admin/audio/sign', {
        trackId: row.trackId,
        filename: row.file.name,
        size: row.file.size,
      });
      ticket = { ...ticket!, trackId: row.trackId, createdAt: Date.now() };
      tickets.current.set(row.key, ticket);
      rememberTickets();
    }
    const target = ticket!;
    update(row.key, { status: 'uploading', error: undefined });
    if (row.progress < 100)
      await new Promise<void>((resolve, reject) => {
        const transfer = new Upload(row.file, {
          endpoint: target.endpoint,
          fingerprint: async () => `ovo:${target.path}:${row.file.size}`,
          headers: { 'x-signature': target.token },
          metadata: {
            bucketName: 'track-audio',
            objectName: target.path,
            contentType: 'audio/mpeg',
            cacheControl: '3600',
          },
          chunkSize: 6 * 1024 * 1024,
          uploadDataDuringCreation: true,
          removeFingerprintOnSuccess: true,
          retryDelays: [0, 1000, 3000, 5000],
          onProgress: (uploaded, total) =>
            update(row.key, { progress: Math.round((uploaded / total) * 100) }),
          onError: reject,
          onSuccess: () => {
            target.transferred = true;
            rememberTickets();
            resolve();
          },
        });
        transfer
          .findPreviousUploads()
          .then((previous) => {
            if (previous.length) transfer.resumeFromPreviousUpload(previous[0]);
            transfer.start();
          })
          .catch(reject);
      });
    update(row.key, { status: 'verifying', progress: 100 });
    await post('/api/admin/audio/finalize', { id: target.id, action: 'verify' });
    update(row.key, { status: 'ready', progress: 100 });
  }
  async function uploadBatch() {
    setBusy(true);
    for (const row of files.filter(
      (f) => f.approved && f.trackId && !['ready', 'published'].includes(f.status),
    )) {
      try {
        await upload(row);
      } catch (e) {
        update(row.key, { status: 'error', error: (e as Error).message });
      }
    }
    await onRefresh().catch((e) => setMessage(e.message));
    setBusy(false);
  }
  async function assetAction(id: string, action: string) {
    setBusy(true);
    try {
      await post('/api/admin/audio/finalize', { id, action });
      await onRefresh();
      setMessage(
        action === 'publish' ? 'Download published.' : 'Download removed from public view.',
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const count = new Set(assets.filter((a) => a.status === 'published').map((a) => a.track_id)).size;
  return (
    <>
      <div className={s.coverage}>
        <span>
          <strong>{count}</strong> / {tracks.length} tracks have published downloads
        </span>
        <p>Audio is stored privately. Only verified, published attachments can be downloaded.</p>
      </div>
      <label className={s.upload}>
        <UploadCloud size={26} />
        <strong>Add your MP3 collection</strong>
        <span>Select one or more MP3 files. Review the suggested matches, then upload.</span>
        <input
          disabled={busy}
          type="file"
          accept=".mp3,audio/mpeg"
          multiple
          onChange={(e) => void addFiles(e.target.files)}
        />
      </label>
      <datalist id="track-matches">
        {trackOptions.map((t) => (
          <option key={t.id} value={`${t.title} · ${t.id}`} />
        ))}
      </datalist>
      {files.map((row) => (
        <div className={s.audioRow} key={row.key}>
          <div>
            <strong>{row.file.name}</strong>
            <small>
              {(row.file.size / 1024 / 1024).toFixed(1)} MB · {row.status}
              {row.status === 'uploading' ? ` ${row.progress}%` : ''}
            </small>
            {row.error && <p className={s.fileError}>{row.error}</p>}
          </div>
          <label>
            <span className="sr-only">Match {row.file.name} to a track</span>
            <input
              disabled={busy || tickets.current.has(row.key)}
              list="track-matches"
              placeholder="Choose a matching track…"
              value={row.matchText}
              onChange={(e) => {
                const id =
                  e.target.value.match(/(?:[a-zA-Z0-9]{22}|genius-[1-9][0-9]*)$/)?.[0] || '';
                update(row.key, { trackId: id, matchText: e.target.value, approved: false });
              }}
            />
          </label>
          <label className={s.approve}>
            <input
              type="checkbox"
              disabled={busy || !row.trackId || row.status === 'ready'}
              checked={row.approved}
              onChange={(e) => update(row.key, { approved: e.target.checked })}
            />
            Correct match
          </label>
        </div>
      ))}
      {files.length > 0 && (
        <button
          className={ui.primaryButton}
          disabled={
            busy ||
            !files.some(
              (f) => f.approved && f.trackId && !['ready', 'published'].includes(f.status),
            )
          }
          onClick={() => void uploadBatch()}
        >
          {busy ? 'Uploading & verifying…' : 'Upload / retry confirmed files'}
        </button>
      )}
      <div className={ui.sectionBar}>
        <h2>Audio attachments</h2>
        <span>{assets.length} FILES</span>
      </div>
      {assets.map((asset) => (
        <div className={s.audioRow} key={String(asset.id)}>
          <div>
            <strong>{String(asset.title)}</strong>
            <small>
              {String(asset.filename)} · {String(asset.status)}
            </small>
          </div>
          {asset.status === 'pending' ? (
            <span className={ui.subtle}>Awaiting a complete, verified upload</span>
          ) : (
            <button
              disabled={busy}
              className={ui.outlineButton}
              onClick={() =>
                void assetAction(
                  String(asset.id),
                  asset.status === 'published' ? 'unpublish' : 'publish',
                )
              }
            >
              {asset.status === 'published' ? <Check size={14} /> : null}
              {asset.status === 'published' ? 'Unpublish download' : 'Publish download'}
            </button>
          )}
        </div>
      ))}
      <p role="status" className={s.message}>
        {message}
      </p>
    </>
  );
}
