import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Summary-AI",
  description: "File management with Next.js, Supabase Storage, and API routes"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
