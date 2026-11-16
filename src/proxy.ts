import { NextResponse, type NextRequest } from "next/server";

const locales = ["he", "en"];
const defaultLocale = "he";
const LOCALE_COOKIE = "locale";
const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Hebrew is the default language. A request without a locale prefix goes to
 * Hebrew unless the reader chose another language before: opening any page
 * under /en (the language link in the header, or a shared link) is that
 * choice, and it is remembered in a cookie. The browser's language setting
 * is deliberately not used.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const current = locales.find((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));
  const remembered = request.cookies.get(LOCALE_COOKIE)?.value;

  if (current) {
    if (remembered === current) return;
    const response = NextResponse.next();
    response.cookies.set(LOCALE_COOKIE, current, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
    return response;
  }

  const target = remembered && locales.includes(remembered) ? remembered : defaultLocale;
  const url = request.nextUrl.clone();
  url.pathname = `/${target}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip Next internals, API routes and files with an extension.
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
