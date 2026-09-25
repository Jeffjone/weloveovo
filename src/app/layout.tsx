import type { Metadata } from 'next';
import { ExperienceProvider } from '@/components/experience';
import './globals.css';
export const metadata: Metadata = {
  title: { default: 'WE LOVE OVO — Toronto After Dark', template: '%s / WE LOVE OVO' },
  description:
    'A city. A catalog. A world of connections. Explore Drake’s music, eras, and legacy after dark.',
  icons: { icon: '/assets/favicon.svg' },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ExperienceProvider>{children}</ExperienceProvider>
      </body>
    </html>
  );
}
