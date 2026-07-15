export type QnaVisibility = "public" | "private";

export type QnaStatus = "waiting" | "answered" | string;

export type QnaListItem = {
  id: string;
  category: string;
  title: string;
  nickname: string;
  visibility: QnaVisibility;
  status: QnaStatus;
  createdAt: string;
};

export type QnaAnswer = {
  content: string;
  createdAt?: string;
  updatedAt?: string;
};

export type QnaDetail = QnaListItem & {
  content: string;
  updatedAt?: string;
  answer?: QnaAnswer | string | null;
  adminAnswer?: string | null;
  answeredAt?: string | null;
};

export type LockedQna = Partial<QnaListItem> & {
  id: string;
  locked: true;
};

const categoryLabels: Record<string, string> = {
  inquiry: "서비스 문의",
  question: "서비스 문의",
  complaint: "불편 신고",
  inconvenience: "불편 신고",
  suggestion: "개선 제안",
  improvement: "개선 제안",
  문의: "서비스 문의",
  불편: "불편 신고",
  제안: "개선 제안",
};

export function categoryLabel(category: string) {
  return categoryLabels[category] ?? category;
}
export function categoryTone(category: string) {
  if (["complaint", "inconvenience", "불편"].includes(category)) return "coral";
  if (["suggestion", "improvement", "제안"].includes(category)) return "mint";
  return "sky";
}

export function isAnswered(status: QnaStatus) {
  return ["answered", "complete", "completed", "답변완료"].includes(status);
}

export function formatQnaDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function getAnswer(detail: QnaDetail) {
  if (typeof detail.answer === "string") {
    return detail.answer ? { content: detail.answer, createdAt: detail.answeredAt ?? undefined } : null;
  }
  if (detail.answer?.content) return detail.answer;
  if (detail.adminAnswer) {
    return { content: detail.adminAnswer, createdAt: detail.answeredAt ?? undefined };
  }
  return null;
}

export async function apiErrorMessage(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: unknown; message?: unknown };
    if (typeof payload.message === "string" && payload.message.trim()) return payload.message;
    if (typeof payload.error === "string" && payload.error.trim()) return payload.error;
  } catch {
    // The fallback below also handles empty and non-JSON responses.
  }
  return fallback;
}
