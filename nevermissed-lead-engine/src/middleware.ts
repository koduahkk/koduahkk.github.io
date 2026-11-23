import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Keeps the Supabase session fresh and bounces signed-out visitors to /login.
 * Public routes (webhooks, tracking, unsubscribe, Inngest) are excluded in
 * `config.matcher`. Fine-grained role checks happen server-side.
 */
export async function middleware(req: NextRequest) {
  const res = NextResponse.next({ request: req });
  const isLogin = req.nextUrl.pathname.startsWith("/login") || req.nextUrl.pathname.startsWith("/auth");
  const demo = process.env.DEMO_MODE === "true" && (process.env.NODE_ENV !== "production" || process.env.ALLOW_DEMO_IN_PRODUCTION === "true");

  let signedIn = false;
  if (demo) {
    signedIn = !!req.cookies.get("nm_demo_user")?.value;
  } else if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => res.cookies.set(name, value, options)),
      },
    });
    const { data } = await sb.auth.getUser();
    signedIn = !!data.user;
  }

  if (!signedIn && !isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/|favicon|api/webhooks|api/inngest|api/cron|api/track|api/unsubscribe|unsubscribe|.*\\.(?:png|svg|ico|jpg)$).*)"],
};
