import { createHash, createHmac, randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { hashQnaPassword, verifyQnaPassword } from "./qna-password";
import {
  categoryFromDb,
  categoryToDb,
  type AdminQnaItem,
  type AdminQnaPatch,
  type CreateQnaInput,
  type QnaAnswer,
  type QnaDbCategory,
  type QnaDetail,
  type QnaListItem,
  type QnaStatus,
  type QnaVisibility,
  type UpdateQnaInput,
} from "./qna-types";

type QnaRow = {
  id: string;
  category: QnaDbCategory;
  visibility: QnaVisibility;
  nickname: string;
  title: string;
  content: string;
  answer_content: string | null;
  is_hidden: boolean;
  created_at: string | Date;
  updated_at: string | Date;
  answered_at: string | Date | null;
  answer_updated_at: string | Date | null;
};

type PasswordRow = QnaRow & { password_hash: string };

export type QnaAuthorResult<T> =
  | { ok: true; item: T }
  | { ok: false; reason: "not_found" | "invalid_password" };

function database() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured");
  return neon(connectionString);
}

function iso(value: string | Date) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function status(row: Pick<QnaRow, "answer_content">): QnaStatus {
  return row.answer_content ? "answered" : "waiting";
}

function answer(row: QnaRow): QnaAnswer | null {
  if (!row.answer_content || !row.answered_at || !row.answer_updated_at) return null;
  return {
    content: row.answer_content,
    createdAt: iso(row.answered_at),
    updatedAt: iso(row.answer_updated_at),
  };
}

function mapListItem(row: QnaRow): QnaListItem {
  const locked = row.visibility === "private";
  return {
    id: row.id,
    category: categoryFromDb(row.category),
    title: locked ? "비공개 문의입니다" : row.title,
    nickname: locked ? "비공개" : row.nickname,
    visibility: row.visibility,
    status: status(row),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    locked,
  };
}

function mapDetail(row: QnaRow, unlocked = false): QnaDetail {
  if (row.visibility === "private" && !unlocked) {
    return { ...mapListItem(row), answer: null };
  }
  return {
    id: row.id,
    category: categoryFromDb(row.category),
    title: row.title,
    nickname: row.nickname,
    content: row.content,
    visibility: row.visibility,
    status: status(row),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    locked: false,
    answer: answer(row),
  };
}

function mapAdminItem(row: QnaRow): AdminQnaItem {
  return {
    id: row.id,
    category: categoryFromDb(row.category),
    title: row.title,
    nickname: row.nickname,
    content: row.content,
    visibility: row.visibility,
    status: status(row),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    locked: false,
    answer: answer(row),
    isHidden: Boolean(row.is_hidden),
  };
}

export async function listPublicQna(page: number, limit: number) {
  const sql = database();
  const offset = (page - 1) * limit;
  const [rows, countRows] = await Promise.all([
    sql`
      SELECT id, category, visibility, nickname, title, content, answer_content,
             is_hidden, created_at, updated_at, answered_at, answer_updated_at
      FROM qna_posts
      WHERE is_hidden = false
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit} OFFSET ${offset}
    `,
    sql`SELECT COUNT(*)::int AS total FROM qna_posts WHERE is_hidden = false`,
  ]);

  return {
    items: (rows as QnaRow[]).map(mapListItem),
    total: Number(countRows[0]?.total ?? 0),
  };
}

export async function getPublicQna(id: string): Promise<QnaDetail | null> {
  const sql = database();
  const rows = await sql`
    SELECT id, category, visibility, nickname, title, content, answer_content,
           is_hidden, created_at, updated_at, answered_at, answer_updated_at
    FROM qna_posts
    WHERE id = ${id} AND is_hidden = false
    LIMIT 1
  `;
  const row = rows[0] as QnaRow | undefined;
  return row ? mapDetail(row) : null;
}

async function findWithPassword(id: string, includeHidden = false): Promise<PasswordRow | null> {
  const sql = database();
  const rows = includeHidden
    ? await sql`
        SELECT id, category, visibility, nickname, title, content, password_hash,
               answer_content, is_hidden, created_at, updated_at, answered_at, answer_updated_at
        FROM qna_posts WHERE id = ${id} LIMIT 1
      `
    : await sql`
        SELECT id, category, visibility, nickname, title, content, password_hash,
               answer_content, is_hidden, created_at, updated_at, answered_at, answer_updated_at
        FROM qna_posts WHERE id = ${id} AND is_hidden = false LIMIT 1
      `;
  return (rows[0] as PasswordRow | undefined) ?? null;
}

