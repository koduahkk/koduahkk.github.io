/* =============================================================================
   SITE CONTENT: the only file Sandra needs to edit.
   -----------------------------------------------------------------------------
   Everything on the home page and every case-study page is rendered from this
   object. Change text here and the layout updates itself.

   PLACEHOLDERS: any text inside [square brackets] is a placeholder. While
   `meta.highlightPlaceholders` is true they show on the page with a dashed
   outline, so none get missed. Set it to false once they're all replaced.

   EMPTY VALUES: leave a URL as "" and its button or link is hidden or shown
   as a placeholder. Set a stat's `value` to null and it shows "[X]".
   ========================================================================== */

window.SITE = {
  meta: {
    siteUrl: "https://koduahkk.github.io/sandra/", // canonical URL, trailing slash
    ogImage: "assets/img/og-image.png",            // 1200×630 social card
    highlightPlaceholders: true,
    year: new Date().getFullYear()
  },

  person: {
    name: "Sandra Abrafi",
    firstName: "Sandra",
    initials: "SA",
    title: "Data Analyst",
    titleDetail: "[BI & Analytics]",               // shown after the title, e.g. "BI & Analytics"
    location: "[City, Country]",
    openTo: "[Remote / Hybrid / Relocation]",
    yearsExperience: "[X]",
    availability: "Currently open to [full-time roles / freelance projects]",
    headshot: "",                                  // e.g. "assets/img/sandra.jpg" (square, ≥ 800px)
    headshotAlt: "Portrait of Sandra Abrafi",
    resumeUrl: "",                                 // e.g. "assets/Sandra-Abrafi-Resume.pdf"
    email: "",                                     // e.g. "sandra@example.com"
    links: {
      linkedin: "",                                // full URLs
      github: "",
      tableau: ""                                  // Tableau Public or other portfolio
    }
  },

  hero: {
    // `highlight` must appear in `headline`; it gets the accent underline.
    headline: "I turn raw data into decisions people act on.",
    highlight: "decisions",
    sub: "Data Analyst specializing in [SQL, Power BI & Python], helping [teams / industries] cut through noise and track what matters."
  },

  // Impact strip. Use a number for `value` (it counts up on scroll) or null for a placeholder.
  stats: [
    { value: null, suffix: "+",  label: "dashboards shipped" },
    { value: null, suffix: "M+", label: "rows analyzed" },
    { value: null, suffix: "%",  label: "reporting time saved" },
    { value: null, suffix: "",   label: "stakeholders served" }
  ],

  about: {
    // 120–180 words, first person. Bracketed parts are Sandra's to fill in.
    paragraphs: [
      "I came to data through [how you got into data: a role, a course, a question you couldn't stop asking]. Over [X] years I've worked with [industries, e.g. fintech, healthcare, retail], and I've learned that the most useful analysis usually starts with a very plain question.",
      "What I love is finding the why behind a number: why a metric moved, why a segment behaves differently, why a report nobody reads still exists. I'm curious by default, I work in the open with the people who own the decision, and I would rather ship one clear chart than ten clever ones.",
      "Outside of work you'll find me [a hobby or personal detail, e.g. what you read, play, cook or build]."
    ],
    process: [
      { step: "Ask",         icon: "ask",         text: "Pin down the decision the data has to inform, and what “better” looks like." },
      { step: "Clean",       icon: "clean",       text: "Audit, join and fix the data. Write down every assumption so the numbers can be trusted." },
      { step: "Analyze",     icon: "analyze",     text: "Size the effect, test the hypothesis, separate the signal from the noise." },
      { step: "Communicate", icon: "communicate", text: "One headline, one chart, one recommendation. Then the dashboard that keeps it current." }
    ]
  },

  // Proficiency: 1 = Working · 2 = Proficient · 3 = Expert. Leave `level` out to hide the dots.
  // ⚠ PLACEHOLDER: tools and levels below are seeded from the brief's examples. Confirm or edit.
  skills: [
    { group: "Data Querying & Wrangling", tools: [
      { name: "SQL", level: 3 }, { name: "BigQuery", level: 2 }, { name: "dbt", level: 1 },
      { name: "Python · pandas", level: 2 }, { name: "Power Query", level: 2 } ] },
    { group: "Analysis & Statistics", tools: [
      { name: "A/B test analysis", level: 2 }, { name: "Regression", level: 2 },
      { name: "Forecasting", level: 2 }, { name: "Cohort & funnel analysis", level: 3 } ] },
    { group: "Visualization & BI", tools: [
      { name: "Power BI · DAX", level: 3 }, { name: "Tableau", level: 2 }, { name: "Looker Studio", level: 2 },
      { name: "matplotlib · seaborn", level: 2 } ] },
    { group: "Automation & Tools", tools: [
      { name: "Excel", level: 3 }, { name: "Google Sheets", level: 3 }, { name: "Git", level: 1 },
      { name: "Scheduled refresh & pipelines", level: 2 } ] },
    { group: "Business & Communication", tools: [
      { name: "KPI frameworks", level: 3 }, { name: "Dashboard design", level: 3 },
      { name: "Stakeholder storytelling", level: 3 }, { name: "Requirements gathering", level: 2 } ] }
  ],

  // Most recent first. Start each bullet with an action verb and a number.
  experience: [
    {
      role: "[Job Title]", org: "[Company]", start: "[Mon YYYY]", end: "Present", place: "[City / Remote]",
      bullets: [
        "[Built] [X] [Power BI] dashboards used by [team], cutting weekly reporting time by [X]%.",
        "[Designed] a KPI framework for [area] that [outcome, e.g. replaced 6 conflicting reports].",
        "[Analyzed] [X]M rows of [data] to find [insight], informing [decision]."
      ]
    },
    {
      role: "[Previous Job Title]", org: "[Company]", start: "[Mon YYYY]", end: "[Mon YYYY]", place: "[City]",
      bullets: [
        "[Automated] [report name] in [Excel / Python], saving [X] hours a week.",
        "[Cleaned and merged] [X] data sources into a single source of truth for [team]."
      ]
    }
  ],

  education: [
    { degree: "[Degree, e.g. BSc Economics]", school: "[Institution]", year: "[Year]" }
  ],

  // `url` is the public verification link. Leave "" to hide the "Verify" link.
  certifications: [
    { name: "[Certification, e.g. Google Data Analytics]", issuer: "[Issuer]", year: "[Year]", url: "" },
    { name: "[Certification, e.g. Microsoft PL-300]",      issuer: "[Issuer]", year: "[Year]", url: "" }
  ],

  // Real quotes only, with permission. While this list is empty the section is not shown.
  // Example: { quote: "…", name: "Ama Mensah", role: "Head of Sales, Acme" }
  testimonials: [],

  contact: {
    headline: "Have data that needs a story?",
    highlight: "Let’s talk.",
    blurb: "Tell me about the question you’re trying to answer. I usually reply within [two working days].",
    // Optional form backend (Formspree, FormSubmit, Getform…). The form POSTs JSON here.
    // Leave "" and the form opens the visitor's email app with the message pre-filled.
    formEndpoint: ""
  },

  // Filter chips on the Work section, in order. "All" is added automatically.
  filters: ["Dashboards", "SQL", "Python", "Excel", "Forecasting"],

  /* ---------------------------------------------------------------------------
     PROJECTS: each one becomes a card and a case-study page (case-study.html?p=slug).
     ⚠ These five are seeded examples. Their figures are illustrative and every
     chart is captioned that way until you set `illustrative: false`.

     Chart types:
       { type: "bar",  unit: "%", items: [{ label, value }], highlight: "label", note }
       { type: "line", unit: "", x: [...], series: [{ name, values, dashedFrom? }],
                       highlight: "series name", note }
     ------------------------------------------------------------------------ */
  projects: [
    {
      slug: "sales-performance-dashboard",
      title: "Sales Performance Dashboard",
      categories: ["Dashboards", "Forecasting"],
      tools: ["Power BI", "DAX", "SQL"],
      outcome: "Gave [X] regional leads one trusted view of revenue vs. target, cutting weekly reporting time by [X]%.",
      summary: "Regional revenue and KPI tracking with a rolling three-month forecast.",
      thumbnail: "",          // e.g. "assets/img/projects/sales-1.png". Empty uses a generated preview.
      thumbnailAlt: "Sales Performance Dashboard in Power BI",
      meta: { role: "[Sole analyst]", timeline: "[X weeks]", stakeholders: "[Sales leadership]" },
      problem: {
        context: "[Company] sold across [X] regions, and every Monday each regional lead built their own revenue spreadsheet. The numbers rarely matched, so leadership meetings started with arguing about the data instead of acting on it.",
        question: "Which regions are behind target, by how much, and where is the quarter heading?"
      },
      data: {
        source: "[CRM export + ERP invoices + targets sheet]",
        size: "[X]M order lines · [X] years · [X] tables",
        messiness: [
          "Region names spelled [X] different ways across systems",
          "Refunds recorded as new orders with negative values",
          "Targets kept in a manually edited spreadsheet"
        ],
        ethics: "Customer-level fields were excluded at source; the dashboard only shows aggregates. Row-level security limits each lead to their own region."
      },
      approach: {
        steps: [
          "Built a star schema: one fact table of order lines, conformed dimensions for date, region and product.",
          "Mapped region aliases to a single reference table and netted refunds against their original orders.",
          "Wrote DAX measures for revenue, % of target and year-over-year, then validated them against finance’s month-end close.",
          "Added a three-month forecast (exponential smoothing) so leads could see the trajectory, not just the gap."
        ],
        code: {
          lang: "sql",
          label: "Monthly revenue vs. target by region",
          source: "-- Net revenue per region per month, joined to targets\nWITH net_orders AS (\n  SELECT\n    r.region_name,\n    DATE_TRUNC('month', o.order_date) AS month,\n    SUM(o.amount) AS revenue        -- refunds are negative rows\n  FROM orders o\n  JOIN region_map r ON r.alias = o.region_raw\n  GROUP BY 1, 2\n)\nSELECT\n  n.region_name,\n  n.month,\n  n.revenue,\n  t.target,\n  ROUND(100.0 * n.revenue / NULLIF(t.target, 0), 1) AS pct_of_target\nFROM net_orders n\nLEFT JOIN targets t\n  ON t.region_name = n.region_name AND t.month = n.month\nORDER BY n.month, pct_of_target;"
        }
      },
      insights: [
        {
          title: "One region explains most of the gap",
          body: "Four of five regions were within a few points of target. [Region D] was [X] points behind, and the shortfall traced back to two lapsed key accounts.",
          chart: {
            type: "bar", unit: "%", label: "Revenue as % of target, year to date",
            items: [
              { label: "Region A", value: 104 }, { label: "Region B", value: 98 },
              { label: "Region C", value: 96 }, { label: "Region D", value: 71 }, { label: "Region E", value: 101 }
            ],
            highlight: "Region D", note: "Furthest behind target", reference: 100, referenceLabel: "target"
          }
        },
        {
          title: "The quarter was heading for a soft landing",
          body: "The forecast showed recovery once the key accounts were back, which shifted the conversation from blame to a renewal plan.",
          chart: {
            type: "line", unit: "k", label: "Monthly revenue (k), actual and forecast",
            x: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
            series: [
              { name: "Revenue", values: [410, 425, 418, 440, 452, 431, 398, 405, 428, 446, 461, 474], dashedFrom: 9 }
            ],
            highlight: "Revenue", note: "Dashed line = forecast"
          }
        }
      ],
      impact: {
        metric: "[X]%", metricLabel: "less time spent on weekly reporting",
        body: "The dashboard replaced [X] regional spreadsheets. Leadership now opens the Monday meeting on it.",
        next: "Sales leadership launched a renewal plan for [Region D]’s lapsed accounts, tracked on the same dashboard."
      },
      links: { dashboard: "", github: "", notebook: "" }
    },

    {
      slug: "customer-churn-analysis",
      title: "Customer Churn Analysis",
      categories: ["SQL", "Python"],
      tools: ["SQL", "Python", "pandas", "seaborn"],
      outcome: "Found that [X]% of churn happens in the first 90 days, pointing retention spend at onboarding.",
      summary: "What drives churn, and which retention levers are worth pulling.",
      thumbnail: "",
      thumbnailAlt: "Customer churn analysis charts",
      meta: { role: "[Analyst]", timeline: "[X weeks]", stakeholders: "[Customer Success, Product]" },
      problem: {
        context: "[Company]’s subscription churn had crept up for [X] quarters. The retention team was offering discounts to everyone at renewal, which was expensive and didn’t seem to help.",
        question: "Who churns, when, and what could we change earlier to keep them?"
      },
      data: {
        source: "[Billing database + product event logs + support tickets]",
        size: "[X]k customers · [X]M events · [X] months",
        messiness: [
          "Customers who paused were counted as churned",
          "Event timestamps in three different time zones",
          "Support tickets linked by email, not customer ID"
        ],
        ethics: "Worked on pseudonymised IDs only. No individual-level results left the analysis environment."
      },
      approach: {
        steps: [
          "Defined churn with Customer Success (no active plan 30 days after period end) and rebuilt the history on that definition.",
          "Built tenure cohorts in SQL and joined first-month product usage.",
          "Compared churn by tenure, plan and onboarding completion; fitted a logistic regression to check the drivers held up together.",
          "Translated the coefficients into “if we moved X, we’d keep roughly Y customers a quarter”."
        ],
        code: {
          lang: "python",
          label: "Churn rate by tenure band",
          source: "import pandas as pd\n\n# One row per customer, churned = 1 if no active plan 30 days after period end\ncustomers = pd.read_parquet(\"customers.parquet\")\n\nbands = [0, 3, 6, 12, 24, 120]\nlabels = [\"0-3 mo\", \"3-6 mo\", \"6-12 mo\", \"12-24 mo\", \"24+ mo\"]\ncustomers[\"tenure_band\"] = pd.cut(customers[\"tenure_months\"], bands, labels=labels)\n\nchurn_by_band = (\n    customers.groupby(\"tenure_band\", observed=True)[\"churned\"]\n    .agg(rate=\"mean\", n=\"size\")\n    .assign(rate=lambda d: (d[\"rate\"] * 100).round(1))\n)\nprint(churn_by_band)"
        }
      },
      insights: [
        {
          title: "Churn is front-loaded",
          body: "New customers churned at several times the rate of customers past their first year. Renewal discounts were arriving far too late to matter.",
          chart: {
            type: "bar", unit: "%", label: "Churn rate by tenure band",
            items: [
              { label: "0–3 mo", value: 18.4 }, { label: "3–6 mo", value: 9.1 },
              { label: "6–12 mo", value: 6.2 }, { label: "12–24 mo", value: 4.0 }, { label: "24+ mo", value: 2.7 }
            ],
            highlight: "0–3 mo", note: "Highest churn"
          }
        },
        {
          title: "Finishing onboarding halves early churn",
          body: "Customers who completed onboarding in week one churned at about half the rate of those who didn’t, even after controlling for plan and company size.",
          chart: {
            type: "bar", unit: "%", label: "First-90-day churn by onboarding status",
            items: [ { label: "Completed onboarding", value: 9.6 }, { label: "Did not complete", value: 21.3 } ],
            highlight: "Did not complete", note: "Retention lever"
          }
        }
      ],
      impact: {
        metric: "[X]%", metricLabel: "of churn in the first 90 days",
        body: "Retention spend moved from blanket renewal discounts to an onboarding programme for new accounts.",
        next: "Customer Success introduced a week-one onboarding call. [Add the measured result once available.]"
      },
      links: { dashboard: "", github: "", notebook: "" }
    },

    {
      slug: "hr-attrition-insights",
      title: "HR Attrition Insights",
      categories: ["Dashboards", "SQL"],
      tools: ["Tableau", "SQL", "Excel"],
      outcome: "Flagged [X] high-risk segments, helping HR focus retention on the [X]% of roles driving most exits.",
      summary: "Workforce trends and attrition risk segments for HR leadership.",
      thumbnail: "",
      thumbnailAlt: "HR attrition dashboard in Tableau",
      meta: { role: "[Analyst]", timeline: "[X weeks]", stakeholders: "[HR Business Partners]" },
      problem: {
        context: "HR at [Company] knew attrition was high but only had a single company-wide number, which made it impossible to know where to act.",
        question: "Where is attrition concentrated, and which factors put people at risk?"
      },
      data: {
        source: "[HRIS extract + exit survey + overtime logs]",
        size: "[X]k employee records · [X] years",
        messiness: [
          "Department names changed after a re-org mid-year",
          "Exit survey free text with no consistent coding",
          "Overtime logged in hours in one system and days in another"
        ],
        ethics: "Segments under [10] people were suppressed so no individual can be identified. Sensitive attributes were used only to check for bias, never as risk factors."
      },
      approach: {
        steps: [
          "Mapped old department codes to the new structure so trends survived the re-org.",
          "Calculated annualised attrition by department, tenure, role level and overtime.",
          "Coded exit survey reasons into [X] themes with HR.",
          "Designed a Tableau dashboard with a segment explorer and suppression rules built in."
        ],
        code: {
          lang: "sql",
          label: "Annualised attrition by department",
          source: "SELECT\n  d.department_current AS department,\n  COUNT(*) FILTER (WHERE e.exit_date BETWEEN :start AND :end) AS leavers,\n  AVG(h.headcount) AS avg_headcount,\n  ROUND(100.0 * COUNT(*) FILTER (WHERE e.exit_date BETWEEN :start AND :end)\n        / NULLIF(AVG(h.headcount), 0), 1) AS attrition_pct\nFROM employees e\nJOIN dept_map d ON d.department_code = e.department_code\nJOIN monthly_headcount h ON h.department = d.department_current\nGROUP BY 1\nHAVING AVG(h.headcount) >= 10      -- suppress small groups\nORDER BY attrition_pct DESC;"
        }
      },
      insights: [
        {
          title: "Attrition is concentrated, not company-wide",
          body: "[Department] lost people at more than twice the company rate; most other teams were near or below the benchmark.",
          chart: {
            type: "bar", unit: "%", label: "Annualised attrition by department",
            items: [
              { label: "Customer Support", value: 31 }, { label: "Sales", value: 19 },
              { label: "Operations", value: 14 }, { label: "Engineering", value: 11 }, { label: "Finance", value: 8 }
            ],
            highlight: "Customer Support", note: "Above 2× company rate", reference: 15, referenceLabel: "company rate"
          }
        },
        {
          title: "Overtime is the strongest early signal",
          body: "Employees with regular overtime left at roughly three times the rate of those without it.",
          chart: {
            type: "bar", unit: "%", label: "Attrition by regular overtime",
            items: [ { label: "Regular overtime", value: 29 }, { label: "No regular overtime", value: 10 } ],
            highlight: "Regular overtime", note: "Highest risk"
          }
        }
      ],
      impact: {
        metric: "[X]", metricLabel: "high-risk segments identified",
        body: "HR moved from one company-wide target to segment-level retention plans.",
        next: "[Department] piloted a rota change to reduce overtime. [Add the result.]"
      },
      links: { dashboard: "", github: "", notebook: "" }
    },

    {
      slug: "marketing-ab-test",
      title: "Marketing Campaign A/B Test",
      categories: ["Python"],
      tools: ["Python", "statsmodels", "SQL"],
      outcome: "Showed the new landing page lifted conversion by [X]% (p < [0.05]), justifying a full rollout.",
      summary: "Lift, significance and a clear go / no-go recommendation.",
      thumbnail: "",
      thumbnailAlt: "A/B test results chart",
      meta: { role: "[Analyst]", timeline: "[X weeks]", stakeholders: "[Marketing]" },
      problem: {
        context: "Marketing redesigned the campaign landing page and wanted to know if it actually converted better before paying to roll it out everywhere.",
        question: "Does the new page convert better, and are we confident enough to ship it?"
      },
      data: {
        source: "[Web analytics events + CRM sign-ups]",
        size: "[X]k sessions · [X] days · 2 variants",
        messiness: [
          "Bot traffic inflating sessions on one variant",
          "Users who saw both variants after clearing cookies",
          "Sign-ups attributed to the last touch rather than the test page"
        ],
        ethics: "Analysed at session level with no personal data. Sample size and stopping rule were agreed before the test started."
      },
      approach: {
        steps: [
          "Ran a power calculation up front to fix the sample size and test length, so we wouldn’t stop early on a lucky day.",
          "Filtered known bots and removed users exposed to both variants.",
          "Compared conversion with a two-proportion z-test and reported the lift with a 95% confidence interval.",
          "Checked the result held across device and traffic source before recommending a rollout."
        ],
        code: {
          lang: "python",
          label: "Lift and significance",
          source: "from statsmodels.stats.proportion import proportions_ztest, confint_proportions_2indep\n\nconversions = [control_conv, variant_conv]   # e.g. [612, 709]\nsessions    = [control_n,    variant_n]      # e.g. [15_100, 15_050]\n\nz, p_value = proportions_ztest(conversions, sessions)\nlow, high = confint_proportions_2indep(\n    variant_conv, variant_n, control_conv, control_n, compare=\"diff\"\n)\n\nlift = (variant_conv / variant_n) / (control_conv / control_n) - 1\nprint(f\"Lift: {lift:.1%}  p = {p_value:.4f}  95% CI: [{low:.2%}, {high:.2%}]\")"
        }
      },
      insights: [
        {
          title: "The variant pulled ahead and stayed ahead",
          body: "Cumulative conversion separated after the first week and never crossed back. That is what a real effect looks like, rather than early noise.",
          chart: {
            type: "line", unit: "%", label: "Cumulative conversion rate by day",
            x: ["D1","D2","D3","D4","D5","D6","D7","D8","D9","D10","D11","D12","D13","D14"],
            series: [
              { name: "Control", values: [3.9, 4.2, 4.0, 4.1, 4.0, 4.1, 4.0, 4.1, 4.0, 4.1, 4.0, 4.0, 4.1, 4.1] },
              { name: "New page", values: [4.1, 4.0, 4.4, 4.5, 4.6, 4.6, 4.7, 4.7, 4.7, 4.8, 4.7, 4.7, 4.7, 4.7] }
            ],
            highlight: "New page", note: "Stable gap from day 7"
          }
        }
      ],
      impact: {
        metric: "+[X]%", metricLabel: "conversion lift (95% CI [X]–[X]%)",
        body: "The recommendation was a go: ship the new page, and monitor conversion for a month in case the effect fades.",
        next: "Marketing rolled the page out to [all campaigns]. [Add post-launch result.]"
      },
      links: { dashboard: "", github: "", notebook: "" }
    },

    {
      slug: "automated-excel-reporting",
      title: "Automated Excel Reporting Pipeline",
      categories: ["Excel"],
      tools: ["Excel", "Power Query", "Power Pivot"],
      outcome: "Turned a [X]-hour weekly copy-paste report into a one-click refresh, saving [X] hours a week.",
      summary: "From manual copy-paste to a refreshable, error-checked report.",
      thumbnail: "",
      thumbnailAlt: "Automated Excel report",
      meta: { role: "[Analyst]", timeline: "[X weeks]", stakeholders: "[Finance / Operations]" },
      problem: {
        context: "Every week someone spent most of a day copying exports from [X] systems into one workbook, and small paste errors regularly reached the leadership pack.",
        question: "Can we produce the same report automatically, with fewer errors, and free that day up?"
      },
      data: {
        source: "[X] weekly CSV exports from [systems]",
        size: "[X]k rows a week · [X] files",
        messiness: [
          "Column orders that changed between exports",
          "Dates stored as text in two formats",
          "Totals rows mixed into the data"
        ],
        ethics: "No personal data. The workbook keeps a refresh log so every number can be traced back to its source file."
      },
      approach: {
        steps: [
          "Mapped every manual step in the old process with the person who ran it.",
          "Rebuilt each import in Power Query, matching columns by name and stripping totals rows.",
          "Modelled the tables in Power Pivot and rebuilt the report on measures, not hard-coded cells.",
          "Added reconciliation checks that flag when totals don’t match the source exports."
        ],
        code: {
          lang: "m",
          label: "Power Query: clean a weekly export",
          source: "let\n    Source   = Csv.Document(File.Contents(FilePath), [Delimiter = \",\", Encoding = 65001]),\n    Promoted = Table.PromoteHeaders(Source, [PromoteAllScalars = true]),\n    // Drop totals rows that some exports append\n    NoTotals = Table.SelectRows(Promoted, each not Text.StartsWith([Region], \"Total\")),\n    Typed    = Table.TransformColumnTypes(NoTotals, {{\"Date\", type date}, {\"Amount\", type number}}, \"en-GB\")\nin\n    Typed"
        }
      },
      insights: [
        {
          title: "Most of the time went on copy-paste",
          body: "Breaking down the old process showed that collating exports, not analysing them, took most of the day.",
          chart: {
            type: "bar", unit: " h", label: "Hours per week on the report, before vs. after",
            items: [ { label: "Before (manual)", value: 7.5 }, { label: "After (automated)", value: 0.5 } ],
            highlight: "After (automated)", note: "One-click refresh"
          }
        }
      ],
      impact: {
        metric: "[X] h", metricLabel: "saved every week",
        body: "The report now refreshes in [X] minutes, and reconciliation checks catch errors before the pack goes out.",
        next: "The team reused the same pattern for [X] other recurring reports."
      },
      links: { dashboard: "", github: "", notebook: "" }
    }
  ]
};
