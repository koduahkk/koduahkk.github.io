/* =====================================================================
   NeverMissed — site content config
   ---------------------------------------------------------------------
   Every business fact, phone number, price and placeholder lives here.
   Edit this file, then run `node nevermissed/build.mjs` to regenerate
   the HTML pages.

   ph(value, note) wraps a value in a visibly-marked placeholder span
   (dashed underline + tooltip). When you have the real value, replace
   ph('X') with the plain string, e.g. goLiveDays: '7'.
   ===================================================================== */

export const ph = (value, note = 'Placeholder: replace before launch') =>
  `<span class="ph" title="${note}">${value}</span>`;

export const site = {
  name: 'NeverMissed',
  tagline: 'Every call answered. Every lead captured. Every hour of the day.',
  url: 'https://koduahkk.github.io/nevermissed/', // [PLACEHOLDER] swap for your real domain
  // [PLACEHOLDER] 555-01xx numbers are reserved fictional numbers.
  phone: { display: '(555) 010-0123', tel: '+15550100123' },
  demoPhone: { display: '(555) 010-0199', tel: '+15550100199' },
  email: 'hello@nevermissed.example', // [PLACEHOLDER]
  address: '[City, State]', // [PLACEHOLDER]

  // Leave empty to show a styled placeholder. Paste a Cal.com / Calendly
  // inline-embed URL (e.g. https://cal.com/your-team/demo?embed=true) to go live.
  bookingEmbedUrl: '',
  // Leave empty and the form shows a success state without sending data.
  // Set to a Formspree / Basin / your own endpoint to POST the form as JSON.
  formEndpoint: '',

  goLiveDays: '5',
  clientCount: '200',
  // Logo strip under the hero ("Trusted by 200+ businesses").
  // [CONFIRM] Only list real clients who have agreed to be shown.
  // icon: scissors | sparkle | dumbbell | pole | tooth | flame
  // style: picks the wordmark treatment in main.css (.cl--<style>)
  clients: [
    { name: 'Person Salon', icon: 'scissors', style: 'salon', main: 'person salon' },
    { name: 'Hercules Detailing', icon: 'sparkle', style: 'detail', main: 'Hercules', sub: 'Detailing' },
    { name: 'Fits Gym', icon: 'dumbbell', style: 'gym', main: 'Fits Gym' },
    { name: 'Sam\u2019s Barbering', icon: 'pole', style: 'barber', main: 'Sam\u2019s Barbering' },
    { name: 'Brightside Dental', icon: 'tooth', style: 'dental', main: 'brightside', sub: 'dental' },
    { name: 'Northline Heating & Air', icon: 'flame', style: 'hvac', main: 'Northline', sub: 'Heating & Air' },
  ],
  languages: `English, Spanish ${ph('+ more', 'Placeholder: list the languages you support')}`,
  social: {
    linkedin: '#', // [PLACEHOLDER]
    instagram: '#', // [PLACEHOLDER]
    youtube: '#', // [PLACEHOLDER]
  },
};

/* --- Results / case studies (homepage "Results" section) -------------
   HOW TO ADD A REAL RESULT: replace an entry with the client's real numbers
   and words (with their permission) and delete `sample: true`.
   Entries marked `sample: true` show a visible "Sample result" tag so they
   are never presented as a real customer's outcome. Up to 3 cards fit a row.
     metric  the big number           metricLabel  what it measures
     quote   1–2 sentences, their words
     who     name or role (e.g. "Dana Ruiz, Owner" or "Owner")
     business, industry, initials (avatar; or set photo: 'assets/img/clients/x.jpg') */
export const results = [
  {
    sample: true,
    metric: '+31%',
    metricLabel: 'more appointments booked in the first 60 days',
    quote: 'We used to lose bookings every time we were mid-color. Now every call gets answered, and last-minute cancellations get filled before we even notice.',
    who: 'Owner',
    business: 'Person Salon',
    industry: 'Salons & Spas',
    initials: 'PS',
  },
  {
    sample: true,
    metric: '$8,400',
    metricLabel: 'in jobs booked from after-hours calls, month one',
    quote: 'Most customers call after work, when we\u2019re out detailing. Those calls used to hit voicemail. Now they\u2019re booked before we open the next morning.',
    who: 'Owner',
    business: 'Hercules Detailing',
    industry: 'Auto',
    initials: 'HD',
  },
  {
    sample: true,
    metric: '142',
    metricLabel: 'trial classes booked after hours in 90 days',
    quote: 'People decide to join at 10 PM. Now someone answers, books the trial and texts the details, and our front desk finally gets to focus on members.',
    who: 'General Manager',
    business: 'Fits Gym',
    industry: 'Gyms & Fitness',
    initials: 'FG',
  },
];

