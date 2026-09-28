import type { Metadata } from 'next';
import { ExperienceProvider } from '@/components/experience';
import './fonts.css';
import './globals.css';
export const metadata: Metadata = {
  title: { default: 'weloveovo', template: '%s / weloveovo' },
  applicationName: 'weloveovo',
  description:
    'A city. A catalog. A world of connections. Explore Drake’s music, eras, and legacy after dark.',
  icons: { icon: '/assets/brand/moonlight.svg' },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preload"
          href="/assets/fonts/space-grotesk-500.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/assets/fonts/manrope-400.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <ExperienceProvider>{children}</ExperienceProvider>
      </body>
    </html>
  );
}
