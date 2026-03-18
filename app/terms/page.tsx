import PageShell from "../../components/PageShell";

export default function TermsOfServicePage() {
  const effectiveDate = "17 March 2026";

  return (
    <PageShell title="Terms of Service">
      <div className="mx-auto max-w-3xl w-full px-4 py-4">
        {/* Header */}
        <div className="mb-8">
          <p className="text-gray-500 text-sm">Effective Date: {effectiveDate}</p>
        </div>

        <div className="space-y-8 text-gray-700 leading-relaxed">
          {/* Acceptance */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using the Close2Source platform (&ldquo;Platform&rdquo;) at{" "}
              <a href="https://close2source.com" className="text-brand-main underline hover:text-brand-main/80">
                close2source.com
              </a>
              , you agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;). If you do not
              agree to these Terms, you must not use the Platform.
            </p>
            <p className="mt-3">
              These Terms constitute a legally binding agreement between you and Close2Source. We reserve
              the right to update these Terms at any time. Continued use of the Platform after changes
              are posted constitutes acceptance of the revised Terms.
            </p>
          </section>

          {/* Eligibility */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Eligibility</h2>
            <p>
              You must be at least 16 years of age to use the Platform. By using the Platform, you
              represent and warrant that you meet this requirement and that all information you provide
              is accurate and complete.
            </p>
          </section>

          {/* Accounts */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. User Accounts</h2>
            <p>
              To access most features of the Platform, you must register for an account. You are
              responsible for:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>Maintaining the confidentiality of your login credentials</li>
              <li>All activity that occurs under your account</li>
              <li>Ensuring your account information remains accurate and up to date</li>
              <li>Notifying us immediately of any unauthorised use of your account</li>
            </ul>
            <p className="mt-3">
              We reserve the right to suspend or terminate accounts that violate these Terms or that
              we reasonably believe are being used fraudulently or maliciously.
            </p>
          </section>

          {/* Credits */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Credits System</h2>
            <p>
              The Platform uses a credits system to access certain features. Credits are subject to
              the following conditions:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>New accounts receive 50 complimentary credits upon registration</li>
              <li>Credits have no monetary value and are non-transferable</li>
              <li>Credits cannot be redeemed for cash or any other form of compensation</li>
              <li>We reserve the right to modify the credit allocation, pricing, or features at any time</li>
              <li>Unused credits may expire; we will provide reasonable notice of any expiry policy changes</li>
            </ul>
          </section>

          {/* Organisations and Projects */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Organisations and Projects</h2>
            <p>
              Users may create and manage organisations and projects on the Platform. By doing so, you
              agree that:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>You are solely responsible for all content published under your organisation or project</li>
              <li>Organisation owners control membership via a unique access code and PIN</li>
              <li>You will not misuse the organisation access system to grant unauthorised access</li>
              <li>Project and organisation data you submit is accurate and not misleading</li>
              <li>
                Close2Source may remove organisations or projects that violate these Terms or applicable
                laws without notice
              </li>
            </ul>
          </section>

          {/* Acceptable Use */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Acceptable Use</h2>
            <p>You agree not to use the Platform to:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>Upload, post, or transmit unlawful, harmful, defamatory, or fraudulent content</li>
              <li>Impersonate any person or entity or misrepresent your affiliation</li>
              <li>Attempt to gain unauthorised access to other accounts or Platform systems</li>
              <li>Introduce malware, viruses, or any other harmful code</li>
              <li>Use automated tools to scrape, crawl, or harvest data from the Platform</li>
              <li>Violate any applicable local, national, or international law or regulation</li>
              <li>Engage in any activity that disrupts or interferes with the Platform&apos;s operation</li>
            </ul>
          </section>

          {/* Content Ownership */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Content and Intellectual Property</h2>
            <p>
              You retain ownership of content you submit to the Platform (including project descriptions,
              images, and reports). By submitting content, you grant Close2Source a non-exclusive,
              worldwide, royalty-free licence to use, display, and store that content solely for the
              purpose of operating and improving the Platform.
            </p>
            <p className="mt-3">
              The Close2Source name, logo, design, and proprietary technology are the intellectual
              property of Close2Source. You may not reproduce, distribute, or create derivative works
              without our express written permission.
            </p>
          </section>

          {/* Privacy */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Privacy</h2>
            <p>
              Your use of the Platform is also governed by our{" "}
              <a href="/privacy" className="text-brand-main underline hover:text-brand-main/80">
                Privacy Policy
              </a>
              , which is incorporated into these Terms by reference. By using the Platform, you consent
              to the collection and use of your data as described in the Privacy Policy.
            </p>
          </section>

          {/* Disclaimers */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Disclaimers and Limitation of Liability</h2>
            <p>
              The Platform is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis
              without warranties of any kind, either express or implied. We do not warrant that the
              Platform will be uninterrupted, error-free, or free of harmful components.
            </p>
            <p className="mt-3">
              To the fullest extent permitted by law, Close2Source shall not be liable for any indirect,
              incidental, consequential, or punitive damages arising from your use of or inability to
              use the Platform.
            </p>
          </section>

          {/* Termination */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Termination</h2>
            <p>
              We may suspend or terminate your access to the Platform at any time, with or without notice,
              for any reason including breach of these Terms. You may also delete your account at any time
              by contacting us at{" "}
              <a href="mailto:info@close2source.com" className="text-brand-main underline hover:text-brand-main/80">
                info@close2source.com
              </a>
              .
            </p>
            <p className="mt-3">
              Upon termination, your right to use the Platform ceases immediately. Provisions that by their
              nature should survive termination (including intellectual property, disclaimers, and
              limitations of liability) shall remain in effect.
            </p>
          </section>

          {/* Governing Law */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Governing Law</h2>
            <p>
              These Terms are governed by and construed in accordance with applicable law. Any disputes
              arising out of or relating to these Terms or the Platform shall be subject to the exclusive
              jurisdiction of the courts of competent jurisdiction.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Contact Us</h2>
            <p>
              If you have any questions about these Terms, please contact us:
            </p>
            <div className="mt-3 p-4 bg-gray-100 rounded-lg">
              <p className="font-semibold text-gray-900">Close2Source</p>
              <p className="mt-1">
                Email:{" "}
                <a href="mailto:info@close2source.com" className="text-brand-main underline hover:text-brand-main/80">
                  info@close2source.com
                </a>
              </p>
              <p>Website: <a href="https://close2source.com" className="text-brand-main underline hover:text-brand-main/80">close2source.com</a></p>
            </div>
          </section>
        </div>
      </div>
    </PageShell>
  );
}
