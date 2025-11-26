import "./globals.css";
import { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[var(--bg)] text-[var(--text)] antialiased">{children}</body>
    </html>
  );
}
