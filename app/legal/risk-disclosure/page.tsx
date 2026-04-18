type RiskSection = {
  title: string;
  bullets?: string[];
  paragraphs?: string[];
};

const COMPANY_NAME = 'Orion Solana LLC dba ZeroG Trading';

const sections: RiskSection[] = [
  {
    title: 'Trading Is High-Risk (Options, Futures, and 0DTE)',
    paragraphs: ['Trading is highly speculative and involves a substantial risk of loss, including the possible loss of all funds in an account. Options trading — especially 0DTE options — can be extremely volatile and may result in rapid and significant losses. Futures trading also involves leverage and may result in losses that exceed initial margin. You are solely responsible for determining whether these strategies are appropriate for you.'],
    bullets: [
      'Options can expire worthless, resulting in 100% loss of premium paid.',
      '0DTE (zero days to expiration) contracts are extremely volatile with rapid time decay.',
      'Leverage amplifies both gains and losses beyond the initial investment.',
      'Margin calls may force liquidation at unfavorable prices.',
      'You may lose more than your initial investment in futures trading.',
    ],
  },
  {
    title: 'No Guarantee of Profit; Past Performance Not Indicative',
    paragraphs: [
      'There is no guarantee that you will achieve profits or avoid losses by using the Services. Any performance statements, examples, leaderboard placements, or "verified" results are provided for informational purposes only and do not guarantee that you will achieve similar results.',
      'Past performance is not indicative of future results. Backtests and hypothetical performance have inherent limitations and may diverge materially from live execution outcomes.',
    ],
  },
  {
    title: 'Automated Trading and System / Execution Risks',
    paragraphs: ['Automated trading can place trades quickly and at scale. You acknowledge risks including, without limitation:'],
    bullets: [
      'Slippage, partial fills, delayed fills, and poor liquidity.',
      'Market gaps, exchange halts, volatility spikes, and flash conditions.',
      'Errors caused by external systems outside ZeroG\'s control.',
      'Outages or degraded performance due to third-party brokerages, prop firms, clearing firms, exchanges, internet connectivity, and API providers.',
      'Configuration mistakes can trigger unintended orders.',
    ],
  },
  {
    title: '"Black Box" AI Acknowledgment (Cortex, Nebula, Helios, Meridian Engine)',
    paragraphs: ['You acknowledge and agree that the Services use complex models, including machine learning and multi-agent systems, that can be difficult or impossible to interpret in a simple, human-readable explanation. You understand that:'],
    bullets: [
      'Outputs may be generated based on complex data dependencies and changing market regimes.',
      'Model behavior may change over time due to updates, data, and market conditions.',
      'Results may vary materially from one user to another based on latency, broker execution, account constraints, prop firm rules, and configuration.',
    ],
  },
  {
    title: 'No FDIC / SIPC Coverage',
    paragraphs: [
      'ZeroG does not hold or custody your funds. Your brokerage account may have SIPC protection up to applicable limits, but SIPC does not cover trading losses. ZeroG is not a broker-dealer and your use of ZeroG Services is not covered by FDIC insurance.',
    ],
  },
  {
    title: 'System Downtime and Third-Party API Failures',
    bullets: [
      'ZeroG depends on third-party APIs including brokerages, data providers, and cloud services.',
      'Outages, API rate limits, or failures of these third parties are outside ZeroG\'s control.',
      'ZeroG is not liable for missed trades or losses due to third-party failures.',
      'Broker API disruptions may delay or reject orders.',
    ],
  },
  {
    title: 'Prop Firm Compliance Risk',
    paragraphs: ['If you use ZeroG Services with a prop firm account (e.g., TopstepX), you are solely responsible for ensuring your trading activity complies with the prop firm\'s rules, including drawdown limits, position limits, prohibited instruments, and daily loss limits. ZeroG is not responsible for account violations, resets, or terminations caused by algorithmic trading on prop firm accounts.'],
  },
  {
    title: 'Not Financial Advice',
    paragraphs: [
      `${COMPANY_NAME} (operating as "ZeroG") is a technology provider. The Services are provided for informational and/or automation purposes and do not constitute personalized investment advice, financial planning, legal advice, or tax advice. You are solely responsible for your trading and investment decisions.`,
    ],
  },
  {
    title: 'Acknowledgment',
    paragraphs: [
      `BY USING THE SERVICES PROVIDED BY ${COMPANY_NAME}, YOU ACKNOWLEDGE THAT YOU HAVE READ AND UNDERSTOOD THIS RISK DISCLOSURE, YOU UNDERSTAND THE RISKS INVOLVED IN ALGORITHMIC AND OPTIONS TRADING, YOU ARE TRADING WITH CAPITAL YOU CAN AFFORD TO LOSE, AND YOU ARE NOT RELYING ON ZEROG FOR INVESTMENT ADVICE.`,
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
            Final warning: {COMPANY_NAME} (Meridian) cannot eliminate market risk, execution risk, or operational risk. Trading involves substantial risk of loss.
          </div>
        </article>
      </div>
    </div>
  );
}
