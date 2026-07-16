import type { Metadata, Viewport } from "next";
import "./globals.css";

const publicSiteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null)
  ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
  ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(publicSiteUrl),
  title: "방학한칸 | 초·중·고 맞춤 방학 시간표",
  description: "초등학생부터 고등학생까지 공부, 운동, 취미와 휴식을 균형 있게 담는 맞춤형 방학 시간표",
  applicationName: "방학한칸",
  openGraph: {
    title: "방학한칸 | 초·중·고 맞춤 방학 시간표",
    description: "우리 가족 방학 시간표를 함께 만들어요. 공부, 운동, 취미와 휴식을 균형 있게 담아보세요.",
    type: "website",
    locale: "ko_KR",
    siteName: "방학한칸",
  },
  twitter: {
    card: "summary_large_image",
    title: "방학한칸 | 초·중·고 맞춤 방학 시간표",
    description: "우리 가족 방학 시간표를 함께 만들어요.",
  },
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
