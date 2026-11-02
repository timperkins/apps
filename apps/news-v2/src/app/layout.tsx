import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "News v2", template: "%s · News v2" },
  description: "Today's headlines from the sources you pick.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfa" },
    { media: "(prefers-color-scheme: dark)", color: "#151514" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <div className="page">
          <header className="masthead">
            <Link href="/" className="brand">News v2</Link>
            <Link href="/sources" className="nav">Sources</Link>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
