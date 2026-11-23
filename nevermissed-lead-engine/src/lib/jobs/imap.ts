/** Optional IMAP polling for replies (when inbound webhooks aren't set up). */
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { handleReply } from "@/lib/jobs/email";

export function imapConfigured() {
  return !!(process.env.IMAP_HOST && process.env.IMAP_USER && process.env.IMAP_PASSWORD);
}

export async function pollImap() {
  if (!imapConfigured()) return { skipped: "IMAP not configured" };
  const client = new ImapFlow({
    host: process.env.IMAP_HOST!,
    port: Number(process.env.IMAP_PORT ?? 993),
    secure: process.env.IMAP_SECURE !== "false",
    auth: { user: process.env.IMAP_USER!, pass: process.env.IMAP_PASSWORD! },
    logger: false,
  });
  await client.connect();
  let matched = 0, seen = 0;
  const lock = await client.getMailboxLock(process.env.IMAP_MAILBOX ?? "INBOX");
  try {
    const uids = (await client.search({ seen: false }, { uid: true })) || [];
    for (const uid of uids.slice(0, 100)) {
      const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
      if (!msg || !msg.source) continue;
      const parsed = await simpleParser(msg.source);
      seen++;
      const to = ([] as { text: string }[]).concat((parsed.to as { text: string } | { text: string }[] | undefined) ?? []).map((t) => t.text);
      const r = await handleReply({
        from: parsed.from?.text ?? "",
        to,
        subject: parsed.subject,
        text: parsed.text ?? "",
        inReplyTo: parsed.inReplyTo ?? null,
      });
      if (r) matched++;
      await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
    }
  } finally {
    lock.release();
    await client.logout();
  }
  return { seen, matched };
}
