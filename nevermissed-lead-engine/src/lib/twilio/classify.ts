/**
 * Classify an automated test call from Twilio call status + answering-machine
 * detection (pure). Anything ambiguous is flagged `needsReview` so a human can
 * listen to the greeting (where recording is permitted) and correct it.
 *
 * Twilio AnsweredBy: human | machine_start | machine_end_beep |
 *   machine_end_silence | machine_end_other | fax | unknown
 */
import type { CallOutcome } from "@/lib/domain";

export type TwilioCallFacts = {
  callStatus: string; // completed | busy | no-answer | failed | canceled
  answeredBy?: string | null;
  durationSec?: number | null;
  sipResponseCode?: number | null;
};

export type Classification = { outcome: CallOutcome; needsReview: boolean; note: string };

// SIP codes that mean the number itself is bad.
const DEAD_SIP = new Set([404, 410, 484, 604]);

export function classifyAutomatedCall(f: TwilioCallFacts): Classification {
  const status = f.callStatus.toLowerCase();
  const ab = (f.answeredBy ?? "unknown").toLowerCase();

  if (status === "busy") return { outcome: "BUSY", needsReview: false, note: "Line busy" };
  if (status === "failed") {
    if (f.sipResponseCode && DEAD_SIP.has(f.sipResponseCode)) {
      return { outcome: "DISCONNECTED_OR_WRONG_NUMBER", needsReview: false, note: `Carrier rejected the number (SIP ${f.sipResponseCode})` };
    }
    return { outcome: "DISCONNECTED_OR_WRONG_NUMBER", needsReview: true, note: `Call failed${f.sipResponseCode ? ` (SIP ${f.sipResponseCode})` : ""}; verify the number` };
  }
  if (status === "no-answer" || status === "canceled") {
    return { outcome: "NO_ANSWER_NO_VOICEMAIL", needsReview: false, note: "Rang out with no pickup" };
  }

  // completed — something picked up.
  switch (ab) {
    case "human":
      // AMD can't tell a person from an AI receptionist — review.
      return { outcome: "ANSWERED_HUMAN", needsReview: true, note: "AMD detected a human (could be an AI/answering service)" };
    case "machine_end_beep":
      return { outcome: "VOICEMAIL_BASIC", needsReview: true, note: "Voicemail with beep; listen for booking info" };
    case "machine_end_silence":
    case "machine_end_other":
      return { outcome: "VOICEMAIL_FULL", needsReview: true, note: "Greeting with no beep (often full mailbox or message-only)" };
    case "machine_start":
      return { outcome: "VOICEMAIL_BASIC", needsReview: true, note: "Machine detected early; listen to confirm" };
    case "fax":
      return { outcome: "DISCONNECTED_OR_WRONG_NUMBER", needsReview: true, note: "Fax tone" };
    default:
      if ((f.durationSec ?? 0) <= 3) return { outcome: "NO_ANSWER_NO_VOICEMAIL", needsReview: true, note: "Connected but silent/very short" };
      return { outcome: "VOICEMAIL_BASIC", needsReview: true, note: "Unknown answerer" };
  }
}

/** Map Twilio Lookup v2 line_type_intelligence.type to our LineType enum. */
export function mapLineType(t: string | null | undefined): "LANDLINE" | "MOBILE" | "VOIP" | "TOLL_FREE" | "UNKNOWN" {
  switch ((t ?? "").toLowerCase()) {
    case "landline":
      return "LANDLINE";
    case "mobile":
    case "personal":
      return "MOBILE";
    case "fixedvoip":
    case "nonfixedvoip":
    case "voip":
      return "VOIP";
    case "tollfree":
      return "TOLL_FREE";
    default:
      return "UNKNOWN";
  }
}
