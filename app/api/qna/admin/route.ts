import { listAllQnaForAdmin } from "@/lib/qna-db";
import { parsePagination } from "@/lib/qna-types";
import {
  qnaErrorResponse,
  qnaJson,
  requireQnaAdmin,
} from "@/app/api/qna/_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/qna/admin?page=1&limit=20 -> { items: AdminQnaItem[], total, page, limit } */
export async function GET(request: Request) {
  const unauthorized = await requireQnaAdmin();
  if (unauthorized) return unauthorized;

  try {
    const { page, limit } = parsePagination(new URL(request.url).searchParams);
    const result = await listAllQnaForAdmin(page, limit);
    return qnaJson({ ...result, page, limit });
  } catch (error) {
    return qnaErrorResponse(error, "admin list");
  }
}