/* --- Pricing ---------------------------------------------------------
   Monthly prices and setup fees are confirmed.
   Annual billing = "N months free": the build sets each tier's annual price to
   monthly × (12 − N) ÷ 12, rounded DOWN so the yearly total never exceeds the
   promise (e.g. $399 → $332/mo, $3,984/yr). Set `annual` on a tier to override.
   Set annualMonthsFree to 0 to hide the Monthly/Annual toggle.
   [CONFIRM] included minutes and feature lists. */
export const pricing = {
  annualMonthsFree: 2,
  tiers: [
    {
      id: 'starter',
      name: 'Starter',
      blurb: 'For a single location that wants nights and weekends covered.',
      monthly: 399,
      annual: null,
      minutes: '300 minutes / mo',
      setup: '$999 one-time setup',
      features: [
        '24/7 call answering',
        'Booking and rescheduling (1 calendar)',
        'FAQ answers in your voice',
        'Call summaries by text and email',
        'Monthly performance report',
      ],
    },
    {
      id: 'growth',
      name: 'Growth',
      popular: true,
      blurb: 'For busy offices that live on the phone all day.',
      monthly: 699,
      annual: null,
      minutes: '1,000 minutes / mo',
      setup: '$999 one-time setup',
      features: [
        'Everything in Starter',
        'Lead qualification and CRM sync',
        'Live transfer to your team',
        'Multiple calendars and staff',
        'Bilingual receptionist',
        'Monthly tuning call with us',
      ],
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      blurb: 'For multi-location groups, franchises and call-heavy teams.',
      monthly: null,
      annual: null,
      minutes: 'Custom minute pool',
      setup: 'Custom onboarding',
      features: [
        'Everything in Growth',
        'Multiple locations and numbers',
        'Custom integrations',
        'Dedicated success manager',
        'Priority support and SLA',
      ],
    },
  ],
};

/* --- Sample calls for the "Hear it for yourself" players --------------
   `src` is empty, so the player runs the transcript on a timer.
   [PLACEHOLDER] Drop a recording into nevermissed/assets/audio/ and set
   src: 'assets/audio/dental.mp3'. Set each line's `t` (seconds) to match
   the recording so the transcript stays in sync. */
