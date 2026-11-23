import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Columns3, List, Plus, Search, Users, MailX } from "lucide-react";
import { prisma } from "@/lib/db";
import { hasRole, requireUser } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/app/page";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { StageBadge, TierBadge } from "@/components/app/badges";
import { Badge } from "@/components/ui/badge";
import { BOOKING_PLATFORMS, LEAD_STAGES, STAGE_LABEL } from "@/lib/domain";
import { Kanban } from "./kanban";
import { cn } from "@/lib/utils";

export const metadata = { title: "Leads" };
const PAGE = 50;

type SP = { q?: string; stage?: string; tier?: string; city?: string; platform?: string; email?: string; view?: string; page?: string };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const view = sp.view === "kanban" ? "kanban" : "table";
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.LeadWhereInput = {
    ...(sp.q ? { OR: [{ name: { contains: sp.q, mode: "insensitive" } }, { phone: { contains: sp.q } }, { primaryEmail: { contains: sp.q, mode: "insensitive" } }, { city: { contains: sp.q, mode: "insensitive" } }] } : {}),
    ...(sp.stage && (LEAD_STAGES as readonly string[]).includes(sp.stage) ? { stage: sp.stage as never } : {}),
    ...(sp.tier ? (sp.tier === "NONE" ? { currentTier: null } : { currentTier: sp.tier as never }) : {}),
    ...(sp.city ? { city: sp.city } : {}),
    ...(sp.platform ? (sp.platform === "NONE" ? { bookingPlatform: null } : { bookingPlatform: sp.platform }) : {}),
    ...(sp.email === "yes" ? { primaryEmail: { not: null } } : sp.email === "no" ? { primaryEmail: null } : {}),
  };

  const [total, leads, cities] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      take: view === "kanban" ? 500 : PAGE,
      skip: view === "kanban" ? 0 : (page - 1) * PAGE,
      include: { calls: { select: { status: true } } },
    }),
    prisma.lead.findMany({ distinct: ["city"], select: { city: true }, where: { city: { not: null } }, orderBy: { city: "asc" } }),
  ]);
  const qs = (patch: Partial<SP>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/leads?${p}`;
  };
  const filtered = Object.entries(sp).some(([k, v]) => v && !["view", "page"].includes(k));

  return (
    <>
      <PageHeader
        title="Leads"
        description={`${total} salon${total === 1 ? "" : "s"}${filtered ? " match your filters" : ""}`}
        actions={
          <>
            <div className="flex rounded-md border bg-card p-0.5">
              <Link href={qs({ view: "table", page: undefined })} className={cn("flex items-center gap-1 rounded px-2.5 py-1.5 text-sm", view === "table" ? "bg-muted font-medium" : "text-muted-foreground")}>
                <List className="h-4 w-4" /> Table
              </Link>
              <Link href={qs({ view: "kanban", page: undefined })} className={cn("flex items-center gap-1 rounded px-2.5 py-1.5 text-sm", view === "kanban" ? "bg-muted font-medium" : "text-muted-foreground")}>
                <Columns3 className="h-4 w-4" /> Pipeline
              </Link>
            </div>
            {hasRole(user, "ADMIN") ? (
              <Button asChild>
                <Link href="/leads/import"><Plus /> Import salons</Link>
              </Button>
            ) : null}
          </>
        }
      />

      <form method="get" className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[2fr_repeat(5,1fr)_auto]">
        <input type="hidden" name="view" value={view} />
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input name="q" defaultValue={sp.q} placeholder="Search name, phone, email, city" className="pl-9" aria-label="Search" />
        </div>
        <Select name="stage" defaultValue={sp.stage ?? ""} aria-label="Stage">
          <option value="">All stages</option>
          {LEAD_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
        </Select>
        <Select name="tier" defaultValue={sp.tier ?? ""} aria-label="Score">
          <option value="">All scores</option>
          {["HOT", "WARM", "COLD", "DEAD"].map((t) => <option key={t} value={t}>{t[0] + t.slice(1).toLowerCase()}</option>)}
          <option value="NONE">Unscored</option>
        </Select>
        <Select name="city" defaultValue={sp.city ?? ""} aria-label="City">
          <option value="">All cities</option>
          {cities.map((c) => <option key={c.city} value={c.city!}>{c.city}</option>)}
        </Select>
        <Select name="platform" defaultValue={sp.platform ?? ""} aria-label="Booking platform">
          <option value="">Any platform</option>
          {BOOKING_PLATFORMS.map((p) => <option key={p}>{p}</option>)}
          <option value="NONE">None detected</option>
        </Select>
        <Select name="email" defaultValue={sp.email ?? ""} aria-label="Email">
          <option value="">Email: any</option>
          <option value="yes">Has email</option>
          <option value="no">No email</option>
        </Select>
        <div className="flex gap-2">
          <Button type="submit" variant="secondary">Filter</Button>
          {filtered ? <Button asChild variant="ghost"><Link href={`/leads?view=${view}`}>Clear</Link></Button> : null}
        </div>
      </form>

      {leads.length === 0 ? (
        <EmptyState icon={Users} title={filtered ? "No salons match these filters" : "No salons yet"}>
          {filtered ? "Try clearing a filter." : <>Import salons from Google Places or a CSV to get started{hasRole(user, "ADMIN") ? "" : " (ask an Admin)"}.</>}
        </EmptyState>
      ) : view === "kanban" ? (
        <Kanban
          canEdit={hasRole(user, "CALLER")}
          leads={leads.map((l) => ({ id: l.id, name: l.name, city: l.city, stage: l.stage, tier: l.currentTier, reason: l.scoreReason, hasEmail: !!l.primaryEmail, instagram: l.instagram }))}
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <THead>
              <TR><TH>Salon</TH><TH>Score</TH><TH className="hidden md:table-cell">Why</TH><TH>Stage</TH><TH className="hidden lg:table-cell">Booking</TH><TH className="hidden sm:table-cell">Reviews</TH><TH className="hidden sm:table-cell">Contact</TH></TR>
            </THead>
            <TBody>
              {leads.map((l) => {
                const done = l.calls.filter((c) => c.status === "COMPLETED").length;
                return (
                  <TR key={l.id}>
                    <TD>
                      <Link href={`/leads/${l.id}`} className="font-medium hover:underline">{l.name}</Link>
                      <p className="text-xs text-muted-foreground">{[l.city, l.state].filter(Boolean).join(", ")} · {l.phone ?? "no phone"}</p>
                    </TD>
                    <TD><TierBadge tier={l.currentTier} />{!l.currentTier && l.calls.length ? <p className="mt-0.5 text-xs text-muted-foreground">{done}/2 calls</p> : null}</TD>
                    <TD className="hidden max-w-sm text-xs text-muted-foreground md:table-cell">{l.scoreReason ?? ""}</TD>
                    <TD><StageBadge stage={l.stage} /></TD>
                    <TD className="hidden lg:table-cell">{l.bookingPlatform ?? <span className="text-muted-foreground">-</span>}</TD>
                    <TD className="hidden whitespace-nowrap sm:table-cell">{l.googleRating ? `${l.googleRating.toFixed(1)}★` : "-"} <span className="text-muted-foreground">({l.reviewCount ?? 0})</span></TD>
                    <TD className="hidden sm:table-cell">
                      {l.primaryEmail ? <span className="text-xs">{l.primaryEmail}</span> : <Badge variant="warning"><MailX className="h-3 w-3" /> No email{l.instagram ? " · IG" : ""}</Badge>}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
          {total > PAGE ? (
            <div className="flex items-center justify-between border-t p-3 text-sm">
              <span className="text-muted-foreground">Page {page} of {Math.ceil(total / PAGE)}</span>
              <div className="flex gap-2">
                {page > 1 ? <Button asChild variant="outline" size="sm"><Link href={qs({ page: String(page - 1) })}>Previous</Link></Button> : null}
                {page * PAGE < total ? <Button asChild variant="outline" size="sm"><Link href={qs({ page: String(page + 1) })}>Next</Link></Button> : null}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}
