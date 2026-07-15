"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./admin.module.css";

type AdminQuestion = {
  id: string;
  category: "inquiry" | "complaint" | "suggestion";
  title: string;
  content: string;
  nickname: string;
  visibility: "public" | "private";
  status: "waiting" | "answered";
  answer: { content: string; createdAt: string; updatedAt: string } | null;
  isHidden: boolean;
  createdAt: string;
  updatedAt?: string;
};

const CATEGORY_LABEL = { inquiry: "문의", complaint: "불편 신고", suggestion: "개선 제안" } as const;
const PAGE_SIZE = 50;

export default function QnaAdminPanel() {
  const [items, setItems] = useState<AdminQuestion[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | "waiting" | "answered" | "hidden">("waiting");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/qna/admin?page=${page}&limit=${PAGE_SIZE}`, { cache: "no-store" });
      if (!response.ok) throw new Error("문의 목록을 불러오지 못했습니다.");
      const data = await response.json() as { items: AdminQuestion[]; total: number };
      setItems(data.items);
      setTotal(data.total);
      setDrafts(Object.fromEntries(data.items.map((item) => [item.id, item.answer?.content ?? ""])));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "문의 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { void load(); }, [load]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  useEffect(() => {
    if (!loading && page > pageCount) setPage(pageCount);
  }, [loading, page, pageCount]);

  const visibleItems = useMemo(() => items.filter((item) => {
    if (filter === "hidden") return item.isHidden;
    if (filter === "all") return true;
    return item.status === filter && !item.isHidden;
  }), [filter, items]);

  const update = async (id: string, patch: { answer?: string; isHidden?: boolean; visibility?: "public" | "private" }) => {
    setBusyId(id);
    setMessage("");
    try {
      const response = await fetch(`/api/qna/admin/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "문의 상태를 변경하지 못했습니다.");
      await load();
      setMessage("변경사항을 저장했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "변경사항을 저장하지 못했습니다.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (item: AdminQuestion) => {
    if (!window.confirm(`‘${item.title}’ 글을 완전히 삭제할까요?`)) return;
    setBusyId(item.id);
    try {
      const response = await fetch(`/api/qna/admin/${item.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("글을 삭제하지 못했습니다.");
      await load();
      setMessage("글을 삭제했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "글을 삭제하지 못했습니다.");
    } finally {
      setBusyId(null);
    }
  };

  return <section className={styles.qnaSection}>
    <div className={styles.qnaHeading}><div><h2>Q&A 관리</h2><p>사용자의 문의와 개선 제안에 답변하거나 부적절한 글을 숨길 수 있습니다.</p></div><a href="/qna" target="_blank" rel="noreferrer">게시판 열기 ↗</a></div>
    <div className={styles.qnaFilters}>
      {(["waiting", "answered", "all", "hidden"] as const).map((value) => <button key={value} className={filter === value ? styles.activeFilter : ""} onClick={() => setFilter(value)}>{value === "waiting" ? "답변 대기" : value === "answered" ? "답변 완료" : value === "hidden" ? "숨긴 글" : "전체"}</button>)}
    </div>
    {message && <p className={styles.qnaMessage} role="status">{message}</p>}
    {loading ? <div className={styles.qnaEmpty}>문의 목록을 불러오는 중입니다…</div> : !visibleItems.length ? <div className={styles.qnaEmpty}>해당하는 문의가 없습니다.</div> : <div className={styles.qnaList}>
      {visibleItems.map((item) => <article className={styles.qnaItem} key={item.id}>
        <header><div className={styles.qnaBadges}><span>{CATEGORY_LABEL[item.category]}</span><span>{item.visibility === "private" ? "🔒 비공개" : "🌐 공개"}</span>{item.isHidden && <span>숨김</span>}</div><time>{new Date(item.createdAt).toLocaleString("ko-KR")}</time></header>
        <h3>{item.title}</h3>
        <p className={styles.qnaAuthor}>{item.nickname}</p>
        <p className={styles.qnaContent}>{item.content}</p>
        <label className={styles.answerField}>운영자 답변<textarea rows={5} maxLength={3000} value={drafts[item.id] ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="답변을 입력해 주세요." /></label>
        <div className={styles.qnaActions}>
          <button disabled={busyId === item.id || !(drafts[item.id] ?? "").trim()} onClick={() => update(item.id, { answer: drafts[item.id].trim() })}>{busyId === item.id ? "저장 중…" : item.answer ? "답변 수정" : "답변 등록"}</button>
          <button disabled={busyId === item.id} onClick={() => update(item.id, { visibility: item.visibility === "public" ? "private" : "public" })}>{item.visibility === "public" ? "비공개로" : "공개로"}</button>
          <button disabled={busyId === item.id} onClick={() => update(item.id, { isHidden: !item.isHidden })}>{item.isHidden ? "숨김 해제" : "글 숨기기"}</button>
          <button className={styles.deleteButton} disabled={busyId === item.id} onClick={() => remove(item)}>삭제</button>
        </div>
      </article>)}
    </div>}
    {!loading && total > PAGE_SIZE && <nav className={styles.qnaPagination} aria-label="Q&A 관리 페이지">
      <button disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>← 이전</button>
      <span>{page} / {pageCount} · 전체 {total.toLocaleString()}개</span>
      <button disabled={page === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>다음 →</button>
    </nav>}
  </section>;
}
