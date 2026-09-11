import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'First Prompt — logged-out onboarding prototype',
  description:
    'Prototype: a living first prompt for logged-out visitors, plus shareable answer cards.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
