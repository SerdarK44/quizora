import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quizora — Canlı Bilgi Yarışması",
  description: "Odanı kur, oyuncuları topla ve canlı yarışmayı başlat.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
