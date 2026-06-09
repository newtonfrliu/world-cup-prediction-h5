import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "美加墨大乱斗",
  description: "美加墨大乱斗 Next.js 15 项目",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
