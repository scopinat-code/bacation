"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import QnaFrame from "./_components/QnaFrame";
import {
  apiErrorMessage,
  categoryLabel,
  categoryTone,
  formatQnaDate,
  isAnswered,
  type QnaListItem,
} from "./_lib";
import styles from "./qna.module.css";

const PAGE_SIZE = 10;

type ListResponse = {
  items?: QnaListItem[];
  total?: number;
};

export default function QnaPage() {
  const [items, setItems] = useState<QnaListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadItems = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/qna?page=${page}&limit=${PAGE_SIZE}`, {
        cache: "no-store",
        signal,
      });
      if (!response.ok) throw new Error(await apiErrorMessage(response, "게시글을 불러오지 못했습니다."));
      const payload = (await response.json()) as ListResponse;
      setItems(Array.isArray(payload.items) ? payload.items : []);
      setTotal(typeof payload.total === "number" ? payload.total : 0);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(caught instanceof Error ? caught.message : "게시글을 불러오지 못했습니다.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    const controller = new AbortController();
    void loadItems(controller.signal);
    return () => controller.abort();
  }, [loadItems]);

  useEffect(() => {
    if (!loading && page > pageCount) setPage(pageCount);
  }, [loading, page, pageCount]);

  const pageNumbers = useMemo(() => {
    const start = Math.max(1, Math.min(page - 2, pageCount - 4));
    return Array.from({ length: Math.min(5, pageCount) }, (_, index) => start + index);
  }, [page, pageCount]);

  return (
    <QnaFrame>
      <main className={styles.page}>
        <section className={styles.hero}>
          <div>
            <span className={styles.eyebrow}>함께 더 좋은 방학을 만들어요</span>
            <h1>궁금한 점도, 아쉬운 점도<br />편하게 들려주세요!</h1>
            <p>
              서비스 문의부터 불편 신고, 번뜩이는 개선 아이디어까지 누구나 남길 수 있어요.
              운영자가 확인하고 정성껏 답변할게요.
            </p>
          </div>
          <div className={styles.heroNote} aria-hidden="true">
            <span>💬</span>
            <b>당신의 한마디가</b>
            <strong>방학한칸을<br />더 좋아지게 해요!</strong>
          </div>
        </section>

        <section className={styles.listCard} aria-labelledby="qna-list-title">
          <header className={styles.listHeader}>
            <div>
              <h2 id="qna-list-title">Q&amp;A 게시판</h2>
              <p>총 <b>{total.toLocaleString()}</b>개의 이야기가 모였어요.</p>
            </div>
            <Link className={styles.primaryButton} href="/qna/new">
              새 글 쓰기 <span aria-hidden="true">→</span>
            </Link>
          </header>

          <div className={styles.legend} aria-label="문의 유형 안내">
            <span><i className={styles.skyDot} /> 서비스 문의</span>
            <span><i className={styles.coralDot} /> 불편 신고</span>
            <span><i className={styles.mintDot} /> 개선 제안</span>
          </div>

          {loading ? (
            <div className={styles.statePanel} role="status">
              <span className={styles.loader} aria-hidden="true">☀</span>
              <b>게시글을 펼쳐 보고 있어요</b>
              <p>잠시만 기다려 주세요.</p>
            </div>
          ) : error ? (
            <div className={`${styles.statePanel} ${styles.errorPanel}`} role="alert">
              <span aria-hidden="true">🥲</span>
              <b>{error}</b>
              <button type="button" className={styles.secondaryButton} onClick={() => void loadItems()}>
                다시 불러오기
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className={styles.statePanel}>
              <span aria-hidden="true">📝</span>
              <b>아직 첫 번째 이야기를 기다리고 있어요.</b>
              <p>궁금했던 점이나 좋은 아이디어를 가장 먼저 남겨 주세요!</p>
              <Link className={styles.secondaryButton} href="/qna/new">첫 글 남기기</Link>
            </div>
          ) : (
            <div className={styles.postList}>
              {items.map((item) => {
                const privatePost = item.visibility === "private";
                const answered = isAnswered(item.status);
                return (
                  <Link className={styles.postRow} href={`/qna/${encodeURIComponent(item.id)}`} key={item.id}>
                    <span className={`${styles.categoryBadge} ${styles[categoryTone(item.category)]}`}>
                      {categoryLabel(item.category)}
                    </span>
                    <div className={styles.postCopy}>
                      <h3>
                        {privatePost && <span className={styles.lock} aria-label="비공개 글">🔒</span>}
                        {privatePost ? "비공개 문의입니다" : item.title}
                      </h3>
                      <p>
                        <span>{privatePost ? "작성자 비공개" : item.nickname}</span>
                        <time dateTime={item.createdAt}>{formatQnaDate(item.createdAt)}</time>
                      </p>
                    </div>
                    <span className={`${styles.statusBadge} ${answered ? styles.answered : styles.waiting}`}>
                      {answered ? "답변 완료" : "답변 대기"}
                    </span>
                    <span className={styles.rowArrow} aria-hidden="true">›</span>
                  </Link>
                );
              })}
            </div>
          )}

          {!loading && !error && total > PAGE_SIZE && (
            <nav className={styles.pagination} aria-label="게시글 페이지">
              <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1}>
                이전
              </button>
              {pageNumbers.map((number) => (
                <button
                  type="button"
                  className={number === page ? styles.currentPage : ""}
                  aria-current={number === page ? "page" : undefined}
                  onClick={() => setPage(number)}
                  key={number}
                >
                  {number}
                </button>
              ))}
              <button type="button" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={page === pageCount}>
                다음
              </button>
            </nav>
          )}
        </section>
      </main>
    </QnaFrame>
  );
}
