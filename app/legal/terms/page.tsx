type TermsSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  callout?: string;
};

const LAST_UPDATED = 'April 17, 2026';
const COMPANY_NAME = 'Orion Solana LLC dba ZeroG Trading';

const sections: TermsSection[] = [
  {
    title: 'Agreement to Terms',
    paragraphs: [`This Unified Master Services Agreement ("Agreement") is entered into by and between ${COMPANY_NAME} ("ZeroG," "Company," "we," "us," or "our") and you ("User," "you," or "your"). By accessing the ZeroG platform, purchasing or using any subscription or lifetime plan, integrating any brokerage or prop firm account, connecting via API, receiving or using any signals, or otherwise using the Services, you agree to be bound by this Agreement. If you do not agree, do not access or use the Services.`],
  },
  {
    title: 'Services Description',
    paragraphs: ['ZeroG provides proprietary automated trading infrastructure and related tools. The Services include, without limitation:'],
    bullets: [
      'Nebula: A fully automated Nasdaq (NQ) futures algorithm optimized for prop firm funded accounts (e.g., TopstepX).',
      'Helios: Real-time options signals for SPX, QQQ, and IWM, encompassing day trades and swing setups.',
      'Meridian Engine: A fully automated 0DTE QQQ scalping engine integrated via Tradier for high-velocity execution.',
      'Cortex Capital: An AI-driven portfolio management system utilizing eleven (11) autonomous agents analyzing macro data, sector momentum, and earnings catalysts.',
      'The Services may involve automated trade execution through third-party brokerages and/or API aggregators, signal delivery and trade alerts, and dashboard and account tools.',
      'ZeroG does NOT provide investment advice, financial planning, or brokerage services, and does NOT custody or hold customer funds at any time.',
    ],
  },
  {
    title: 'Eligibility',
    paragraphs: ['You represent and warrant that: (a) you are at least 18 years old and have legal capacity to enter into this Agreement; (b) you are not prohibited from using the Services under applicable law; and (c) you will use the Services only in compliance with this Agreement, all applicable laws, and the terms of any brokerage, exchange, data provider, or prop firm you use.'],
  },
  {
    title: 'Billing & Refund Policy',
    paragraphs: ['Access to ZeroG Services is subject to the plan you purchase:'],
    bullets: [
      'Monthly Membership: $1,999/month (flat rate). No performance fee unless otherwise stated at checkout or in a written order form.',
      'Lifetime Membership: One-time purchase price + 10% of net weekly profits (Monday–Friday). Performance fee charged Friday after market close only on profitable weeks.',
      'Singularity Membership: Auto-execute included at no additional charge.',
      'By purchasing, you authorize ZeroG and its payment processors to charge your payment method for all applicable fees, taxes, and charges.',
    ],
    callout: 'ALL SALES ARE FINAL. NO REFUNDS. Due to the proprietary nature of the Services, including immediate access to protected intellectual property, signals, and automation logic, ZeroG does not offer refunds, chargebacks, or credits under any circumstances, including dissatisfaction, performance, account resets, prop firm rule violations, broker/API outages, or inability to use the Services.',
  },
  {
    title: 'Arbitration; Class Action Waiver; Venue',
    paragraphs: [
      'Any dispute, claim, or controversy arising out of or relating to this Agreement or the Services shall be resolved exclusively by binding arbitration administered by the American Arbitration Association (AAA) under its applicable rules. The arbitration shall take place in Los Angeles County, California.',
    ],
    bullets: [
      'Class Action Waiver: You agree to bring claims only in your individual capacity and not as a plaintiff or class member in any purported class, collective, consolidated, or representative proceeding.',
      'Jury Trial Waiver: You expressly waive your right to a jury trial.',
      'Court Litigation Waiver: You expressly waive your right to litigate in court (except small claims court).',
      'Governing Law: This Agreement is governed by the laws of the State of California, without regard to conflict-of-laws principles.',
    ],
  },
  {
    title: 'Limitation of Liability & Indemnification',
    paragraphs: [
      `To the maximum extent permitted by law, ZeroG's total cumulative liability for any and all claims arising out of or relating to this Agreement or the Services will not exceed the lesser of (i) $1,200 or (ii) the total fees paid by you in the twelve (12) months preceding the event giving rise to the claim.`,
      `ZeroG will not be liable for any indirect, incidental, consequential, special, exemplary, or punitive damages, or any loss of profits, revenues, data, goodwill, or business opportunities arising out of or related to the Services.`,
      'User agrees to indemnify and hold Orion Solana LLC harmless from any claims, losses, or damages arising from User\'s breach of this Agreement, violation of prop firm rules, or trading losses incurred through the platform.',
    ],
  },
  {
    title: 'Proprietary Rights & No Reverse Engineering',
    paragraphs: ['All technology, including source code, trade secrets, signal logic, weighting parameters, AI agent architectures, AI model weights, and the "Nebula," "Helios," "Meridian Engine," and "Cortex Capital" marks, are the exclusive property of Orion Solana LLC. You expressly agree that you will NOT:'],
    bullets: [
      'Decompile, disassemble, or reverse engineer any software, model, infrastructure, or services provided by ZeroG.',
      'Attempt to derive the source code, underlying ideas, algorithms, model weights, prompts, system instructions, agent logic, or trading logic of the Services.',
      'Use automated tools, bots, scripts, scraping, logging, or systematic observation to probe, fingerprint, benchmark, or otherwise analyze the API or software to reconstruct trading logic.',
      'Surrogate Model Ban: Extract, aggregate, record, republish, or otherwise use outputs (including signals, alerts, execution timing, order parameters, or position data) to train, fine-tune, evaluate, build, or inform any competing AI system, strategy, algorithm, or surrogate model.',
      'Utilize ZeroG outputs to develop a derivative product or competing service. This restriction survives termination for five (5) years.',
    ],
    callout: 'Violation constitutes Trade Secret Theft and entitles ZeroG to immediate injunctive relief and all available legal remedies.',
  },
  {
    title: 'Non-Disclosure & Confidentiality (NDA)',
    paragraphs: ['"Confidential Information" means any non-public information related to ZeroG or the Services, including: signals and trade outputs; entry/exit logic and strategy parameters; model/agent logic, weights, prompts, and architecture; platform infrastructure; product roadmaps and business methods; and AES-256 encrypted credentials and integration details.'],
    bullets: [
      'You will keep all Confidential Information strictly confidential.',
      'You will use it only as necessary to access and use the Services.',
      'You will not disclose it to any third party without ZeroG\'s prior written consent.',
      'Confidentiality obligations survive termination. Trade secret obligations continue in perpetuity.',
      'Breach of this NDA entitles ZeroG to seek injunctive relief without requirement to post bond.',
    ],
  },
  {
    title: 'No Resale / Redistribution',
    paragraphs: ['Your license to access ZeroG is strictly personal, non-transferable, and non-sublicensable. You must not:'],
    bullets: [
      'Share, sell, sublicense, rent, lease, transfer, or distribute access to the Services.',
      'Share credentials, API keys, or account access (including via seat sharing).',
      'Operate mirror sites, copy endpoints, rebroadcasting tools, or any relay designed to redistribute signals.',
      'Forward or republish signals or outputs to any third-party community or channel, including Discord, Telegram, Slack, or similar platforms.',
      'Manage funds on behalf of other people or operate a copy-trading service using ZeroG signals without explicit written consent.',
    ],
    callout: 'Violation is a material breach and may constitute misappropriation of trade secrets. ZeroG reserves the right to seek disgorgement of profits derived from unauthorized use.',
  },
  {
    title: 'Security & API Integration',
    paragraphs: ['ZeroG utilizes industry-standard AES-256 encryption for user credentials. Our infrastructure is designed so that even Company developers cannot access your encrypted brokerage keys.'],
    bullets: [
      'You are solely responsible for maintaining the security of your ZeroG dashboard and brokerage API keys.',
      'Sharing credentials or bypassing security measures is considered theft of trade secrets.',
      'While our infrastructure supports concurrent scaling (e.g., up to 5 TopstepX accounts), you are responsible for ensuring compliance with the specific terms of any third-party prop firm or brokerage.',
    ],
  },
  {
    title: 'Privacy & Data',
    paragraphs: ['ZeroG may collect and process account, usage, and transactional information to provide the Services. Third-party providers may include SnapTrade (brokerage connectivity), Stripe (payments), brokerages, prop firms, and other infrastructure providers you connect.'],
    bullets: [
      'You agree that ZeroG may use aggregated and/or anonymized data derived from your usage to maintain, improve, and develop the Services.',
      'ZeroG will not sell your brokerage credentials and does not require developers to access unencrypted credentials.',
      'Upon termination, ZeroG will archive or delete personal identifying data within five (5) years, as required for compliance, tax/audit needs, fraud prevention, and dispute resolution.',
      'You grant ZeroG a perpetual, irrevocable, worldwide, royalty-free license to retain and use any anonymized and aggregated trade data and derived analytics from your use of the Services for the purpose of maintaining, improving, and refining ZeroG\'s AI models, algorithms, and trading infrastructure.',
    ],
  },
  {
    title: 'Termination',
    paragraphs: ['ZeroG reserves the right to terminate User access immediately, without notice or refund, if we suspect a violation of the Anti-Reverse Engineering, No-Resale, or Confidentiality provisions of this Agreement. Upon termination, all licenses granted to the User expire immediately.'],
  },
  {
    title: 'Disclaimers & Acknowledgment',
    paragraphs: [
      'The Services are provided "AS IS" and "AS AVAILABLE" without warranties of any kind, express or implied.',
      'BY ACCESSING THE SERVICES, YOU ACKNOWLEDGE THAT YOU HAVE READ THIS AGREEMENT, UNDERSTAND THE RISKS OF ALGORITHMIC TRADING, AND AGREE TO BE BOUND BY ALL TERMS, SPECIFICALLY THE PROHIBITIONS AGAINST REVERSE ENGINEERING AND THE NO-REFUND POLICY.',
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
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">ZeroG Unified Master Services Agreement</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Read this Agreement carefully before enabling brokerage connections, automation, or billing on ZeroG.
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