export const demos = [
  {
    id: 'dental',
    industry: 'Dental',
    title: 'New patient, cracked tooth',
    time: 'Tue 9:14 PM',
    src: '',
    duration: 46,
    outcome: 'Booked: Thu 8:30 AM',
    lines: [
      { t: 0, who: 'ai', text: 'Thanks for calling Brightside Dental, this is Ava. How can I help tonight?' },
      { t: 5, who: 'caller', text: 'Hi, I think I cracked a tooth at dinner. Are you even open?' },
      { t: 10, who: 'ai', text: "Ouch, I'm sorry. The office is closed, but I can get you in first thing. Are you a current patient?" },
      { t: 17, who: 'caller', text: "No, I'm new. Do you take Delta Dental?" },
      { t: 21, who: 'ai', text: 'We do. I have Thursday at 8:30 AM, our first slot for urgent visits. Want it?' },
      { t: 28, who: 'caller', text: 'Yes, please.' },
      { t: 30, who: 'ai', text: "You're booked. I'm texting you the new-patient form and directions now." },
      { t: 37, who: 'caller', text: 'Wow, that was easy. Thank you.' },
      { t: 40, who: 'ai', text: 'Of course. Avoid chewing on that side until then. See you Thursday.' },
    ],
  },
  {
    id: 'hvac',
    industry: 'HVAC',
    title: 'No heat at 11 PM',
    time: 'Sat 11:02 PM',
    src: '',
    duration: 44,
    outcome: 'Transferred to on-call tech',
    lines: [
      { t: 0, who: 'ai', text: 'Northline Heating and Air, this is Sam. What can I do for you?' },
      { t: 4, who: 'caller', text: "Our furnace just died and it's 20 degrees out. We have a baby at home." },
      { t: 10, who: 'ai', text: "That's an emergency, so I'll get you to our on-call tech right now. What's your address?" },
      { t: 17, who: 'caller', text: '418 Birch Lane, Oakdale.' },
      { t: 21, who: 'ai', text: 'Got it. Is the thermostat on, and are you smelling any gas?' },
      { t: 26, who: 'caller', text: "It's on. No gas smell." },
      { t: 29, who: 'ai', text: "Good. I'm connecting you to Mike now. I've already sent him your details so you won't repeat yourself." },
      { t: 38, who: 'caller', text: 'Thank you so much.' },
    ],
  },
  {
    id: 'legal',
    industry: 'Law firm',
    title: 'Personal injury intake',
    time: 'Sun 7:40 AM',
    src: '',
    duration: 50,
    outcome: 'Consult booked + intake sent',
    lines: [
      { t: 0, who: 'ai', text: 'Good morning, Harlow and Price Law. This is Jordan. How can I help?' },
      { t: 5, who: 'caller', text: 'I was rear-ended yesterday and the other driver’s insurance already called me.' },
      { t: 11, who: 'ai', text: "I'm sorry that happened. Before you talk to them, let's get you a free consult. Were you hurt?" },
      { t: 18, who: 'caller', text: 'My neck is pretty stiff. I went to urgent care.' },
      { t: 22, who: 'ai', text: 'Thank you. Did police come to the scene, and which state did this happen in?' },
      { t: 28, who: 'caller', text: 'Yes, there was a police report. It was here in Ohio.' },
      { t: 32, who: 'ai', text: "That helps. Attorney Price can speak with you Monday at 10. I'll text you a short intake form." },
      { t: 41, who: 'caller', text: 'Perfect.' },
      { t: 43, who: 'ai', text: "Until then, it's best not to give the insurer a recorded statement. Talk Monday." },
    ],
  },
  {
    id: 'salon',
    industry: 'Salon',
    title: 'Reschedule, same stylist',
    time: 'Fri 12:31 PM',
    src: '',
    duration: 34,
    outcome: 'Moved to Sat 11:00 AM',
    lines: [
      { t: 0, who: 'ai', text: 'Hi, thanks for calling Fern Studio. This is Ava.' },
      { t: 3, who: 'caller', text: 'Hi! I need to move my color appointment with Dana tomorrow.' },
      { t: 8, who: 'ai', text: 'No problem, I see you at 3 PM with Dana. She has Saturday at 11 or next Tuesday at 4.' },
      { t: 15, who: 'caller', text: 'Saturday at 11 is great.' },
      { t: 18, who: 'ai', text: "Done. You're with Dana Saturday at 11 AM. Same service, full color and gloss." },
      { t: 24, who: 'caller', text: 'Amazing, thanks.' },
      { t: 26, who: 'ai', text: 'Happy to help. You’ll get a reminder text Friday. Have a great day!' },
    ],
  },
];

