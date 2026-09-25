import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DownloadButton } from '@/components/download';
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
test('failed downloads stay on the track and retry the short-lived link', async () => {
  const user = userEvent.setup();
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Storage is unavailable. Try again.' }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: 'https://storage.example.test/short-lived-track.mp3' }),
    });
  vi.stubGlobal('fetch', fetchMock);
  let downloaded = '';
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloaded = this.href;
  });
  render(<DownloadButton trackId="1111111111111111111111" />);
  expect(fetchMock).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Download MP3' }));
  await screen.findByText('Storage is unavailable. Try again.');
  expect(downloaded).toBe('');
  await user.click(screen.getByRole('button', { name: 'Retry download' }));
  expect(downloaded).toBe('https://storage.example.test/short-lived-track.mp3');
  expect(screen.queryByRole('status')).toBeNull();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
