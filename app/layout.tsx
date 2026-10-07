import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NovaWorks AI Project Manager",
  description: "Turn meeting discussions into executable work.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
