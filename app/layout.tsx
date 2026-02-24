import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Supabase 文档上传与管理",
  description: "使用 Next.js + Supabase Storage + API 路由实现文件管理"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