export async function unlockQna(id: string, password: string): Promise<QnaAuthorResult<QnaDetail>> {
  const row = await findWithPassword(id);
  if (!row) return { ok: false, reason: "not_found" };
  if (!await verifyQnaPassword(password, row.password_hash)) {
    return { ok: false, reason: "invalid_password" };
  }
  return { ok: true, item: mapDetail(row, true) };
}

export async function createQna(input: Omit<CreateQnaInput, "website" | "startedAt">) {
  const sql = database();
  const id = randomUUID();
  const passwordHash = await hashQnaPassword(input.password);
  await sql`
    INSERT INTO qna_posts (
      id, category, visibility, nickname, title, content, password_hash
    ) VALUES (
      ${id}, ${categoryToDb(input.category)}, ${input.visibility}, ${input.nickname},
      ${input.title}, ${input.content}, ${passwordHash}
    )
  `;
  return id;
}

export async function updateQnaAsAuthor(
  id: string,
  input: UpdateQnaInput,
): Promise<QnaAuthorResult<QnaDetail>> {
  const row = await findWithPassword(id, true);
  if (!row) return { ok: false, reason: "not_found" };
  if (!await verifyQnaPassword(input.password, row.password_hash)) {
    return { ok: false, reason: "invalid_password" };
  }

  const sql = database();
  const rows = await sql`
    UPDATE qna_posts
    SET visibility = ${input.visibility}, nickname = ${input.nickname}, title = ${input.title},
        content = ${input.content}, updated_at = now()
    WHERE id = ${id}
    RETURNING id, category, visibility, nickname, title, content, answer_content,
              is_hidden, created_at, updated_at, answered_at, answer_updated_at
  `;
  const updated = rows[0] as QnaRow | undefined;
  return updated
    ? { ok: true, item: mapDetail(updated, true) }
    : { ok: false, reason: "not_found" };
}

export async function deleteQnaAsAuthor(
  id: string,
  password: string,
): Promise<QnaAuthorResult<true>> {
  const row = await findWithPassword(id, true);
  if (!row) return { ok: false, reason: "not_found" };
  if (!await verifyQnaPassword(password, row.password_hash)) {
    return { ok: false, reason: "invalid_password" };
  }
  const sql = database();
  const rows = await sql`DELETE FROM qna_posts WHERE id = ${id} RETURNING id`;
  return rows.length
    ? { ok: true, item: true }
    : { ok: false, reason: "not_found" };
}

function fingerprintSecret() {
  const configured = process.env.ADMIN_SESSION_SECRET;
  if (configured) return configured;
  if (process.env.NODE_ENV === "development") {
    return createHash("sha256")
      .update("vacation-one-slot:qna:development-only-fingerprint-secret")
      .digest("hex");
  }
  throw new Error("ADMIN_SESSION_SECRET is required for Q&A request fingerprinting");
}

export function createQnaRequestFingerprint(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = request.headers.get("cf-connecting-ip")?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || forwarded
    || "unknown";
  return createHmac("sha256", fingerprintSecret())
    // User-Agent is deliberately excluded because the client can rotate it to
    // bypass a spam limit. Only a one-way HMAC of the network address is stored.
    .update(address.toLowerCase())
    .digest("hex");
}

export function createQnaPasswordFingerprint(request: Request, id: string) {
  return createHmac("sha256", fingerprintSecret())
    .update(`${createQnaRequestFingerprint(request)}\nqna:${id}`)
    .digest("hex");
}

async function consumeQnaRateLimit(
  fingerprintHash: string,
  action: "create" | "password" | "admin_login",
  maxAttempts: number,
  windowSeconds: number,
  slotMilliseconds: number,
) {
  const sql = database();
  const timeSlot = Math.floor(Date.now() / slotMilliseconds);
  const rows = await sql`
    WITH cleanup AS (
      DELETE FROM qna_rate_limits WHERE created_at < now() - interval '24 hours'
    ), recent AS (
      SELECT COUNT(*)::int AS attempts, MIN(created_at) AS oldest
      FROM qna_rate_limits
      WHERE fingerprint_hash = ${fingerprintHash}
        AND action = ${action}
        AND created_at >= now() - (${windowSeconds} * interval '1 second')
    ), inserted AS (
      INSERT INTO qna_rate_limits (fingerprint_hash, action, time_slot)
      SELECT ${fingerprintHash}, ${action}, ${timeSlot}
      FROM recent
      WHERE attempts < ${maxAttempts}
      ON CONFLICT (fingerprint_hash, action, time_slot) DO NOTHING
      RETURNING id
    )
    SELECT
      EXISTS (SELECT 1 FROM inserted) AS allowed,
      recent.attempts,
      CASE
        WHEN recent.attempts >= ${maxAttempts} THEN
          GREATEST(1, CEIL(EXTRACT(EPOCH FROM (recent.oldest + (${windowSeconds} * interval '1 second') - now()))))::int
        ELSE GREATEST(1, CEIL(${slotMilliseconds} / 1000.0))::int
      END AS retry_after_seconds
    FROM recent
  `;
  const row = rows[0];
  return {
    allowed: Boolean(row?.allowed),
    retryAfterSeconds: Number(row?.retry_after_seconds ?? 30),
  };
}

