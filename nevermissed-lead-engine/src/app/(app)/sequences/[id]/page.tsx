import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { hasRole, requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { buildMergeData } from "@/lib/email/merge";
import { PageHeader } from "@/components/app/page";
import { SequenceBuilder } from "./builder";

export const metadata = { title: "Sequence builder" };

export default async function SequencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const seq = await prisma.sequence.findUnique({ where: { id }, include: { steps: { orderBy: { order: "asc" } } } });
  if (!seq) notFound();
  const settings = await getSettings();
  const leads = await prisma.lead.findMany({ where: { currentTier: { in: ["HOT", "WARM"] } }, include: { calls: true }, take: 10, orderBy: { updatedAt: "desc" } });
  const samples = leads.map((l) => ({ id: l.id, name: l.name, data: buildMergeData(l, l.calls, { senderName: settings.general.senderName, demoLink: settings.general.demoLink, demoPhone: settings.general.demoPhone, rules: settings.scoring }) }));
  if (!samples.length) samples.push({ id: "sample", name: "Sample salon", data: { salon_name: "Glow Studio", owner_first_name: "", city: "Atlanta", missed_call_1_day: "Tuesday", missed_call_1_time: "12:40pm", missed_call_2_day: "Thursday", missed_call_2_time: "7:15pm", booking_platform: "Vagaro", review_count: "212", google_rating: "4.8", sender_name: settings.general.senderName, demo_link: settings.general.demoLink, demo_phone: settings.general.demoPhone } });
  const footer = `--\n${settings.general.businessName} · ${settings.general.businessAddress || "⚠ business address not set (required)"}\nNot interested? Unsubscribe with one click: <link>`;

  return (
    <>
      <Link href="/sequences" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Sequences</Link>
      <PageHeader title={seq.name} description="Steps send in the lead's local business hours, with random spacing and per-mailbox daily limits." />
      <SequenceBuilder
        id={seq.id}
        canEdit={hasRole(user, "ADMIN")}
        samples={samples}
        footer={footer}
        initial={{ name: seq.name, description: seq.description ?? "", active: seq.active, stopOnReply: seq.stopOnReply, autoEnrollTiers: seq.autoEnrollTiers.filter((t): t is "HOT" | "WARM" | "COLD" => t !== "DEAD"), steps: seq.steps.map((s) => ({ id: s.id, dayOffset: s.dayOffset, name: s.name, subject: s.subject, body: s.body, templateKey: s.templateKey })) }}
      />
    </>
  );
}