/* --- Industries (homepage tabs + one landing page each) --------------- */
export const industries = [
  {
    slug: 'dental',
    inSentence: 'dental',
    name: 'Dental',
    headline: 'Fill the chair, not the voicemail box.',
    sub: 'New patients call when it hurts, often after hours. Your AI receptionist books them before they call the next practice on Google.',
    useCases: [
      ['New-patient booking', 'Checks insurance you accept and books straight into your schedule.'],
      ['Urgent and emergency triage', 'Spots pain, swelling and trauma and routes them to your first open slot or on-call dentist.'],
      ['Reminders and reschedules', 'Moves appointments without the phone tag, so fewer gaps in your day.'],
    ],
    demo: 'dental',
    snippet: [
      ['caller', 'Do you take Delta Dental?'],
      ['ai', 'We do. I have Thursday at 8:30 AM for urgent visits. Want it?'],
    ],
  },
  {
    slug: 'medical',
    inSentence: 'medical',
    name: 'Medical',
    headline: 'Patients get answers. Your front desk gets a breather.',
    sub: 'Hold times drive patients away. NeverMissed handles booking, refills routing and common questions so your staff can care for the people in the room.',
    useCases: [
      ['Appointment scheduling', 'Books, confirms and reschedules by provider, visit type and location.'],
      ['Smart routing', 'Sends refill requests, referrals and billing questions to the right person with a summary.'],
      ['After-hours coverage', 'Answers overnight and flags anything urgent to your on-call provider.'],
    ],
    demo: null,
    snippet: [
      ['caller', 'I need to see Dr. Patel about my blood pressure.'],
      ['ai', 'I can help. She has Wednesday at 9:40 or Friday at 2. Which works?'],
    ],
  },
  {
    slug: 'hvac',
    inSentence: 'HVAC',
    name: 'HVAC',
    headline: 'The 11 PM no-heat call is your best job of the week.',
    sub: 'Emergencies don’t wait for business hours. Your AI receptionist triages, dispatches and books maintenance while your techs stay on the tools.',
    useCases: [
      ['Emergency triage and dispatch', 'Asks the right safety questions and live-transfers true emergencies to your on-call tech.'],
      ['Service and estimate booking', 'Books tune-ups and quotes by zone, so trucks aren’t zigzagging across town.'],
      ['Seasonal rush handling', 'Takes every call during the first heat wave, even ten at once.'],
    ],
    demo: 'hvac',
    snippet: [
      ['caller', 'Our furnace died and it’s 20 degrees out.'],
      ['ai', 'That’s an emergency. Connecting you to our on-call tech now.'],
    ],
  },
  {
    slug: 'home-services',
    inSentence: 'plumbing & electrical',
    name: 'Plumbing & Electrical',
    headline: 'Every burst pipe goes to you, not the next number on Google.',
    sub: 'Homeowners in a panic call down the list until someone picks up. Make sure it’s you, day or night.',
    useCases: [
      ['Job intake', 'Captures the problem, address, photos by text and urgency before your callback.'],
      ['Estimate scheduling', 'Books on-site quotes into your field calendar or Jobber/ServiceTitan.'],
      ['Spam and sales filtering', 'Screens out robocalls and vendors so your team only hears from customers.'],
    ],
    demo: null,
    snippet: [
      ['caller', 'Water is coming through my kitchen ceiling.'],
      ['ai', 'First, let’s shut off your main valve. Then I’ll get a plumber to you tonight.'],
    ],
  },
  {
    slug: 'legal',
    inSentence: 'law firms',
    name: 'Law Firms',
    headline: 'The client who calls first, hires first.',
    sub: 'Prospective clients call several firms. NeverMissed answers instantly, runs your intake questions and books the consult before anyone else calls back.',
    useCases: [
      ['Case intake', 'Asks your screening questions by practice area and flags strong cases.'],
      ['Consult booking', 'Puts qualified leads on the right attorney’s calendar.'],
      ['Existing-client calls', 'Takes detailed messages and routes them to the right paralegal.'],
    ],
    demo: 'legal',
    snippet: [
      ['caller', 'I was rear-ended yesterday.'],
      ['ai', 'I’m sorry. Let’s get you a free consult. Were you hurt?'],
    ],
  },
  {
    slug: 'salons-spas',
    inSentence: 'salons & spas',
    name: 'Salons & Spas',
    headline: 'Keep your hands on clients, not the phone.',
    sub: 'Every call you can’t answer mid-service is a booking that walks. Your AI receptionist books, moves and fills cancellations for you.',
    useCases: [
      ['Booking by stylist and service', 'Knows who does what, how long it takes and what it costs.'],
      ['Reschedules and waitlists', 'Fills last-minute cancellations from your waitlist automatically.'],
      ['Pricing and policy questions', 'Answers deposits, prep and parking questions the way you would.'],
    ],
    demo: 'salon',
    snippet: [
      ['caller', 'Can I move my color with Dana?'],
      ['ai', 'Of course. She has Saturday at 11 or Tuesday at 4.'],
    ],
  },
  {
    slug: 'gyms',
    inSentence: 'gyms & fitness studios',
    name: 'Gyms & Fitness',
    headline: 'Turn every \u201chow much is a membership?\u201d call into a tour.',
    sub: 'People decide to join at 9 PM, not 9 AM. Your AI receptionist answers, books the tour or trial class, and moves members\u2019 sessions, so your front desk can focus on the people in the building.',
    useCases: [
      ['Tours and trial passes', 'Answers membership and pricing questions, then books a tour or free trial class.'],
      ['Class and PT scheduling', 'Books, reschedules and waitlists classes and personal-training sessions by coach.'],
      ['Member questions', 'Handles hours, guest passes, freezes and billing questions, and routes cancellations to your team.'],
    ],
    demo: null,
    snippet: [
      ['caller', 'Can I move my 6 AM spin class to tomorrow?'],
      ['ai', 'Done. You\u2019re in Thursday\u2019s 6 AM with Coach Ray. I\u2019ve texted you the confirmation.'],
    ],
  },
  {
    slug: 'real-estate',
    inSentence: 'real estate',
    name: 'Real Estate',
    headline: 'Answer the sign call while the buyer is still at the curb.',
    sub: 'Buyer and seller leads go cold in minutes. NeverMissed answers listing calls, qualifies the lead and books the showing.',
    useCases: [
      ['Listing inquiries', 'Answers price, beds, baths and HOA questions about any listing.'],
      ['Lead qualification', 'Asks about timeline, pre-approval and budget, then syncs to your CRM.'],
      ['Showing scheduling', 'Books showings and seller consults straight into your calendar.'],
    ],
    demo: null,
    snippet: [
      ['caller', 'I’m outside 22 Elm. Is it still available?'],
      ['ai', 'It is. Are you pre-approved? I can book a showing for today.'],
    ],
  },
  {
    slug: 'auto',
    inSentence: 'auto shops',
    name: 'Auto Shops',
    headline: 'More cars in the bays. Fewer calls in the way.',
    sub: 'Your service writers can’t quote, write up and answer the phone at once. Your AI receptionist books the appointment and answers “is my car ready?”',
    useCases: [
      ['Service appointments', 'Books oil changes, inspections and diagnostics by bay availability.'],
      ['Status updates', 'Takes “is it ready?” calls and texts the customer when it is.'],
      ['Quote requests', 'Captures year, make, model and symptoms for your service writer.'],
    ],
    demo: null,
    snippet: [
      ['caller', 'My check-engine light came on.'],
      ['ai', 'I can get you in tomorrow at 8 for a diagnostic. What’s the year and model?'],
    ],
  },
];

