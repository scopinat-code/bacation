import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminCookieOptions, createAdminSession, verifyAdminPassword } from "@/lib/admin-auth";

export async function POST(request: Request) {
  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");
  const url = new URL("/admin", request.url);

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
  response.cookies.set(ADMIN_COOKIE, token, adminCookieOptions);
  return response;
}
