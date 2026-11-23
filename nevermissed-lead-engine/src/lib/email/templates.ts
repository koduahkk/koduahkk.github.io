/** Default sequence templates (seeded; editable in the Sequence builder). */
export const DEFAULT_STEPS = [
  {
    order: 1,
    dayOffset: 0,
    templateKey: "tried_calling",
    name: "Tried calling twice",
    subject: "Tried calling {{salon_name}} twice",
    body: `Hi {{owner_first_name}},

I tried calling {{salon_name}} on {{missed_call_1_day}} at {{missed_call_1_time}}{{#missed_call_2_day}} and again on {{missed_call_2_day}} at {{missed_call_2_time}}{{/missed_call_2_day}}, and couldn't get through either time.

That's not a criticism. Your team is busy doing great work. But a missed call is often a lost booking: most callers won't leave a voicemail, they'll just try the next salon on Google.

That's why we built NeverMissed. It's an AI receptionist that answers every call 24/7, handles questions about pricing and availability, and books appointments{{#booking_platform}} straight into {{booking_platform}}{{/booking_platform}}{{^booking_platform}} right into your calendar{{/booking_platform}}.

Would a 10-minute demo this week be useful?{{#demo_link}} Grab a time here: {{demo_link}}{{/demo_link}}{{#demo_phone}}
Or call our demo line and hear it for yourself: {{demo_phone}}{{/demo_phone}}

{{sender_name}}`,
  },
  {
    order: 2,
    dayOffset: 3,
    templateKey: "hear_it_yourself",
    name: "Follow-up: hear it yourself",
    subject: "Re: Tried calling {{salon_name}} twice",
    body: `Hi {{owner_first_name}},

Quick follow-up. The easiest way to see if this fits {{salon_name}} is to hear it.{{#demo_phone}} Call {{demo_phone}} and ask it anything a client would ask you: prices, openings, booking.{{/demo_phone}} It takes about 60 seconds.

{{sender_name}}`,
  },
  {
    order: 3,
    dayOffset: 7,
    templateKey: "roi_math",
    name: "Value: the math on missed calls",
    subject: "The math on missed calls at {{salon_name}}",
    body: `Hi {{owner_first_name}},

One number worth thinking about: if you miss 5 calls a week and 1 in 3 of those would have booked a $60 service, that's about $400 a month walking away, before you count repeat visits.

{{#review_count}}With {{review_count}} reviews{{#google_rating}} at {{google_rating}} stars{{/google_rating}}, people clearly want to book with you. {{/review_count}}NeverMissed makes sure they can, even after hours.

Worth 10 minutes?{{#demo_link}} {{demo_link}}{{/demo_link}}

{{sender_name}}`,
  },
  {
    order: 4,
    dayOffset: 14,
    templateKey: "break_up",
    name: "Break-up",
    subject: "Should I close the loop?",
    body: `Hi {{owner_first_name}},

I haven't heard back, so I'll assume missed calls aren't a priority for {{salon_name}} right now. Totally fair, and I won't keep emailing.

If that changes, {{#demo_phone}}the demo line is always on: {{demo_phone}}. {{/demo_phone}}Just reply to this email and I'll get you set up.

Best of luck this season,
{{sender_name}}`,
  },
];
