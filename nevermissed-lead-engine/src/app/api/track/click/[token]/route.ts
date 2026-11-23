import { NextResponse, type NextRequest } from "next/server";
import { recordEngagement } from "@/lib/jobs/email";
import { verify } from "@/lib/crypto";

export const runtime = "nodejs";

/** Signed redirect: only URLs we put in the email can be redirected to (no open redirect). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const u = req.nextUrl.searchParams.get("u") ?? "";
  const s = req.nextUrl.searchParams.get("s") ?? "";
  if (!u || !s || !verify(token + "|" + u, s) || !/^https?:\/\//i.test(u)) return new NextResponse("Invalid link", { status: 400 });
  await recordEngagement("CLICKED", { token }, { url: u }).catch(() => null);
  return NextResponse.redirect(u, 302);
}
