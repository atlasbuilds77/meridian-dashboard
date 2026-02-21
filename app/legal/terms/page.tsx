export default function TermsPage() {
  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
      
      <div className="prose prose-invert max-w-none space-y-6">
        <p className="text-sm text-muted-foreground">Last Updated: February 20, 2026</p>
        
        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4">1. Agreement</h2>
          <p>These Terms of Service govern your access to and use of Meridian trading platform. By using the Services, you agree to be bound by these Terms.</p>
        </section>
        
        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4">2. Nature of Services</h2>
          <p>Meridian is a technology platform that:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Connects to supported third-party brokerage accounts via API</li>
            <li>Transmits trade instructions to your broker</li>
            <li>Provides analytics, alerts, and tracking tools</li>
          </ul>
          <p className="mt-4 font-semibold">Meridian does NOT:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Provide investment, legal, tax, or financial advice</li>
            <li>Recommend or endorse specific securities or strategies</li>
            <li>Exercise discretionary authority over your account</li>
            <li>Act as a broker-dealer or investment adviser</li>
            <li>Custody or hold customer funds</li>
          </ul>
        </section>
        
        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4">3. User Responsibility</h2>
          <p>You are solely responsible for:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>All investment decisions and outcomes</li>
            <li>Determining whether the Services are appropriate for you</li>
            <li>Compliance with all applicable laws and regulations</li>
            <li>Maintaining the security of your account</li>
          </ul>
        </section>
        
        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4">4. Fees</h2>
          <p><strong>Monthly Membership:</strong> $1,200/month</p>
          <p><strong>Automation Service Fee:</strong> 10% of weekly profits (calculated Monday-Friday, charged Sunday night if profitable)</p>
          <p className="mt-4">All sales are final. No refunds.</p>
        </section>
        
        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4">5. Arbitration Agreement</h2>
          <p>Any dispute arising from these Terms shall be resolved through binding arbitration administered by the American Arbitration Association (AAA). You waive your right to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Participate in class action lawsuits</li>
            <li>Trial by jury</li>
            <li>File suit in court (except small claims)</li>
          </ul>
          <p className="mt-4">You may opt out of arbitration within 30 days by emailing support@meridian.com.</p>
        </section>
        
        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4">6. Limitation of Liability</h2>
          <p>Our maximum liability to you is limited to the lesser of:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>$1,200, or</li>
            <li>Total fees paid to Meridian in your lifetime</li>
          </ul>
          <p className="mt-4">We exclude all liability for:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Lost profits or trading losses</li>
            <li>Data loss or corruption</li>
            <li>System failures, bugs, or API outages</li>
            <li>Third-party broker actions or failures</li>
          </ul>
        </section>
        
        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4">7. Disclaimers</h2>
          <p className="font-semibold">Services provided "AS IS" with no warranties.</p>
          <p className="mt-4">We disclaim all warranties including:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Merchantability</li>
            <li>Fitness for a particular purpose</li>
            <li>Accuracy or reliability of data</li>
            <li>Uninterrupted or error-free service</li>
          </ul>
        </section>
        
        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4">8. Contact</h2>
          <p>Questions? Email: support@meridian.com</p>
        </section>
      </div>
    </div>
  );
}
