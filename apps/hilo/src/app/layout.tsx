import { AuthProvider } from '@/lib/firebase';
import { TRPCProvider } from '@/lib/trpc';
import type { Metadata, Viewport } from 'next';
import { Nunito } from 'next/font/google';
import './globals.css';
import { SplashController } from './splash-controller';
import Toaster from './toaster';

const nunito = Nunito({
  variable: '--font-nunito',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'HILO',
  description: 'A party game of numbers: ask a question, guess the answer, bet higher or lower.',
};

export const viewport: Viewport = {
  themeColor: '#12161c',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${nunito.variable} antialiased max-w-full relative`}>
        <AuthProvider>
          <TRPCProvider>{children}</TRPCProvider>
        </AuthProvider>
        <Toaster />
        <div
          id="splash"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-[4dvmin] bg-[var(--background)]"
        >
          <div className="bg-[url('/frog.svg')] bg-contain bg-no-repeat bg-center h-[50dvmin] w-[50dvmin]" />
          <div className="text-[14dvmin] font-black leading-none tracking-wide">
            <span className="text-primary">HI</span>
            <span className="text-secondary">LO</span>
          </div>
        </div>
        <SplashController />
      </body>
    </html>
  );
}
