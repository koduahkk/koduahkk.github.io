/**
 * Drafts for the "manual channel" — leads without an email get an Instagram
 * DM and a walk-in script that use the same missed-call proof.
 */
import { renderTemplate, type MergeData } from "@/lib/email/merge";

export const IG_DM_TEMPLATE = `Hi {{owner_first_name}}! Love the work on your page. Quick one: I tried calling {{salon_name}} on {{missed_call_1_day}} at {{missed_call_1_time}}{{#missed_call_2_day}} and again {{missed_call_2_day}} at {{missed_call_2_time}}{{/missed_call_2_day}} and couldn't get through. Totally get it, you're busy with clients! We built an AI receptionist that picks up every call 24/7 and books appointments{{#booking_platform}} right into {{booking_platform}}{{/booking_platform}}. Want to hear it? {{#demo_phone}}Call {{demo_phone}}, it takes 60 seconds.{{/demo_phone}}`;

export const WALK_IN_TEMPLATE = `WALK-IN SCRIPT: {{salon_name}}{{#city}} ({{city}}){{/city}}

Best time: a slow weekday mid-morning. Ask for the owner or manager.

1. "Hi, I'm {{sender_name}}. I won't take long, I know you're busy."
2. Proof: "I called on {{missed_call_1_day}} at {{missed_call_1_time}}{{#missed_call_2_day}} and again on {{missed_call_2_day}} at {{missed_call_2_time}}{{/missed_call_2_day}} and couldn't reach anyone. Most people who can't get through just book somewhere else."
3. Offer: "We set up an AI receptionist that answers every call, handles price and availability questions, and books{{#booking_platform}} straight into {{booking_platform}}{{/booking_platform}}."
4. Demo: hand over your phone{{#demo_phone}} and dial {{demo_phone}}{{/demo_phone}}. Let them ask it something.
5. Close: "Can I set you up with a free trial this week?" Leave a card and get the best email.`;

export function instagramDraft(data: MergeData) {
  return renderTemplate(IG_DM_TEMPLATE, data);
}
export function walkInScript(data: MergeData) {
  return renderTemplate(WALK_IN_TEMPLATE, data);
}
