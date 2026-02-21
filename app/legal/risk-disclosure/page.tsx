type RiskSection = {
  title: string;
  bullets?: string[];
  paragraphs?: string[];
};

const sections: RiskSection[] = [
  {
    title: 'Options Trading Risks',
    bullets: [
      'Total loss potential: options can expire worthless, resulting in 100% loss of premium paid.',
      'Complexity: options strategies include strike, expiration, and volatility dynamics.',
      'Time decay: options may lose value even when underlying price is stable.',
      'Volatility risk: implied volatility shifts can produce sharp repricing.',
      'Assignment risk: short options can be assigned before expiration.',
      '0DTE risk: same-day expiration contracts are extremely volatile.',
    ],
  },
  {
    title: 'Automated Trading Risks',
    bullets: [
      'Technical failures (software bugs, outages, connectivity failures).',
      'Lack of discretionary human oversight at execution time.',
      'Configuration mistakes can trigger unintended orders.',
      'Algorithms may fail under unprecedented market regimes.',
    ],
  },
  {
    title: 'Past Performance Disclaimer',
    paragraphs: [
      'Past performance is not indicative of future results.',
      'Backtests and hypothetical performance have inherent limitations and may diverge from live execution outcomes.',
    ],
  },
  {
    title: 'No FDIC Insurance',
    paragraphs: [
      'Trading accounts are not protected by FDIC insurance. SIPC protections at your broker do not cover trading losses.',
    ],
  },
  {
    title: 'Market Volatility and Liquidity',
    bullets: [
      'Flash crashes and rapid repricing can exceed expected risk limits.',
      'Gap risk can bypass stop levels.',
      'Low-liquidity contracts can widen spreads and increase slippage.',
    ],
  },
  {
    title: 'Leverage and Margin Risks',
    bullets: [
      'Leverage amplifies both gains and losses.',
      'Margin calls may force liquidation at unfavorable prices.',
      'You may lose more than your initial investment.',
    ],
  },
  {
    title: 'System Downtime and Third-Party APIs',
    bullets: [
      'Platform or cloud outages can occur during market hours.',
      'Broker API disruptions may delay or reject orders.',
      'Third-party policy changes may affect service continuity.',
    ],
  },
  {
    title: 'No Investment Advice',
    paragraphs: [
      'Meridian is a technology platform, not an investment adviser. We do not recommend specific trades, evaluate suitability, or guarantee outcomes.',
    ],
  },
];

export default function RiskDisclosurePage() {
  return (
    <div className="min-h-screen px-4 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="nebula-panel rounded-2xl p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Risk Disclosure</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight nebula-gradient-text sm:text-4xl">Substantial Risk of Loss</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Trading options and automated strategies can result in significant losses, including total loss of capital.
          </p>

          <div className="mt-5 rounded-lg border border-loss/35 bg-loss/10 p-4 text-sm text-loss">
            Only trade with capital you can afford to lose. Consult a licensed financial professional if needed.
          </div>
        </header>

        <article className="nebula-panel rounded-2xl p-6 sm:p-8">
          <div className="divide-y divide-primary/15">
            {sections.map((section, index) => (
              <section key={section.title} className="py-6 first:pt-0 last:pb-0">
                <h2 className="text-2xl font-semibold tracking-tight">
                  {index + 1}. {section.title}
                </h2>

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
              </section>
            ))}
          </div>

          <div className="mt-8 rounded-lg border border-loss/35 bg-loss/10 p-4 text-sm font-semibold text-loss">
            Final warning: Meridian cannot eliminate market risk, execution risk, or operational risk.
          </div>
        </article>
      </div>
    </div>
  );
}
