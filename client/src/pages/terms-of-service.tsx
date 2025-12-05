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
          <p className="text-muted-foreground mb-8">Last updated: December 2025</p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">1. Acceptance of Terms</h2>
            <p className="mb-4">
              By accessing and using MenuMetrics ("the Service"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">2. License Grant</h2>
            <p className="mb-4">
              MenuMetrics grants you a limited, non-exclusive, non-transferable license to use the Service for your personal or internal business purposes only. You may not:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li>Reproduce, duplicate, copy, sell, resell, or exploit any portion of the Service without express written permission</li>
              <li>Modify or create derivative works of the Service</li>
              <li>Reverse engineer, disassemble, or attempt to derive the source code of the Service</li>
              <li>Transfer or assign your license to any third party</li>
              <li>Commercially exploit the Service in any way</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">3. User Responsibilities</h2>
            <p className="mb-4">
              You are responsible for maintaining the confidentiality of your account credentials and password. You agree to accept responsibility for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account or any other breaches of security.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">4. User Content</h2>
            <p className="mb-4">
              You retain all rights to any content you submit, post, or display on the Service ("User Content"). By submitting User Content, you grant MenuMetrics a worldwide, non-exclusive, royalty-free license to use, reproduce, modify, and distribute such User Content for the purpose of operating and improving the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">5. Subscription and Billing</h2>
            <p className="mb-4">
              Certain features of the Service require a paid subscription. By subscribing, you agree to:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li>Pay all subscription fees in accordance with the pricing plan you select</li>
              <li>Keep your billing information current and accurate</li>
              <li>Subscriptions automatically renew unless cancelled before the renewal date</li>
              <li>Cancellations take effect at the end of the current billing period</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">6. AI Usage Limits</h2>
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
            <h2 className="text-2xl font-semibold mt-8 mb-4">7. Disclaimer of Warranties</h2>
            <p className="mb-4">
              The Service is provided "as-is" and "as-available" without warranties of any kind. MenuMetrics disclaims all warranties, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, and non-infringement.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">8. Limitation of Liability</h2>
            <p className="mb-4">
              In no event shall MenuMetrics be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use or inability to use the Service, even if MenuMetrics has been advised of the possibility of such damages.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">9. Termination</h2>
            <p className="mb-4">
              MenuMetrics may terminate or suspend your account and access to the Service at any time, with or without cause, and with or without notice. Upon termination, your right to use the Service will immediately cease.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">10. Modifications to Terms</h2>
            <p className="mb-4">
              MenuMetrics reserves the right to modify these terms at any time. Changes will be effective immediately upon posting to the Service. Your continued use of the Service following the posting of revised Terms means that you accept and agree to the changes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">11. Governing Law</h2>
            <p className="mb-4">
              These Terms of Service are governed by and construed in accordance with the laws of the jurisdiction in which MenuMetrics is operated, and you irrevocably submit to the exclusive jurisdiction of the courts in that location.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mt-8 mb-4">12. Contact Us</h2>
            <p className="mb-4">
              If you have any questions about these Terms of Service, please contact us through the support channels available in the application.
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
