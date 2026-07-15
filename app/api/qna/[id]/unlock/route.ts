import { unlockQna } from "@/lib/qna-db";
import {
  parsePasswordBody,
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

/** POST /api/qna/:id/unlock { password } -> full QnaDetail */
export async function POST(request: Request, context: RouteContext) {
  try {
    const id = validateQnaId((await context.params).id);
    const password = parsePasswordBody(
      await readQnaJson(request, QNA_LIMITS.passwordRequestBytes),
    );
    const limited = await limitQnaPasswordAttempt(request, id);
    if (limited) return limited;
    const result = await unlockQna(id, password);
    if (!result.ok) {
      return result.reason === "not_found" ? qnaNotFound() : qnaInvalidPassword();
    }
    return qnaJson(result.item);
  } catch (error) {
    return qnaErrorResponse(error, "unlock");
  }
}
