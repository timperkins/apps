import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Newsreader } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import { LocalWatcher } from "@/components/LocalWatcher";
import { Masthead } from "@/components/Masthead";
import { ServiceWorker } from "@/components/ServiceWorker";
import { APP_NAME } from "@/lib/config";
import "./globals.css";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
});

const plex = IBM_Plex_Sans({
  variable: "--font-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: "Today's news, written up from real reporting, with local stories and topics you care about.",
  applicationName: APP_NAME,
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfa" },
    { media: "(prefers-color-scheme: dark)", color: "#151514" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${newsreader.variable} ${plex.variable}`}>
      <body>
        <AuthProvider>
          <div className="page">
            <Masthead />
            <main>{children}</main>
          </div>
          <LocalWatcher />
          <ServiceWorker />
        </AuthProvider>
      </body>
    </html>
  );
}