/* --- FAQ (also emitted as FAQPage schema) ------------------------------
   `a` is HTML. Schema text is derived by stripping tags. */
export const faqs = [
  {
    q: 'Will callers know it’s AI?',
    a: 'Most callers just hear a warm, natural voice that gets their problem solved. We never pretend it’s a person if someone asks, and you choose how it introduces itself. In our experience callers care far more about getting booked than about who picked up.',
  },
  {
    q: 'What if the AI can’t answer a question?',
    a: 'It says so, honestly, and then does what you’d want: takes a detailed message, books a callback, or transfers the call live to you or your team. You set the rules. It never makes up prices or policies you haven’t given it.',
  },
  {
    q: 'Can callers reschedule or cancel by phone?',
    a: 'Yes. Callers can move or cancel an appointment any time, day or night. NeverMissed finds them a new slot, updates your calendar and texts a confirmation. You set the rules, like how much notice you need and which cancellations come to you first.',
  },
  {
    q: 'How long does setup take?',
    a: `Most businesses go live in about ${site.goLiveDays} days after the discovery call. We do the building, training and testing. You review it, call it yourself, and approve before a single customer hears it.`,
  },
  {
    q: 'Can it use my existing phone number?',
    a: 'Yes. Keep your number. We set up call forwarding so NeverMissed answers when you don’t, after a set number of rings, after hours, or all the time. You can switch it off in seconds.',
  },
  {
    q: 'Is my data secure? Is it HIPAA-friendly?',
    a: `Calls and transcripts are encrypted in transit and at rest, and access is limited to your team. <span class="ph" title="Placeholder: confirm your actual compliance posture before launch">[CONFIRM: HIPAA status, BAA availability, data retention policy]</span>`,
  },
  {
    q: 'What happens to calls during an outage?',
    a: `<span class="ph" title="Placeholder: confirm your failover setup">[CONFIRM]</span> If the AI service is ever unavailable, calls automatically fall back to your phone or voicemail, so nothing is dropped, and we alert you right away.`,
  },
  {
    q: 'How is this different from an answering service?',
    a: 'An answering service takes a message. NeverMissed finishes the job: it books the appointment, qualifies the lead, answers questions with your real details and texts you a summary. It’s also the same great call every time, on every line at once, for a flat monthly price.',
  },
  {
    q: 'Do I need to sign a long contract?',
    a: 'No contracts. Pay monthly and cancel anytime.',
  },
];
