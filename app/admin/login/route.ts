import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminCookieOptions, createAdminSession, verifyAdminPassword } from "@/lib/admin-auth";
import { consumeAdminLoginRateLimit } from "@/lib/qna-db";

export async function POST(request: Request) {
  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");
  const url = new URL("/admin", request.url);
  const rateLimit = await consumeAdminLoginRateLimit(request);

  if (!rateLimit.allowed) {
    url.searchParams.set("error", "rate-limit");
    return NextResponse.redirect(url, 303);
  }

  if (!verifyAdminPassword(password)) {
    url.searchParams.set("error", "invalid");
    return NextResponse.redirect(url, 303);
  }

  const token = createAdminSession();
  if (!token) {
    url.searchParams.set("error", "config");
    return NextResponse.redirect(url, 303);
  }

  const response = NextResponse.redirect(url, 303);
  // 이전 버전에서 /admin 경로로 발급한 쿠키를 정리합니다.
  response.cookies.set(ADMIN_COOKIE, "", { ...adminCookieOptions, path: "/admin", maxAge: 0 });
  response.cookies.set(ADMIN_COOKIE, token, adminCookieOptions);
  return response;
}
