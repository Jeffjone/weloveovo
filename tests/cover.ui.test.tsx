import { afterEach, expect, test } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Cover } from '@/components/cover';
afterEach(cleanup);
test('failed artwork remains identified and a replacement source can load', () => {
  const { rerender } = render(
    <Cover release={{ title: 'A Record', cover_url: 'https://example.test/old.jpg' }} />,
  );
  fireEvent.error(screen.getByRole('img', { name: 'A Record cover' }));
  expect(screen.getByRole('img', { name: 'A Record artwork unavailable' })).toBeTruthy();
  rerender(<Cover release={{ title: 'A Record', cover_url: 'https://example.test/new.jpg' }} />);
  expect(screen.getByRole('img', { name: 'A Record cover' }).getAttribute('src')).toBe(
    'https://example.test/new.jpg',
  );
});
