import type { Metadata } from 'next';
import { Aldrich, Inter } from 'next/font/google';
import './globals.css';

const aldrich = Aldrich({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-aldrich',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'STATECRAFT — War Room',
  description: 'Real-time spectator dashboard for Statecraft v2',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${aldrich.variable} ${inter.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
