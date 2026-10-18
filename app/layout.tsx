import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Fin-Lumen | Macro notebook",
  description: "A rolling 75-day Fin-Lumen macro notebook with a dated Nifty reference",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
