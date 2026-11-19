import type { ReactNode } from 'react';
import { Footer, Layout, Navbar } from 'nextra-theme-docs';
import { Head } from 'nextra/components';
import { getPageMap } from 'nextra/page-map';
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import 'nextra-theme-docs/style.css';
import { Logo } from '../components/logo';
import './docs.css';

export const metadata = {
  title: { default: 'mnml-cms', template: '%s | mnml-cms' },
  description: 'A small schema-driven CMS you embed in a Next.js site.',
};

// Downloaded at build time and served from this site.
// Plex Sans is a variable font (any weight 100–700); Plex Mono comes in fixed weights.
const sans = IBM_Plex_Sans({ subsets: ['latin'], variable: '--font-sans' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['500', '600'], variable: '--font-mono' });

const navbar = <Navbar logo={<Logo />} projectLink="https://github.com/mbuguanewton/mnml-cms" />;
const footer = <Footer>MIT {new Date().getFullYear()} © mnml-cms</Footer>;

export default async function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      {/* Accent: the logo's orange (#FF5A1F). Deeper in light mode so link text keeps 4.5:1 contrast on white. */}
      <Head color={{ hue: 16, saturation: 100, lightness: { light: 42, dark: 56 } }} />
      <body>
        <Layout navbar={navbar} footer={footer} pageMap={await getPageMap()} docsRepositoryBase="https://github.com/mbuguanewton/mnml-cms/tree/develop/docs">
          {children}
        </Layout>
      </body>
    </html>
  );
}
