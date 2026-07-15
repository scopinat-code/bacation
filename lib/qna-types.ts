export const QNA_CATEGORIES = ["inquiry", "complaint", "suggestion"] as const;
export type QnaCategory = (typeof QNA_CATEGORIES)[number];

export const QNA_DB_CATEGORIES = ["inquiry", "bug", "suggestion"] as const;
export type QnaDbCategory = (typeof QNA_DB_CATEGORIES)[number];

export const QNA_VISIBILITIES = ["public", "private"] as const;
export type QnaVisibility = (typeof QNA_VISIBILITIES)[number];
export type QnaStatus = "waiting" | "answered";

export const QNA_LIMITS = {
  nickname: { min: 1, max: 20 },
  title: { min: 2, max: 100 },
  content: { min: 5, max: 5_000 },
  answer: { min: 1, max: 5_000 },
  password: { min: 4, max: 100 },
  pageSize: 50,
  requestBytes: 16_384,
  passwordRequestBytes: 2_048,
  minimumFormFillMs: 2_500,
} as const;

export type QnaAnswer = {
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type QnaListItem = {
  id: string;
  category: QnaCategory;
  title: string;
  nickname: string;
  visibility: QnaVisibility;
  status: QnaStatus;
  createdAt: string;
  updatedAt: string;
  locked: boolean;
};

export type QnaDetail = QnaListItem & {
  content?: string;
  answer: QnaAnswer | null;
};

export type AdminQnaItem = Omit<QnaDetail, "content" | "locked"> & {
  content: string;
  locked: false;
  isHidden: boolean;
};

export type CreateQnaInput = {
  category: QnaCategory;
  visibility: QnaVisibility;
  nickname: string;
  title: string;
  content: string;
  password: string;
  website: string;
  startedAt: number;
};

export type UpdateQnaInput = {
  password: string;
  visibility: QnaVisibility;
  nickname: string;
  title: string;
  content: string;
};

export type AdminQnaPatch = {
  answer?: string | null;
  visibility?: QnaVisibility;
  isHidden?: boolean;
};

export class QnaRequestError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "QnaRequestError";
  }
}

const HTML_TAG_PATTERN = /<\/?[a-z][^>]*>/i;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new QnaRequestError("요청 형식이 올바르지 않습니다.");
  }
  return value as Record<string, unknown>;
}

function plainText(
  value: unknown,
  label: string,
  limits: { min: number; max: number },
) {
  if (typeof value !== "string") {
    throw new QnaRequestError(`${label}을(를) 입력해 주세요.`);
  }

  const normalized = value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();

  if (normalized.length < limits.min || normalized.length > limits.max) {
    throw new QnaRequestError(
      `${label}은(는) ${limits.min}자 이상 ${limits.max.toLocaleString("ko-KR")}자 이하로 입력해 주세요.`,
    );
  }
  if (HTML_TAG_PATTERN.test(normalized)) {
    throw new QnaRequestError(`${label}에는 HTML 태그를 사용할 수 없습니다.`);
  }
  return normalized;
}

function password(value: unknown) {
  if (typeof value !== "string") {
    throw new QnaRequestError("글 비밀번호를 입력해 주세요.");
  }
  const length = Array.from(value).length;
  if (
    length < QNA_LIMITS.password.min ||
    length > QNA_LIMITS.password.max ||
    new TextEncoder().encode(value).byteLength > 256
  ) {
    throw new QnaRequestError(
      `글 비밀번호는 ${QNA_LIMITS.password.min}자 이상 ${QNA_LIMITS.password.max}자 이하로 입력해 주세요.`,
    );
  }
  return value;
}

export function categoryToDb(category: QnaCategory): QnaDbCategory {
  return category === "complaint" ? "bug" : category;
}

export function categoryFromDb(category: QnaDbCategory): QnaCategory {
  return category === "bug" ? "complaint" : category;
}

export function parseQnaCategory(value: unknown): QnaCategory {
  if (typeof value !== "string" || !QNA_CATEGORIES.includes(value as QnaCategory)) {
    throw new QnaRequestError("문의 유형을 선택해 주세요.");
  }
  return value as QnaCategory;
}

export function parseQnaVisibility(value: unknown): QnaVisibility {
  if (typeof value !== "string" || !QNA_VISIBILITIES.includes(value as QnaVisibility)) {
    throw new QnaRequestError("공개 여부를 선택해 주세요.");
  }
  return value as QnaVisibility;
}

export function parseCreateQnaInput(value: unknown): CreateQnaInput {
  const body = record(value);
  const website = body.website === undefined ? "" : String(body.website).trim();
  const startedAt = typeof body.startedAt === "number" ? body.startedAt : Number.NaN;

  return {
    category: parseQnaCategory(body.category),
    visibility: parseQnaVisibility(body.visibility),
    nickname: plainText(body.nickname, "별명", QNA_LIMITS.nickname),
    title: plainText(body.title, "제목", QNA_LIMITS.title),
    content: plainText(body.content, "내용", QNA_LIMITS.content),
    password: password(body.password),
    website,
    startedAt,
  };
}

export function parseUpdateQnaInput(value: unknown): UpdateQnaInput {
  const body = record(value);
  return {
    password: password(body.password),
    visibility: parseQnaVisibility(body.visibility),
    nickname: plainText(body.nickname, "별명", QNA_LIMITS.nickname),
    title: plainText(body.title, "제목", QNA_LIMITS.title),
    content: plainText(body.content, "내용", QNA_LIMITS.content),
  };
}

export function parsePasswordBody(value: unknown) {
  return password(record(value).password);
}

export function parseAdminQnaPatch(value: unknown): AdminQnaPatch {
  const body = record(value);
  const patch: AdminQnaPatch = {};

  if (Object.hasOwn(body, "answer")) {
    if (body.answer === null || body.answer === "") {
      patch.answer = null;
    } else {
      patch.answer = plainText(body.answer, "관리자 답변", QNA_LIMITS.answer);
    }
  }
  if (Object.hasOwn(body, "visibility")) {
    patch.visibility = parseQnaVisibility(body.visibility);
  }
  if (Object.hasOwn(body, "isHidden")) {
    if (typeof body.isHidden !== "boolean") {
      throw new QnaRequestError("숨김 여부가 올바르지 않습니다.");
    }
    patch.isHidden = body.isHidden;
  }
  if (!Object.keys(patch).length) {
    throw new QnaRequestError("변경할 내용을 입력해 주세요.");
  }
  return patch;
}

export async function readQnaJson(
  request: Request,
  maxBytes: number = QNA_LIMITS.requestBytes,
) {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new QnaRequestError("입력 내용이 너무 깁니다.", 413);
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new QnaRequestError("입력 내용이 너무 깁니다.", 413);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new QnaRequestError("요청 형식이 올바르지 않습니다.");
  }
}

export function parsePagination(searchParams: URLSearchParams) {
  const rawPage = Number(searchParams.get("page") ?? 1);
  const rawLimit = Number(searchParams.get("limit") ?? 10);
  if (!Number.isInteger(rawPage) || rawPage < 1 || rawPage > 100_000) {
    throw new QnaRequestError("페이지 번호가 올바르지 않습니다.");
  }
  if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > QNA_LIMITS.pageSize) {
    throw new QnaRequestError(`한 번에 ${QNA_LIMITS.pageSize}개까지만 조회할 수 있습니다.`);
  }
  return { page: rawPage, limit: rawLimit };
}

export function validateQnaId(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new QnaRequestError("게시글 번호가 올바르지 않습니다.");
  }
  return id;
}
