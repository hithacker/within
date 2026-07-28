import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Within Studio',
  description: 'Author and review structured reflection skills.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
