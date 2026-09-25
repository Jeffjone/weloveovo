import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AudioManager, Curator } from '@/components/curator';

const transfer = vi.hoisted(() => ({ attempts: 0, fail: false, resumes: 0 }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/components/ui', () => ({ ui: {} }));
vi.mock('music-metadata', () => ({ parseBlob: async () => ({ common: { title: 'Example' } }) }));
vi.mock('tus-js-client', () => ({
  Upload: class {
    constructor(
      _file: File,
      private options: {
        onProgress: (sent: number, total: number) => void;
        onError: (error: Error) => void;
        onSuccess: () => void;
      },
    ) {}
    async findPreviousUploads() {
      return transfer.attempts ? [{}] : [];
    }
    resumeFromPreviousUpload() {
      transfer.resumes++;
    }
    start() {
      transfer.attempts++;
      this.options.onProgress(50, 100);
      if (transfer.fail) {
        transfer.fail = false;
        this.options.onError(new Error('Transfer interrupted'));
      } else {
        this.options.onProgress(100, 100);
        this.options.onSuccess();
      }
    }
  },
}));
const tracks = [
  { id: '1111111111111111111111', title: 'Example' },
  { id: '2222222222222222222222', title: 'Example' },
];
const ticket = {
  id: '387a2bb6-d1bc-4b3d-883e-7af03d81af53',
  path: '1111111111111111111111/version.mp3',
  token: 'test-upload-token',
  endpoint: 'https://storage.example.test/resumable',
};
const file = () =>
  new File([new Uint8Array(512)], 'Example.mp3', {
    type: 'audio/mpeg',
    lastModified: 1000,
  });
const response = (body: unknown, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => body,
});
beforeEach(() => {
  sessionStorage.clear();
  transfer.attempts = 0;
  transfer.resumes = 0;
  transfer.fail = false;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test('ambiguous matches require a track choice and confirmation; retry resumes the same upload', async () => {
  const user = userEvent.setup();
  const fetchMock = vi.fn(async (url: string) =>
    response(url.endsWith('/sign') ? ticket : { ok: true }),
  );
  vi.stubGlobal('fetch', fetchMock);
  transfer.fail = true;
  const { container } = render(
    <AudioManager tracks={tracks} assets={[]} onRefresh={async () => {}} />,
  );
  await user.upload(container.querySelector('input[type=file]') as HTMLInputElement, file());
  await screen.findByText('Multiple matches: choose the correct track.');
  const upload = screen.getByRole('button', { name: 'Upload / retry confirmed files' });
  expect((upload as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(true);
  await user.type(
    screen.getByLabelText('Match Example.mp3 to a track'),
    `Example · ${tracks[0].id}`,
  );
  expect((upload as HTMLButtonElement).disabled).toBe(true);
  await user.click(screen.getByLabelText('Correct match'));
  await user.click(upload);
  await screen.findByText('Transfer interrupted');
  expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/finalize'))).toHaveLength(0);
  await user.click(screen.getByRole('button', { name: 'Upload / retry confirmed files' }));
  await screen.findByText(/MB · ready/);
  expect(transfer.attempts).toBe(2);
  expect(transfer.resumes).toBe(1);
  expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/sign'))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/finalize'))).toHaveLength(1);
});

test('completed transfers retry verification after remount without sending the MP3 again', async () => {
  const user = userEvent.setup();
  let failVerification = true;
  const fetchMock = vi.fn(async (url: string) => {
    if (url.endsWith('/sign')) return response(ticket);
    if (failVerification) {
      failVerification = false;
      return response({ error: 'Storage unavailable; retry verification' }, 503);
    }
    return response({ ok: true });
  });
  vi.stubGlobal('fetch', fetchMock);
  const props = { tracks: [tracks[0]], assets: [], onRefresh: async () => {} };
  const first = render(<AudioManager {...props} />);
  await user.upload(first.container.querySelector('input[type=file]') as HTMLInputElement, file());
  await screen.findByLabelText('Correct match');
  await user.click(screen.getByLabelText('Correct match'));
  await user.click(screen.getByRole('button', { name: 'Upload / retry confirmed files' }));
  await screen.findByText('Storage unavailable; retry verification');
  first.unmount();
  const second = render(<AudioManager {...props} />);
  await user.upload(second.container.querySelector('input[type=file]') as HTMLInputElement, file());
  await screen.findByLabelText('Correct match');
  await user.click(screen.getByLabelText('Correct match'));
  await user.click(screen.getByRole('button', { name: 'Upload / retry confirmed files' }));
  await screen.findByText(/MB · ready/);
  expect(transfer.attempts).toBe(1);
  expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/sign'))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/finalize'))).toHaveLength(2);
});

