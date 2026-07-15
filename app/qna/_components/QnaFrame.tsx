"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import styles from "../qna.module.css";

export default function QnaFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className={styles.appShell}>
      <header className={styles.topbar}>
        <Link className={styles.brand} href="/" aria-label="방학한칸 홈으로">
          <span className={styles.brandMark}>한칸</span>
          <span>
            방학한칸
            <small>같이 만드는 우리 방학</small>
          </span>
        </Link>
        <nav className={styles.nav} aria-label="Q&A 메뉴">
          <Link className={pathname === "/qna" ? styles.navActive : ""} href="/qna">
            질문 모아보기
          </Link>
          <Link className={pathname === "/qna/new" ? styles.navActive : ""} href="/qna/new">
            글쓰기 <span aria-hidden="true">＋</span>
          </Link>
        </nav>
      </header>
      {children}
      <footer className={styles.footer}>
        <strong>방학한칸 Q&amp;A</strong>
        <span>아이의 실명, 학교명, 연락처, 구체적인 개인 일정은 적지 말아 주세요.</span>
      </footer>
    </div>
  );
}
