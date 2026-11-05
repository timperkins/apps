import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { AuthProvider } from "@/components/AuthProvider";
import { Account } from "@/components/Account";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Video Deluxe Maker", template: "%s · Video Deluxe Maker" },
  description: "Upload home-project footage and turn it into narrated videos.",
  appleWebApp: { capable: true, title: "Video", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f6f3" },
    { media: "(prefers-color-scheme: dark)", color: "#161615" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <header className="top">
            <Link href="/" className="brand">
              Video Deluxe Maker
            </Link>
            <Account />
          </header>
          <main>{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
