"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import QnaFrame from "../_components/QnaFrame";
import {
  apiErrorMessage,
  categoryLabel,
  categoryTone,
  formatQnaDate,
  getAnswer,
  isAnswered,
  type LockedQna,
  type QnaDetail,
  type QnaVisibility,
} from "../_lib";
import styles from "../qna.module.css";

type EditValues = {
  title: string;
  content: string;
  nickname: string;
  visibility: QnaVisibility;
  password: string;
};

function isLocked(payload: QnaDetail | LockedQna): payload is LockedQna {
  return "locked" in payload && payload.locked === true;
}

export default function QnaDetailPage() {
  const params = useParams<{ id: string | string[] }>();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [detail, setDetail] = useState<QnaDetail | null>(null);
  const [locked, setLocked] = useState<LockedQna | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [createdNotice, setCreatedNotice] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState("");
  const [authorPassword, setAuthorPassword] = useState("");
  const [editing, setEditing] = useState(false);
  const [editValues, setEditValues] = useState<EditValues | null>(null);
  const [deleteMode, setDeleteMode] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  const loadDetail = useCallback(async (signal?: AbortSignal) => {
    if (!id) return;
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch(`/api/qna/${encodeURIComponent(id)}`, { cache: "no-store", signal });
      if (!response.ok) throw new Error(await apiErrorMessage(response, response.status === 404 ? "게시글을 찾을 수 없습니다." : "게시글을 불러오지 못했습니다."));
      const payload = (await response.json()) as QnaDetail | LockedQna;
      if (isLocked(payload)) {
        setLocked(payload);
        setDetail(null);
      } else {
        setDetail(payload);
        setLocked(null);
      }
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setLoadError(caught instanceof Error ? caught.message : "게시글을 불러오지 못했습니다.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    void loadDetail(controller.signal);
    setCreatedNotice(new URLSearchParams(window.location.search).get("created") === "1");
    return () => controller.abort();
  }, [loadDetail]);

  async function handleUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id || unlocking) return;
    setUnlockError("");
    setUnlocking(true);
    try {
      const response = await fetch(`/api/qna/${encodeURIComponent(id)}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: unlockPassword }),
      });
      if (!response.ok) throw new Error(await apiErrorMessage(response, "비밀번호가 맞지 않습니다."));
      const payload = (await response.json()) as QnaDetail;
      setDetail(payload);
      setLocked(null);
      setAuthorPassword(unlockPassword);
      setUnlockPassword("");
    } catch (caught) {
      setUnlockError(caught instanceof Error ? caught.message : "비밀번호를 확인하지 못했습니다.");
    } finally {
      setUnlocking(false);
    }
  }

  function beginEdit() {
    if (!detail) return;
    setActionError("");
    setActionMessage("");
    setDeleteMode(false);
    setEditValues({
      title: detail.title,
      content: detail.content,
      nickname: detail.nickname,
      visibility: detail.visibility,
      password: authorPassword,
    });
    setEditing(true);
  }

  function updateEdit<K extends keyof EditValues>(key: K, value: EditValues[K]) {
    setEditValues((current) => current ? { ...current, [key]: value } : current);
  }

  async function handleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id || !detail || !editValues || actionBusy) return;
    setActionError("");
    setActionMessage("");
    setActionBusy(true);
    try {
      const response = await fetch(`/api/qna/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: editValues.password,
          title: editValues.title.trim(),
          content: editValues.content.trim(),
          nickname: editValues.nickname.trim(),
          visibility: editValues.visibility,
        }),
      });
      if (!response.ok) throw new Error(await apiErrorMessage(response, "게시글을 수정하지 못했습니다."));
      const payload = (await response.json()) as { item?: QnaDetail };
      setDetail(payload.item ?? {
        ...detail,
        title: editValues.title.trim(),
        content: editValues.content.trim(),
        nickname: editValues.nickname.trim(),
        visibility: editValues.visibility,
      });
      setAuthorPassword(editValues.password);
      setEditing(false);
      setActionMessage("게시글을 수정했습니다.");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "게시글을 수정하지 못했습니다.");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id || actionBusy || !deletePassword) return;
    if (!window.confirm("이 게시글을 정말 삭제할까요? 삭제한 글은 다시 되돌릴 수 없습니다.")) return;
    setActionError("");
    setActionMessage("");
    setActionBusy(true);
    try {
      const response = await fetch(`/api/qna/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword }),
      });
      if (!response.ok) throw new Error(await apiErrorMessage(response, "게시글을 삭제하지 못했습니다."));
      router.replace("/qna");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "게시글을 삭제하지 못했습니다.");
      setActionBusy(false);
    }
  }

  const answer = useMemo(() => detail ? getAnswer(detail) : null, [detail]);

  return (
    <QnaFrame>
      <main className={`${styles.page} ${styles.narrowPage}`}>
        <div className={styles.breadcrumb}>
          <Link href="/qna">Q&amp;A 게시판</Link><span aria-hidden="true">›</span><b>게시글 보기</b>
        </div>

        {loading ? (
          <div className={`${styles.statePanel} ${styles.detailState}`} role="status">
            <span className={styles.loader} aria-hidden="true">☀</span><b>이야기를 펼쳐 보고 있어요</b>
          </div>
        ) : loadError ? (
          <div className={`${styles.statePanel} ${styles.detailState} ${styles.errorPanel}`} role="alert">
            <span aria-hidden="true">🥲</span><b>{loadError}</b>
            <div className={styles.inlineActions}>
              <Link className={styles.secondaryButton} href="/qna">목록으로</Link>
              <button className={styles.primaryButton} type="button" onClick={() => void loadDetail()}>다시 불러오기</button>
            </div>
          </div>
        ) : locked ? (
          <section className={styles.lockedCard}>
            {createdNotice && <p className={styles.successNotice}>게시글이 등록되었습니다. 정한 비밀번호로 내용을 확인할 수 있어요.</p>}
            <div className={styles.lockIllustration} aria-hidden="true">🔒</div>
            <span className={styles.eyebrow}>비공개 문의</span>
            <h1>작성자와 운영자만<br />볼 수 있는 글이에요.</h1>
            <p>글을 작성할 때 정한 비밀번호를 입력하면 문의 내용과 운영자 답변을 확인할 수 있습니다.</p>
            <form className={styles.unlockForm} onSubmit={handleUnlock}>
              <label>
                <span>글 비밀번호</span>
                <input
                  type="password"
                  value={unlockPassword}
                  onChange={(event) => setUnlockPassword(event.target.value)}
                  minLength={4}
                  maxLength={72}
                  autoComplete="current-password"
                  placeholder="비밀번호를 입력해 주세요"
                  required
                  autoFocus
                />
              </label>
              {unlockError && <p className={styles.formError} role="alert">{unlockError}</p>}
              <button className={styles.primaryButton} type="submit" disabled={unlocking}>
                {unlocking ? "확인하고 있어요…" : "비공개 글 열기"}
              </button>
            </form>
            <Link className={styles.textLink} href="/qna">← 게시판 목록으로 돌아가기</Link>
          </section>
        ) : detail ? (
          <>
            {createdNotice && <p className={styles.successNotice}>게시글이 등록되었습니다. 글 비밀번호는 안전한 곳에 기억해 주세요.</p>}
            <article className={styles.detailCard}>
              <header className={styles.detailHeader}>
                <div className={styles.badgeRow}>
                  <span className={`${styles.categoryBadge} ${styles[categoryTone(detail.category)]}`}>
                    {categoryLabel(detail.category)}
                  </span>
                  <span className={`${styles.statusBadge} ${isAnswered(detail.status) ? styles.answered : styles.waiting}`}>
                    {isAnswered(detail.status) ? "답변 완료" : "답변 대기"}
                  </span>
                  {detail.visibility === "private" && <span className={styles.privateBadge}>🔒 비공개</span>}
                </div>
                <h1>{detail.title}</h1>
                <p className={styles.postMeta}>
                  <b>{detail.nickname}</b><span>·</span><time dateTime={detail.createdAt}>{formatQnaDate(detail.createdAt)}</time>
                  {detail.updatedAt && detail.updatedAt !== detail.createdAt && <span className={styles.edited}>(수정됨)</span>}
                </p>
              </header>
              <div className={styles.questionContent}>{detail.content}</div>
            </article>

            {answer ? (
              <section className={styles.answerCard} aria-labelledby="admin-answer-title">
                <div className={styles.answerMark} aria-hidden="true">한칸</div>
                <div>
                  <header>
                    <div><span>운영자 답변</span><h2 id="admin-answer-title">방학한칸 운영자</h2></div>
                    {answer.createdAt && <time dateTime={answer.createdAt}>{formatQnaDate(answer.createdAt)}</time>}
                  </header>
                  <div className={styles.answerContent}>{answer.content}</div>
                </div>
              </section>
            ) : (
              <section className={styles.waitingCard}>
                <span aria-hidden="true">📮</span>
                <div><b>운영자가 답변을 준비하고 있어요.</b><p>문의 내용을 확인한 뒤 이곳에 답변을 남길게요.</p></div>
              </section>
            )}

            <section className={styles.authorCard}>
              <header>
                <div><span aria-hidden="true">✏️</span><div><h2>내가 쓴 글인가요?</h2><p>작성할 때 정한 비밀번호로 글을 수정하거나 삭제할 수 있어요.</p></div></div>
                {!editing && !deleteMode && (
                  <div className={styles.inlineActions}>
                    <button className={styles.secondaryButton} type="button" onClick={beginEdit}>글 수정</button>
                    <button
                      className={styles.dangerButton}
                      type="button"
                      onClick={() => {
                        setEditing(false);
                        setDeleteMode(true);
                        setDeletePassword(authorPassword);
                        setActionError("");
                        setActionMessage("");
                      }}
                    >글 삭제</button>
                  </div>
                )}
              </header>

              {actionMessage && <p className={styles.successNotice} role="status">{actionMessage}</p>}

              {editing && editValues && (
                <form className={styles.editForm} onSubmit={handleEdit}>
                  <label className={styles.field}><span>제목</span><input value={editValues.title} onChange={(event) => updateEdit("title", event.target.value)} minLength={2} maxLength={100} required /></label>
                  <label className={styles.field}><span>내용</span><textarea value={editValues.content} onChange={(event) => updateEdit("content", event.target.value)} minLength={5} maxLength={5000} rows={8} required /></label>
                  <div className={styles.twoColumns}>
                    <label className={styles.field}><span>작성자 별명</span><input value={editValues.nickname} onChange={(event) => updateEdit("nickname", event.target.value)} maxLength={20} required /></label>
                    <div className={styles.field}>
                      <span>공개 여부</span>
                      <div className={styles.visibilityOptions}>
                        <label className={editValues.visibility === "public" ? styles.visibilitySelected : ""}><input type="radio" checked={editValues.visibility === "public"} onChange={() => updateEdit("visibility", "public")} /><span aria-hidden="true">🌤️</span><b>공개</b></label>
                        <label className={editValues.visibility === "private" ? styles.visibilitySelected : ""}><input type="radio" checked={editValues.visibility === "private"} onChange={() => updateEdit("visibility", "private")} /><span aria-hidden="true">🔒</span><b>비공개</b></label>
                      </div>
                    </div>
                  </div>
                  <label className={styles.field}><span>글 비밀번호</span><input type="password" value={editValues.password} onChange={(event) => updateEdit("password", event.target.value)} minLength={4} maxLength={72} autoComplete="current-password" placeholder="수정하려면 비밀번호가 필요해요" required /></label>
                  {actionError && <p className={styles.formError} role="alert">{actionError}</p>}
                  <div className={styles.formActions}>
                    <button className={styles.secondaryButton} type="button" onClick={() => { setEditing(false); setActionError(""); }}>취소</button>
                    <button className={styles.primaryButton} type="submit" disabled={actionBusy}>{actionBusy ? "저장하고 있어요…" : "수정 내용 저장"}</button>
                  </div>
                </form>
              )}

              {deleteMode && (
                <form className={styles.deleteForm} onSubmit={handleDelete}>
                  <div><b>게시글을 삭제할까요?</b><p>삭제한 글과 운영자 답변은 다시 되돌릴 수 없습니다.</p></div>
                  <label className={styles.field}><span>글 비밀번호</span><input type="password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} minLength={4} maxLength={72} autoComplete="current-password" placeholder="비밀번호를 입력해 주세요" required /></label>
                  {actionError && <p className={styles.formError} role="alert">{actionError}</p>}
                  <div className={styles.formActions}>
                    <button className={styles.secondaryButton} type="button" onClick={() => { setDeleteMode(false); setActionError(""); }}>취소</button>
                    <button className={styles.dangerButton} type="submit" disabled={actionBusy}>{actionBusy ? "삭제하고 있어요…" : "게시글 삭제"}</button>
                  </div>
                </form>
              )}
            </section>

            <div className={styles.bottomNavigation}>
              <Link className={styles.secondaryButton} href="/qna">← 게시판 목록</Link>
              <Link className={styles.primaryButton} href="/qna/new">새 글 쓰기 ＋</Link>
            </div>
          </>
        ) : null}
      </main>
    </QnaFrame>
  );
}
