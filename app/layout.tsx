import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "방학한칸 | 같이 만드는 여름방학 시간표",
  description: "아이의 선택과 부모의 현실 조건을 한 칸씩 맞추는 여름방학 생활계획표",
  applicationName: "방학한칸",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fff8e8",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
