type TermsSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  callout?: string;
};

const LAST_UPDATED = 'March 10, 2026';
const COMPANY_NAME = 'Orion Solana LLC dba ZeroG Trading';

const sections: TermsSection[] = [
  {
    title: 'Agreement',
    paragraphs: [`These Terms of Service ("Terms") constitute a legally binding agreement between you and ${COMPANY_NAME} (operating as "ZeroG"). By accessing or using the Services, you agree to be bound by these Terms. If you do not agree, do not use the Services.`],
  },
  {
    title: 'Nature of Services',
    paragraphs: ['Meridian is a technology platform that:'],
    bullets: [
      'Connects to supported third-party brokerage accounts via API.',
      'Transmits trade instructions to your broker.',
      'Provides analytics, alerts, and tracking tools.',
      'Does not provide investment, legal, tax, or financial advice.',
      'Does not custody or hold customer funds.',
    ],
  },
  {
    title: 'User Responsibility',
    paragraphs: ['You are solely responsible for:'],
    bullets: [
      'All investment decisions and outcomes.',
      'Determining whether the Services are appropriate for you.',
      'Compliance with all applicable laws and regulations.',
      'Maintaining the security of your account and API credentials.',
    ],
  },
  {
    title: 'Fees and Billing',
    paragraphs: [
      'Monthly Membership: $1,999/month. Flat rate, no performance fee.',
      'Lifetime Membership: One-time purchase price + 10% of net weekly profits (Monday through Friday). Performance fee charged Friday after market close only on profitable weeks.',
      'Singularity Membership: Auto-execute included at no additional charge.',
    ],
    callout: 'All sales are final. No refunds.',
  },
  {
    title: 'Arbitration Agreement',
    paragraphs: [
      'Any dispute arising from these Terms shall be resolved through binding arbitration administered by the American Arbitration Association (AAA).',
      'You may opt out of arbitration within 30 days by emailing support@meridian.com.',
    ],
    bullets: ['Waiver of class action participation.', 'Waiver of jury trial.', 'Waiver of court litigation (except small claims).'],
  },
  {
    title: 'Limitation of Liability',
    paragraphs: [
      `The maximum aggregate liability of ${COMPANY_NAME} to you for any claims arising from or related to these Terms or your use of the Services is limited to the lesser of $1,200 or the total fees you have paid to us.`,
      `${COMPANY_NAME} shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to lost profits, trading losses, data loss, platform outages, missed trading opportunities, or third-party broker failures.`,
    ],
  },
  {
    title: 'Disclaimers',
    paragraphs: [
      'Services are provided “AS IS” without warranties of any kind, including merchantability, fitness for a particular purpose, accuracy, reliability, uninterrupted availability, or error-free operation.',
    ],
  },
  {
    title: 'Governing Law',
    paragraphs: [
      'These Terms are governed by the laws of the State of California, United States, without regard to conflict of law principles.',
      'Any disputes not subject to arbitration shall be resolved exclusively in the state or federal courts located in Los Angeles County, California.',
    ],
  },
  {
    title: 'Contact',
    paragraphs: [`Questions about these terms can be sent to support@zerogtrading.com. ${COMPANY_NAME}, California, United States.`],
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen px-4 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto grid max-w-[1500px] gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <aside className="xl:sticky xl:top-24 xl:self-start">
          <div className="nebula-panel rounded-2xl p-6 sm:p-8">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{COMPANY_NAME}</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight nebula-gradient-text">Licensing Agreement</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Terms covering membership access, automation billing, risk allocation, and acceptable platform usage.
            </p>

            <div className="mt-6 rounded-xl border border-primary/25 bg-primary/10 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Last Updated</p>
              <p className="mt-1 font-medium text-foreground">{LAST_UPDATED}</p>
            </div>
          </div>
        </aside>

        <article className="nebula-panel rounded-2xl p-6 sm:p-10">
          <header className="border-b border-primary/20 pb-8">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Essential Terms of Service</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Meridian Terms</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Read these terms carefully before enabling brokerage connections, automation, or billing in Meridian.
            </p>
          </header>

          <div className="divide-y divide-primary/15">
            {sections.map((section, index) => (
              <section key={section.title} className="py-8">
                <h3 className="text-2xl font-semibold tracking-tight">
                  {index + 1}. {section.title}
                </h3>

                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph} className="mt-4 text-base leading-8 text-muted-foreground">
                    {paragraph}
                  </p>
                ))}

                {section.bullets && (
                  <ul className="mt-4 list-disc space-y-1.5 pl-6 text-base leading-8 text-muted-foreground marker:text-primary">
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                )}

                {section.callout && (
                  <div className="mt-5 rounded-lg border border-loss/35 bg-loss/10 p-4 text-sm font-semibold text-loss">
                    {section.callout}
                  </div>
                )}
              </section>
            ))}
          </div>
        </article>
      </div>
    </div>
  );
}
