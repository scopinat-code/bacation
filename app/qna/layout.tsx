import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Q&A 게시판 | 방학한칸",
  description: "방학한칸 서비스 문의, 불편 신고, 개선 제안을 자유롭게 남겨 주세요.",
};

export default function QnaLayout({ children }: { children: ReactNode }) {
  return children;
}
