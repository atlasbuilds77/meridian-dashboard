export default function RiskDisclosurePage() {
  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Risk Disclosure Agreement</h1>
      
      <div className="prose prose-invert max-w-none space-y-6">
        <p className="text-sm text-muted-foreground">Last Updated: February 20, 2026</p>
        
        <div className="bg-loss/10 border border-loss/50 rounded-lg p-6 my-6">
          <p className="font-bold text-loss">⚠️ WARNING: SUBSTANTIAL RISK OF LOSS</p>
          <p className="mt-2">Trading options and using automated trading systems involves substantial risk of loss. You could lose all or more than your original investment.</p>
        </div>
        
        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4">1. Options Trading Risks</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Total Loss Potential:</strong> Options can expire worthless, resulting in 100% loss of premium paid</li>
            <li><strong>Complexity:</strong> Options strategies involve multiple variables (strike, expiration, volatility) that novice traders may not fully understand</li>
            <li><strong>Time Decay:</strong> Options lose value as expiration approaches, even if the underlying asset doesn't move</li>
            <li><strong>Volatility Risk:</strong> Implied volatility changes can cause significant price swings</li>
            <li><strong>Assignment Risk:</strong> Short options positions may be assigned at any time</li>
            <li><strong>0DTE Risk:</strong> Zero days to expiration options are extremely volatile and risky</li>
          </ul>
        </section>
        
        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4">2. Automated Trading Risks</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Technical Failures:</strong> Software bugs, server outages, or connectivity issues may prevent trades from executing</li>
            <li><strong>Lack of Human Oversight:</strong> Automated systems execute without real-time human judgment</li>
            <li><strong>Configuration Errors:</strong> Incorrect settings may result in unintended trades</li>
            <li><strong>Market Conditions:</strong> Algorithms may not adapt to unprecedented market events</li>
          </ul>
        </section>
        
        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4">3. Past Performance Disclaimer</h2>
          <p className="font-semibold">PAST PERFORMANCE IS NOT INDICATIVE OF FUTURE RESULTS.</p>
          <p className="mt-4">Hypothetical or backtested performance results have inherent limitations:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Designed with benefit of hindsight</li>
            <li>Do not represent actual trading</li>
            <li>May not reflect impact of market factors</li>
            <li>May over-state or under-state actual results</li>
          </ul>
        </section>
        
        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4">4. No FDIC Insurance</h2>
          <p>Trading accounts are NOT protected by FDIC insurance. SIPC protection (up to $500K) may apply through your broker, but does NOT protect against trading losses.</p>
        </section>
        
        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4">5. Market Volatility</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Flash Crashes:</strong> Sudden, extreme price movements can trigger stop losses or cause massive losses</li>
            <li><strong>Gap Risk:</strong> Prices may gap up or down, bypassing stop loss orders</li>
            <li><strong>Liquidity Risk:</strong> Some options may have wide bid-ask spreads or low volume</li>
          </ul>
        </section>
        
        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4">6. Leverage & Margin Risks</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Options provide leverage, amplifying both gains and losses</li>
            <li>Margin calls may force liquidation at unfavorable prices</li>
            <li>You may lose more than your initial investment</li>
          </ul>
        </section>
        
        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4">7. System Downtime Risks</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Platform may experience outages during critical trading periods</li>
            <li>API connections to brokers may fail</li>
            <li>You may be unable to exit positions when needed</li>
          </ul>
        </section>
        
        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4">8. Third-Party API Risks</h2>
          <p>Meridian relies on third-party brokerage APIs (Tradier). Risks include:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Broker API outages or rate limits</li>
            <li>Execution delays or rejections</li>
            <li>Data accuracy issues</li>
            <li>Broker policy changes or service termination</li>
          </ul>
        </section>
        
        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4">9. No Investment Advice</h2>
          <p>Meridian is a technology platform, NOT an investment adviser. We do not:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Recommend specific trades or strategies</li>
            <li>Assess your risk tolerance or suitability</li>
            <li>Provide personalized investment advice</li>
            <li>Guarantee any results or performance</li>
          </ul>
        </section>
        
        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4">10. User Acknowledgment</h2>
          <p className="font-semibold">By using Meridian, you acknowledge and accept that:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>You may lose all invested capital</li>
            <li>You are solely responsible for all trading decisions</li>
            <li>You understand options and automated trading risks</li>
            <li>You will not rely on Meridian for investment advice</li>
            <li>You accept all risks outlined in this disclosure</li>
            <li>You have read and understood this entire document</li>
          </ul>
        </section>
        
        <div className="bg-loss/10 border border-loss/50 rounded-lg p-6 my-6">
          <p className="font-bold">FINAL WARNING</p>
          <p className="mt-2">Only invest money you can afford to lose. Trading is not suitable for everyone. Consult a licensed financial adviser before making investment decisions.</p>
        </div>
      </div>
    </div>
  );
}
