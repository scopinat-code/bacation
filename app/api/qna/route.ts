import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  consumeQnaCreateRateLimit,
  createQna,
  createQnaRequestFingerprint,
  listPublicQna,
} from "@/lib/qna-db";
import {
  parseCreateQnaInput,
  parsePagination,
  QNA_LIMITS,
  QnaRequestError,
  readQnaJson,
} from "@/lib/qna-types";
import { noStoreHeaders, qnaErrorResponse, qnaJson } from "@/app/api/qna/_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public Q&A API contract
 * GET  /api/qna?page=1&limit=10 -> { items: QnaListItem[], total, page, limit }
 * POST /api/qna { category, visibility, nickname, title, content, password,
 *                 website, startedAt } -> { id }
 * `website` is a hidden honeypot and `startedAt` is the form-open time in epoch ms.
 */
export async function GET(request: Request) {
  try {
    const { page, limit } = parsePagination(new URL(request.url).searchParams);
    const result = await listPublicQna(page, limit);
    return qnaJson({ ...result, page, limit });
  } catch (error) {
    return qnaErrorResponse(error, "list");
  }
}

export async function POST(request: Request) {
  try {
    const input = parseCreateQnaInput(await readQnaJson(request));

    // Do not tell automated submitters that the honeypot was triggered.
    if (input.website) {
      return NextResponse.json(
        { id: randomUUID() },
        { status: 201, headers: noStoreHeaders },
      );
    }

    const elapsed = Date.now() - input.startedAt;
    if (
      !Number.isFinite(input.startedAt) ||
      input.startedAt <= 0 ||
      elapsed < QNA_LIMITS.minimumFormFillMs
    ) {
      throw new QnaRequestError("잠시 내용을 확인한 뒤 다시 등록해 주세요.", 429);
    }

    const fingerprint = createQnaRequestFingerprint(request);
    const rateLimit = await consumeQnaCreateRateLimit(fingerprint);
    if (!rateLimit.allowed) {
      return qnaJson(
        { error: "글을 연속으로 등록할 수 없습니다. 잠시 후 다시 시도해 주세요." },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        },
      );
    }

    const id = await createQna(input);
    return qnaJson({ id }, { status: 201 });
  } catch (error) {
    return qnaErrorResponse(error, "create");
  }
}
