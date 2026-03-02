import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth/session";

const PUBLIC_PATHS = ["/login", "/register", "/api/auth/login", "/api/auth/register"];
const ADMIN_PATHS = ["/admin", "/api/admin"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isAdmin(pathname: string): boolean {
  return ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isApiMutation(request: NextRequest): boolean {
  const method = request.method;
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method);
}

function checkOrigin(request: NextRequest): boolean {
  const appUrl = process.env.APP_URL;
  if (!appUrl) return true;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const originHost = new URL(origin).host;
    // APP_URL may be a comma-separated list of allowed origins
    const allowedHosts = appUrl.split(",").map((u) => new URL(u.trim()).host);
    return allowedHosts.includes(originHost);
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/static")
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/") && isApiMutation(request)) {
    if (!checkOrigin(request)) {
      return NextResponse.json({ error: "Forbidden: Origin mismatch" }, { status: 403 });
    }
  }

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdmin(pathname) && session.role !== "ADMIN") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
