/**
 * Turn a rendered plain-text email into the final text + HTML that goes out:
 * CAN-SPAM footer (physical address + one-click unsubscribe), optional open
 * pixel, click-tracking redirects, and List-Unsubscribe headers (RFC 8058).
 */
export type ComposeInput = {
  bodyText: string;
  businessName: string;
  businessAddress: string;
  unsubscribeUrl: string;
  /** If provided, links are rewritten through this function for click tracking. */
  trackLink?: (url: string) => string;
  openPixelUrl?: string;
};

export class ComplianceError extends Error {}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const URL_RE = /\bhttps?:\/\/[^\s<>"')]+[^\s<>"').,!?]/g;

export function composeEmail(input: ComposeInput) {
  if (!input.businessAddress.trim()) {
    throw new ComplianceError("A physical business address is required (Settings → General) before any email can be sent.");
  }
  const footerText = `\n\n--\n${input.businessName} · ${input.businessAddress.replace(/\s*\n\s*/g, ", ")}\nNot interested? Unsubscribe with one click: ${input.unsubscribeUrl}`;
  const text = input.bodyText.trimEnd() + footerText;

  const paragraphs = input.bodyText
    .trim()
    .split(/\n{2,}/)
    .map((p) => {
      const linked = escapeHtml(p).replace(URL_RE, (u) => {
        const raw = u.replace(/&amp;/g, "&");
        const href = input.trackLink ? input.trackLink(raw) : raw;
        return `<a href="${escapeHtml(href)}">${u}</a>`;
      });
      return `<p style="margin:0 0 14px">${linked.replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
  const footerHtml = `<p style="margin:24px 0 0;color:#6b7280;font-size:12px;line-height:1.5">${escapeHtml(input.businessName)} · ${escapeHtml(
    input.businessAddress.replace(/\s*\n\s*/g, ", "),
  )}<br><a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#6b7280">Unsubscribe</a></p>`;
  const pixel = input.openPixelUrl ? `<img src="${escapeHtml(input.openPixelUrl)}" width="1" height="1" alt="" style="display:none">` : "";
  const html = `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#111827">${paragraphs}${footerHtml}${pixel}</body></html>`;

  return {
    text,
    html,
    headers: {
      "List-Unsubscribe": `<${input.unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}
