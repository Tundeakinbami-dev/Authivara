import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@/src/styles.css';

export const metadata: Metadata = {
  title: 'Authivara — Proof of Content Authorship',
  description: 'Create private, verifiable evidence that a digital work existed in a specific form at a specific time.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
