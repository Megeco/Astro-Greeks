import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Fin-Lumen | Research workbench",
  description: "A purchase-only Nifty options research and replay workbench",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
