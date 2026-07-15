import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "@/lib/admin-auth";
import { consumeQnaPasswordRateLimit } from "@/lib/qna-db";
import { QnaRequestError } from "@/lib/qna-types";

export const noStoreHeaders = { "Cache-Control": "no-store" } as const;

export function qnaJson(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: { ...noStoreHeaders, ...init?.headers },
  });
}

export function qnaErrorResponse(error: unknown, operation: string) {
  if (error instanceof QnaRequestError) {
    return qnaJson({ error: error.message }, { status: error.status });
  }
  console.error(`Q&A ${operation} failed`, error);
  return qnaJson(
    { error: "잠시 문제가 발생했습니다. 잠시 후 다시 시도해 주세요." },
    { status: 503 },
  );
}

export function qnaNotFound() {
  return qnaJson({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
}

export function qnaInvalidPassword() {
  return qnaJson({ error: "글 비밀번호가 맞지 않습니다." }, { status: 403 });
}

export async function limitQnaPasswordAttempt(request: Request, id: string) {
  const rateLimit = await consumeQnaPasswordRateLimit(request, id);
  if (rateLimit.allowed) return null;
  return qnaJson(
    { error: "비밀번호를 여러 번 확인했습니다. 잠시 후 다시 시도해 주세요." },
    {
      status: 429,
      headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
    },
  );
}

export async function requireQnaAdmin() {
  const cookieStore = await cookies();
  if (!verifyAdminSession(cookieStore.get(ADMIN_COOKIE)?.value)) {
    return qnaJson({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  }
  return null;
}
