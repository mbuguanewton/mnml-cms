import './globals.css';

export const metadata = { title: 'mnml-cms example' };

// Just the document shell. The site's header and footer live in (site)/layout.tsx, so the admin has none.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col">{children}</body>
    </html>
  );
}
