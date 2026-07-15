import { deleteQnaAsAdmin, updateQnaAsAdmin } from "@/lib/qna-db";
import {
  parseAdminQnaPatch,
  readQnaJson,
  validateQnaId,
} from "@/lib/qna-types";
import {
  qnaErrorResponse,
  qnaJson,
  qnaNotFound,
  requireQnaAdmin,
} from "@/app/api/qna/_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH  /api/qna/admin/:id { answer?, visibility?, isHidden? } -> { item }
 * DELETE /api/qna/admin/:id -> 204
 */
export async function PATCH(request: Request, context: RouteContext) {
  const unauthorized = await requireQnaAdmin();
  if (unauthorized) return unauthorized;

  try {
    const id = validateQnaId((await context.params).id);
    const patch = parseAdminQnaPatch(await readQnaJson(request));
    const item = await updateQnaAsAdmin(id, patch);
    return item ? qnaJson({ item }) : qnaNotFound();
  } catch (error) {
    return qnaErrorResponse(error, "admin update");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const unauthorized = await requireQnaAdmin();
  if (unauthorized) return unauthorized;

  try {
    const id = validateQnaId((await context.params).id);
    return await deleteQnaAsAdmin(id)
      ? new Response(null, { status: 204 })
      : qnaNotFound();
  } catch (error) {
    return qnaErrorResponse(error, "admin delete");
  }
}
