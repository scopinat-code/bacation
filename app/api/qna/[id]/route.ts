import {
  deleteQnaAsAuthor,
  getPublicQna,
  updateQnaAsAuthor,
} from "@/lib/qna-db";
import {
  parsePasswordBody,
  parseUpdateQnaInput,
  QNA_LIMITS,
  readQnaJson,
  validateQnaId,
} from "@/lib/qna-types";
import {
  limitQnaPasswordAttempt,
  qnaErrorResponse,
  qnaInvalidPassword,
  qnaJson,
  qnaNotFound,
} from "@/app/api/qna/_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET    /api/qna/:id -> public full detail, or masked metadata with locked:true
 * PATCH  /api/qna/:id { password, title, content, nickname, visibility } -> { item }
 * DELETE /api/qna/:id { password } -> 204
 * Passwords are accepted in request bodies only, never URLs.
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const id = validateQnaId((await context.params).id);
    const item = await getPublicQna(id);
    return item ? qnaJson(item) : qnaNotFound();
  } catch (error) {
    return qnaErrorResponse(error, "detail");
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const id = validateQnaId((await context.params).id);
    const input = parseUpdateQnaInput(await readQnaJson(request));
    const limited = await limitQnaPasswordAttempt(request, id);
    if (limited) return limited;
    const result = await updateQnaAsAuthor(id, input);
    if (!result.ok) {
      return result.reason === "not_found" ? qnaNotFound() : qnaInvalidPassword();
    }
    return qnaJson({ item: result.item });
  } catch (error) {
    return qnaErrorResponse(error, "author update");
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const id = validateQnaId((await context.params).id);
    const password = parsePasswordBody(
      await readQnaJson(request, QNA_LIMITS.passwordRequestBytes),
    );
    const limited = await limitQnaPasswordAttempt(request, id);
    if (limited) return limited;
    const result = await deleteQnaAsAuthor(id, password);
    if (!result.ok) {
      return result.reason === "not_found" ? qnaNotFound() : qnaInvalidPassword();
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    return qnaErrorResponse(error, "author delete");
  }
}
