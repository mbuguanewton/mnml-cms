import './globals.css';
import { cms } from '@/cms';

export const metadata = { title: 'mnml-cms example' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <cms.PreviewBanner />
        {children}
      </body>
    </html>
  );
}
