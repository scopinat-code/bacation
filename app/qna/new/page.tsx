"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import QnaFrame from "../_components/QnaFrame";
import { apiErrorMessage, type QnaVisibility } from "../_lib";
import styles from "../qna.module.css";

type FormValues = {
  category: string;
  title: string;
  content: string;
  nickname: string;
  visibility: QnaVisibility;
  password: string;
  passwordConfirm: string;
};

const initialValues: FormValues = {
  category: "inquiry",
  title: "",
  content: "",
  nickname: "",
  visibility: "public",
  password: "",
  passwordConfirm: "",
};

export default function NewQnaPage() {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [startedAt, setStartedAt] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setStartedAt(Date.now()), []);

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError("");

    if (values.password !== values.passwordConfirm) {
      setError("글 비밀번호가 서로 일치하지 않습니다.");
      return;
    }
    if (values.password.length < 4) {
      setError("글 비밀번호는 4자 이상으로 정해 주세요.");
      return;
    }

    const data = new FormData(event.currentTarget);
    setSubmitting(true);
    try {
      const response = await fetch("/api/qna", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: values.category,
          title: values.title.trim(),
          content: values.content.trim(),
          nickname: values.nickname.trim(),
          visibility: values.visibility,
          password: values.password,
          website: String(data.get("website") ?? ""),
          startedAt: startedAt || Date.now(),
        }),
      });
      if (!response.ok) throw new Error(await apiErrorMessage(response, "글을 등록하지 못했습니다."));
      const payload = (await response.json()) as { id?: string };
      if (!payload.id) throw new Error("등록된 글의 주소를 확인하지 못했습니다.");
      router.push(`/qna/${encodeURIComponent(payload.id)}?created=1`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "글을 등록하지 못했습니다.");
      setSubmitting(false);
    }
  }

  return (
    <QnaFrame>
      <main className={`${styles.page} ${styles.narrowPage}`}>
        <div className={styles.breadcrumb}>
          <Link href="/qna">Q&amp;A 게시판</Link><span aria-hidden="true">›</span><b>새 글 쓰기</b>
        </div>

        <section className={styles.formIntro}>
          <span className={styles.eyebrow}>목소리를 들려주세요</span>
          <h1>어떤 이야기를<br />남기고 싶나요?</h1>
          <p>불편했던 순간도, 있었으면 하는 기능도 솔직하게 알려 주세요. 방학한칸 운영자가 직접 읽고 답변합니다.</p>
        </section>

        <aside className={styles.privacyNotice}>
          <span aria-hidden="true">🛟</span>
          <div>
            <b>아이의 개인정보를 보호해 주세요.</b>
            <p>아이 실명, 학교명, 전화번호, 집 주소, 구체적인 개인 일정은 게시글에 적지 말아 주세요.</p>
          </div>
        </aside>

        <form className={styles.formCard} onSubmit={handleSubmit}>
          <div className={styles.formSection}>
            <div className={styles.sectionNumber}>1</div>
            <div className={styles.sectionContent}>
              <fieldset>
                <legend>어떤 이야기인가요?</legend>
                <div className={styles.categoryOptions}>
                  <label className={values.category === "inquiry" ? styles.optionSelected : ""}>
                    <input
                      type="radio"
                      name="category"
                      value="inquiry"
                      checked={values.category === "inquiry"}
                      onChange={() => update("category", "inquiry")}
                    />
                    <span aria-hidden="true">💬</span><b>서비스 문의</b><small>사용법이 궁금해요</small>
                  </label>
                  <label className={values.category === "complaint" ? styles.optionSelected : ""}>
                    <input
                      type="radio"
                      name="category"
                      value="complaint"
                      checked={values.category === "complaint"}
                      onChange={() => update("category", "complaint")}
                    />
                    <span aria-hidden="true">🧩</span><b>불편 신고</b><small>이 부분이 불편해요</small>
                  </label>
                  <label className={values.category === "suggestion" ? styles.optionSelected : ""}>
                    <input
                      type="radio"
                      name="category"
                      value="suggestion"
                      checked={values.category === "suggestion"}
                      onChange={() => update("category", "suggestion")}
                    />
                    <span aria-hidden="true">💡</span><b>개선 제안</b><small>이런 기능은 어때요?</small>
                  </label>
                </div>
              </fieldset>
            </div>
          </div>

          <div className={styles.formSection}>
            <div className={styles.sectionNumber}>2</div>
            <div className={styles.sectionContent}>
              <h2>이야기를 적어 주세요</h2>
              <div className={styles.fieldGrid}>
                <label className={styles.field}>
                  <span>제목 <em>필수</em></span>
                  <input
                    type="text"
                    name="title"
                    value={values.title}
                    onChange={(event) => update("title", event.target.value)}
                    minLength={2}
                    maxLength={100}
                    placeholder="궁금하거나 불편했던 점을 한 줄로 적어 주세요"
                    required
                  />
                  <small>{values.title.length}/100</small>
                </label>
                <label className={styles.field}>
                  <span>내용 <em>필수</em></span>
                  <textarea
                    name="content"
                    value={values.content}
                    onChange={(event) => update("content", event.target.value)}
                    minLength={5}
                    maxLength={5000}
                    rows={9}
                    placeholder="어떤 상황에서 무엇이 궁금하거나 불편했는지 자세히 적어 주시면 더 정확히 답변할 수 있어요."
                    required
                  />
                  <small>{values.content.length}/5,000</small>
                </label>
              </div>
            </div>
          </div>

          <div className={styles.formSection}>
            <div className={styles.sectionNumber}>3</div>
            <div className={styles.sectionContent}>
              <h2>글을 지킬 정보를 정해 주세요</h2>
              <div className={styles.twoColumns}>
                <label className={styles.field}>
                  <span>작성자 별명 <em>필수</em></span>
                  <input
                    type="text"
                    name="nickname"
                    value={values.nickname}
                    onChange={(event) => update("nickname", event.target.value)}
                    maxLength={20}
                    placeholder="예: 여름방학맘"
                    autoComplete="nickname"
                    required
                  />
                </label>
                <div className={styles.field}>
                  <span>공개 여부 <em>필수</em></span>
                  <div className={styles.visibilityOptions}>
                    <label className={values.visibility === "public" ? styles.visibilitySelected : ""}>
                      <input
                        type="radio"
                        name="visibility"
                        value="public"
                        checked={values.visibility === "public"}
                        onChange={() => update("visibility", "public")}
                      />
                      <span aria-hidden="true">🌤️</span><b>공개</b>
                    </label>
                    <label className={values.visibility === "private" ? styles.visibilitySelected : ""}>
                      <input
                        type="radio"
                        name="visibility"
                        value="private"
                        checked={values.visibility === "private"}
                        onChange={() => update("visibility", "private")}
                      />
                      <span aria-hidden="true">🔒</span><b>비공개</b>
                    </label>
                  </div>
                </div>
                <label className={styles.field}>
                  <span>글 비밀번호 <em>필수</em></span>
                  <input
                    type="password"
                    name="password"
                    value={values.password}
                    onChange={(event) => update("password", event.target.value)}
                    minLength={4}
                    maxLength={72}
                    placeholder="4자 이상"
                    autoComplete="new-password"
                    required
                  />
                  <small>비공개 글 열람과 글 수정·삭제에 사용합니다.</small>
                </label>
                <label className={styles.field}>
                  <span>비밀번호 확인 <em>필수</em></span>
                  <input
                    type="password"
                    name="passwordConfirm"
                    value={values.passwordConfirm}
                    onChange={(event) => update("passwordConfirm", event.target.value)}
                    minLength={4}
                    maxLength={72}
                    placeholder="같은 비밀번호를 한 번 더 입력해 주세요"
                    autoComplete="new-password"
                    required
                  />
                  <small className={values.passwordConfirm && values.password !== values.passwordConfirm ? styles.mismatch : ""}>
                    {values.passwordConfirm && values.password !== values.passwordConfirm
                      ? "비밀번호가 일치하지 않아요."
                      : "비밀번호는 잊어버리면 찾을 수 없어요."}
                  </small>
                </label>
              </div>
              {values.visibility === "private" && (
                <p className={styles.privateGuide}>🔒 목록에서는 제목과 별명이 가려지며, 작성한 비밀번호를 입력해야 내용과 답변을 볼 수 있어요.</p>
              )}
            </div>
          </div>

          <div className={styles.honeypot} aria-hidden="true">
            <label>홈페이지<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
          </div>
          <input type="hidden" name="startedAt" value={startedAt || ""} readOnly />

          {error && <p className={styles.formError} role="alert">{error}</p>}

          <div className={styles.formActions}>
            <Link className={styles.secondaryButton} href="/qna">취소</Link>
            <button className={styles.primaryButton} type="submit" disabled={submitting || startedAt === 0}>
              {submitting ? "등록하고 있어요…" : "게시글 등록하기"}
              {!submitting && <span aria-hidden="true">→</span>}
            </button>
          </div>
          <p className={styles.passwordReminder}>글 비밀번호는 암호화되어 저장되며 운영자도 원래 비밀번호를 확인할 수 없습니다.</p>
        </form>
      </main>
    </QnaFrame>
  );
}
