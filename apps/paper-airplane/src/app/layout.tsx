import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Paper Airplane — folding spike",
  description: "Procedurally folded, animated paper airplane instructions in three.js.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
