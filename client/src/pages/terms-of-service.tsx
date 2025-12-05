import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 max-w-4xl">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-8" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </Link>

        <div className="prose prose-sm dark:prose-invert max-w-none">
          <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
          <p className="text-muted-foreground mb-8">Last updated: December 5, 2025</p>

          <p className="mb-8">
            Welcome to MenuMetrics! Please read these Terms of Service ("Terms") carefully before using the MenuMetrics application (the "Service") operated by MenuMetrics ("us", "we", or "our"), located in Austin, Texas. By accessing or using the Service, you agree to be bound by these Terms. If you disagree with any part of the terms, then you may not access the Service.
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">1. Accounts and Registration</h2>
            <p className="mb-4">
              To access the features of MenuMetrics, you must register for an account. You agree to:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li>Provide accurate, current, and complete information during the registration process</li>
              <li>Maintain the security of your password and accept all risks of unauthorized access to your account</li>
              <li>Notify us immediately if you discover or suspect any security breaches related to the Service</li>
              <li>Accept responsibility for all activities that occur under your account</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">2. Intellectual Property and License Restrictions</h2>
            <p className="mb-4 font-medium">
              This section is critical to protecting our business and intellectual property.
            </p>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">2.1 License Grant</h3>
            <p className="mb-4">
              Subject to your compliance with these Terms, MenuMetrics grants you a limited, non-exclusive, non-transferable, non-sublicensable license to access and use the Service solely for your internal business operations (e.g., managing your restaurant's inventory and costs).
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-3">2.2 Restrictions on Use</h3>
            <p className="mb-4">
              You explicitly agree NOT to:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li><strong>Copy or Duplicate:</strong> License, sell, rent, lease, transfer, assign, distribute, display, disclose, or otherwise commercially exploit the Service or make the Service available to any third party</li>
              <li><strong>Reverse Engineer:</strong> Modify, make derivative works of, disassemble, reverse compile, or reverse engineer any part of the Service</li>
              <li><strong>Competitive Research:</strong> Access the Service in order to build a similar or competitive product or service</li>
              <li><strong>Copy Features:</strong> Copy any features, functions, logic, algorithms, or graphics of the Service</li>
              <li><strong>Scrape or Extract:</strong> Use any automated means to access, scrape, or extract data from the Service</li>
            </ul>
            <p className="mb-4 font-medium text-destructive">
              Violation of this section will result in immediate termination of your account and may result in legal action.
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-3">2.3 Ownership</h3>
            <p className="mb-4">
              MenuMetrics and its licensors own all right, title, and interest in and to the Service, including all related intellectual property rights. The MenuMetrics name, logo, and product names are trademarks of MenuMetrics. You may not use these trademarks without our prior written consent.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">3. Your Data</h2>
            <p className="mb-4">
              You retain all rights to the data, recipes, and inventory information you input into the Service ("User Data"). You grant MenuMetrics a limited license to store, process, and backup this data solely to provide the Service to you. We will not sell or share your User Data with third parties except as necessary to operate the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">4. Subscription and Payment Terms</h2>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">4.1 Subscription Plans</h3>
            <p className="mb-4">
              MenuMetrics offers subscription tiers for access to our menu costing and inventory tools. By selecting a plan, you agree to pay the recurring monthly fees associated with that plan:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li>Starter: $19.00 / month</li>
              <li>Professional: $49.00 / month</li>
              <li>Business: $99.00 / month</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">4.2 Payment Processing</h3>
            <p className="mb-4">
              We use Stripe as our third-party payment processor. By subscribing, you authorize us to charge your payment method on a recurring monthly basis via Stripe. Your payment information is processed and stored securely by Stripe, not by MenuMetrics. We do not store your full credit card details on our servers.
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-3">4.3 Cancellation and Refunds</h3>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li><strong>Automatic Renewal:</strong> Your subscription will automatically renew at the end of each billing cycle unless you cancel it</li>
              <li><strong>Cancellation:</strong> You may cancel your subscription at any time through your account settings. Cancellation will take effect at the end of the current paid billing period</li>
              <li><strong>Refunds:</strong> Payments are non-refundable. There are no refunds or credits for partially used periods</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">5. AI Usage Limits</h2>
            <p className="mb-4">
              Different subscription tiers include different monthly limits on AI feature usage:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li>Free: No AI access</li>
              <li>Trial: 10 AI queries (7-day limit)</li>
              <li>Starter: 50 AI queries per month</li>
              <li>Professional: 200 AI queries per month</li>
              <li>Business: 500 AI queries per month</li>
            </ul>
            <p className="mb-4">
              Unused queries do not roll over to the next billing period. Queries reset monthly on your subscription renewal date.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">6. Acceptable Use Policy</h2>
            <p className="mb-4">
              You agree not to use the Service:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li>In any way that violates any applicable federal, state, local, or international law or regulation</li>
              <li>To transmit any viruses, malware, or other malicious code</li>
              <li>To attempt to gain unauthorized access to, interfere with, damage, or disrupt any parts of the Service or the server on which the Service is stored</li>
              <li>To engage in any conduct that restricts or inhibits anyone's use or enjoyment of the Service</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">7. Disclaimers</h2>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">7.1 "As Is" Basis</h3>
            <p className="mb-4">
              The Service is provided on an "AS IS" and "AS AVAILABLE" basis. MenuMetrics makes no representations or warranties of any kind, express or implied, regarding the operation of the Service or the information, content, or materials included therein. MenuMetrics disclaims all warranties, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, and non-infringement.
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-3">7.2 No Financial or Business Advice</h3>
            <p className="mb-4 font-medium">
              MenuMetrics is a calculation and organizational tool. While we strive for accuracy, we do not guarantee the profitability of your business. The cost calculations, pricing suggestions, and AI recommendations provided by the Service are for informational purposes only and should not be construed as financial, business, or professional advice. You are solely responsible for your pricing decisions, business strategy, and financial compliance. We strongly recommend consulting with qualified professionals for financial and business decisions.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">8. Limitation of Liability</h2>
            <p className="mb-4">
              To the fullest extent permitted by applicable law, in no event shall MenuMetrics, its affiliates, directors, employees, or agents be liable for any indirect, punitive, incidental, special, consequential, or exemplary damages, including without limitation damages for loss of profits, goodwill, use, data, or other intangible losses, arising out of or relating to the use of, or inability to use, the Service.
            </p>
            <p className="mb-4 font-medium">
              Liability Cap: In no event shall MenuMetrics' total liability to you for all claims exceed the amount you have paid us during the three (3) months prior to the claim.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">9. Indemnification</h2>
            <p className="mb-4">
              You agree to defend, indemnify, and hold harmless MenuMetrics, its affiliates, and their respective officers, directors, employees, and agents from and against any claims, liabilities, damages, judgments, awards, losses, costs, expenses, or fees (including reasonable attorneys' fees) arising out of or relating to your violation of these Terms or your use of the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">10. Termination</h2>
            <p className="mb-4">
              MenuMetrics may terminate or suspend your account and access to the Service at any time, with or without cause, and with or without notice. Upon termination, your right to use the Service will immediately cease. All provisions of these Terms which by their nature should survive termination shall survive termination, including, without limitation, ownership provisions, warranty disclaimers, indemnity, and limitations of liability.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">11. Modifications to Terms</h2>
            <p className="mb-4">
              We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will try to provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion. By continuing to access or use our Service after those revisions become effective, you agree to be bound by the revised terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">12. Governing Law and Jurisdiction</h2>
            <p className="mb-4">
              These Terms shall be governed and construed in accordance with the laws of the State of Texas, United States, without regard to its conflict of law provisions.
            </p>
            <p className="mb-4">
              Any legal suit, action, or proceeding arising out of, or related to, these Terms or the Service shall be instituted exclusively in the federal courts of the United States or the courts of the State of Texas, in each case located in Travis County (Austin). You waive any and all objections to the exercise of jurisdiction over you by such courts and to venue in such courts.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">13. Severability</h2>
            <p className="mb-4">
              If any provision of these Terms is held to be unenforceable or invalid, such provision will be changed and interpreted to accomplish the objectives of such provision to the greatest extent possible under applicable law, and the remaining provisions will continue in full force and effect.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">14. Entire Agreement</h2>
            <p className="mb-4">
              These Terms constitute the entire agreement between you and MenuMetrics regarding your use of the Service and supersede all prior and contemporaneous written or oral agreements between you and MenuMetrics.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mt-8 mb-4">15. Contact Us</h2>
            <p className="mb-4">
              If you have any questions about these Terms of Service, please contact us at:
            </p>
            <p className="mb-4">
              MenuMetrics<br />
              Austin, TX
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t text-center">
          <p className="text-sm text-muted-foreground mb-4">
            By using MenuMetrics, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
          </p>
          <Link href="/">
            <Button data-testid="button-return-home">Return to Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