test('verified audio needs an explicit publish action', async () => {
  const user = userEvent.setup();
  const fetchMock = vi.fn(async () => response({ ok: true }));
  vi.stubGlobal('fetch', fetchMock);
  render(
    <AudioManager
      tracks={tracks}
      assets={[{ id: ticket.id, title: 'Example', filename: 'Example.mp3', status: 'ready' }]}
      onRefresh={async () => {}}
    />,
  );
  expect(fetchMock).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Publish download' }));
  await screen.findByText('Download published.');
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/admin/audio/finalize',
    expect.objectContaining({
      body: JSON.stringify({ id: ticket.id, action: 'publish' }),
    }),
  );
});

test('editorial preview and draft save do not publish', async () => {
  const user = userEvent.setup();
  const initial = {
    tracks: [],
    releases: [],
    artists: [],
    milestones: [],
    connections: [],
    audio: [],
    drafts: [],
    eras: [
      {
        id: 'blue-hour',
        label: 'Blue hour',
        title: 'Original title',
        body: 'Original story',
        published: true,
        start_year: 2009,
        end_year: 2012,
      },
    ],
  };
  const fetchMock = vi.fn(async (_url: string, options?: RequestInit) =>
    response(options?.method === 'POST' ? { id: 'blue-hour' } : initial),
  );
  vi.stubGlobal('fetch', fetchMock);
  render(<Curator initial={initial} />);
  await user.click(screen.getByRole('button', { name: 'eras' }));
  await user.selectOptions(screen.getByLabelText('Select eras'), 'blue-hour');
  await user.clear(screen.getByLabelText('body'));
  await user.type(screen.getByLabelText('body'), 'A revised story');
  await user.click(screen.getByRole('button', { name: 'Preview' }));
  await screen.findByText('A revised story');
  expect(fetchMock).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Save draft' }));
  await screen.findByText('Draft saved. The published version is unchanged.');
  const posts = () =>
    fetchMock.mock.calls
      .filter(([, options]) => options?.method === 'POST')
      .map(([, options]) => JSON.parse(String(options?.body)));
  expect(posts().map((p) => p.action)).toEqual(['draft']);
  await user.click(screen.getByRole('button', { name: 'Publish changes' }));
  await waitFor(() => expect(posts().map((p) => p.action)).toEqual(['draft', 'publish']));
  expect(posts()[1].record.body).toBe('A revised story');
});

test('a new connection keeps the draft ID when subsequently published', async () => {
  const user = userEvent.setup();
  const content = {
    tracks: [],
    releases: [],
    artists: [],
    eras: [],
    milestones: [],
    connections: [],
    audio: [],
    drafts: [] as Record<string, unknown>[],
  };
  const savedId = '387a2bb6-d1bc-4b3d-883e-7af03d81af53';
  const posts: { action: string; record: Record<string, unknown> }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.method === 'POST') {
        const body = JSON.parse(String(options.body));
        posts.push(body);
        content.drafts = [
          { kind: 'connections', entity_id: savedId, content: { ...body.record, id: savedId } },
        ];
        return response({ id: savedId });
      }
      return response(content);
    }),
  );
  render(<Curator initial={content} />);
  await user.click(screen.getByRole('button', { name: 'connections' }));
  await user.click(screen.getByRole('button', { name: 'Create new' }));
  await user.type(screen.getByLabelText('source'), 'era:the-blue-hour');
  await user.type(screen.getByLabelText('target'), 'release:take-care-deluxe');
  await user.click(screen.getByRole('button', { name: 'Save draft' }));
  await screen.findByText('Draft saved. The published version is unchanged.');
  await user.click(screen.getByRole('button', { name: 'Publish changes' }));
  await screen.findByText('Changes published.');
  expect(posts.map((p) => p.action)).toEqual(['draft', 'publish']);
  expect(posts[1].record.id).toBe(savedId);
});
