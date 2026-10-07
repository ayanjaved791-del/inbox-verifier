import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Inbox Verifier",
  description: "Checks Gmail for verification codes on a Vercel Cron schedule.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