export function consumeQnaCreateRateLimit(fingerprintHash: string) {
  return consumeQnaRateLimit(fingerprintHash, "create", 5, 10 * 60, 30_000);
}

export function consumeQnaPasswordRateLimit(request: Request, id: string) {
  return consumeQnaRateLimit(
    createQnaPasswordFingerprint(request, id),
    "password",
    10,
    10 * 60,
    1_000,
  );
}

export function consumeAdminLoginRateLimit(request: Request) {
  const fingerprint = createHmac("sha256", fingerprintSecret())
    .update(`${createQnaRequestFingerprint(request)}\nadmin-login`)
    .digest("hex");
  return consumeQnaRateLimit(fingerprint, "admin_login", 10, 15 * 60, 1_000);
}

export async function listAllQnaForAdmin(page: number, limit: number) {
  const sql = database();
  const offset = (page - 1) * limit;
  const [rows, countRows] = await Promise.all([
    sql`
      SELECT id, category, visibility, nickname, title, content, answer_content,
             is_hidden, created_at, updated_at, answered_at, answer_updated_at
      FROM qna_posts
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit} OFFSET ${offset}
    `,
    sql`SELECT COUNT(*)::int AS total FROM qna_posts`,
  ]);
  return {
    items: (rows as QnaRow[]).map(mapAdminItem),
    total: Number(countRows[0]?.total ?? 0),
  };
}

export async function updateQnaAsAdmin(id: string, patch: AdminQnaPatch) {
  const sql = database();
  const hasAnswer = Object.hasOwn(patch, "answer");
  const hasVisibility = Object.hasOwn(patch, "visibility");
  const hasHidden = Object.hasOwn(patch, "isHidden");
  const answerValue = patch.answer ?? null;
  const visibilityValue = patch.visibility ?? "public";
  const hiddenValue = patch.isHidden ?? false;

  const rows = await sql`
    UPDATE qna_posts
    SET
      answer_content = CASE WHEN ${hasAnswer} THEN ${answerValue} ELSE answer_content END,
      answered_at = CASE
        WHEN ${hasAnswer} AND ${answerValue}::text IS NULL THEN NULL
        WHEN ${hasAnswer} THEN COALESCE(answered_at, now())
        ELSE answered_at
      END,
      answer_updated_at = CASE
        WHEN ${hasAnswer} AND ${answerValue}::text IS NULL THEN NULL
        WHEN ${hasAnswer} THEN now()
        ELSE answer_updated_at
      END,
      visibility = CASE WHEN ${hasVisibility} THEN ${visibilityValue} ELSE visibility END,
      is_hidden = CASE WHEN ${hasHidden} THEN ${hiddenValue} ELSE is_hidden END,
      updated_at = now()
    WHERE id = ${id}
    RETURNING id, category, visibility, nickname, title, content, answer_content,
              is_hidden, created_at, updated_at, answered_at, answer_updated_at
  `;
  const row = rows[0] as QnaRow | undefined;
  return row ? mapAdminItem(row) : null;
}

export async function answerQnaAsAdmin(id: string, answerContent: string | null) {
  return updateQnaAsAdmin(id, { answer: answerContent });
}

export async function updateQnaVisibilityAsAdmin(id: string, visibility: QnaVisibility) {
  return updateQnaAsAdmin(id, { visibility });
}

export async function updateQnaHiddenAsAdmin(id: string, isHidden: boolean) {
  return updateQnaAsAdmin(id, { isHidden });
}

export async function deleteQnaAsAdmin(id: string) {
  const sql = database();
  const rows = await sql`DELETE FROM qna_posts WHERE id = ${id} RETURNING id`;
  return rows.length > 0;
}
