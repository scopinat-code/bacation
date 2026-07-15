import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "방학한칸 | 초·중·고 맞춤 방학 시간표",
  description: "초등학생부터 고등학생까지 공부, 운동, 취미와 휴식을 균형 있게 담는 맞춤형 방학 시간표",
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
