import PageShell from "../../components/PageShell";

export default function PrivacyPolicyPage() {
  const effectiveDate = "17 March 2026";

  return (
    <PageShell title="Privacy Policy">
      <div className="mx-auto max-w-3xl w-full px-4 py-4">
        {/* Header */}
        <div className="mb-8">
          <p className="text-gray-500 text-sm">Effective Date: {effectiveDate}</p>
        </div>

        <div className="space-y-8 text-gray-700 leading-relaxed">
          {/* Introduction */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Introduction</h2>
            <p>
              Close2Source (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) is committed to protecting
              your personal information and your right to privacy. This Privacy Policy explains how we
              collect, use, disclose, and safeguard your information when you use our platform at{" "}
              <a href="https://close2source.com" className="text-brand-main underline hover:text-brand-main/80">
                close2source.com
              </a>{" "}
              (the &ldquo;Platform&rdquo;).
            </p>
            <p className="mt-3">
              By accessing or using the Platform, you agree to the terms of this Privacy Policy. If you do
              not agree, please discontinue use of the Platform.
            </p>
          </section>

          {/* Information We Collect */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Information We Collect</h2>
            <h3 className="text-base font-semibold text-gray-800 mb-2">2.1 Information You Provide</h3>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Account registration details (name, email address, password)</li>
              <li>Profile information (display name, profile picture, bio)</li>
              <li>Organization details (name, description, location)</li>
              <li>Project information (titles, descriptions, updates, images, documents)</li>
              <li>Communications sent through our contact form or support channels</li>
              <li>Payment or credit-related information where applicable</li>
            </ul>

            <h3 className="text-base font-semibold text-gray-800 mt-4 mb-2">2.2 Information Collected Automatically</h3>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Device information (browser type, operating system, IP address)</li>
              <li>Usage data (pages visited, features used, time spent on Platform)</li>
              <li>Cookies and similar tracking technologies (see Section 6)</li>
              <li>Firebase Analytics data including session identifiers and interaction events</li>
            </ul>

            <h3 className="text-base font-semibold text-gray-800 mt-4 mb-2">2.3 Information from Third Parties</h3>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Authentication data from Google Sign-In or Apple Sign-In where used</li>
              <li>Public profile information linked to your third-party authentication provider</li>
            </ul>
          </section>

          {/* How We Use Your Information */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>Create, manage, and secure your account</li>
              <li>Provide and improve the Platform and its features</li>
              <li>Process credits, transactions, and platform activity</li>
              <li>Enable organization and project management features</li>
              <li>Send transactional emails (account confirmations, notifications)</li>
              <li>Respond to your inquiries and support requests</li>
              <li>Monitor Platform usage for security and fraud prevention</li>
              <li>Comply with legal obligations</li>
              <li>Analyse Platform performance using aggregated, anonymised data</li>
            </ul>
          </section>

          {/* Sharing Your Information */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Sharing Your Information</h2>
            <p>
              We do not sell, trade, or rent your personal data to third parties. We may share your
              information only in the following circumstances:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>
                <strong>Service Providers:</strong> We use Google Firebase (Authentication, Firestore,
                Storage, Analytics) to operate core Platform services. These providers operate under
                their own privacy policies and data processing agreements.
              </li>
              <li>
                <strong>Legal Requirements:</strong> Where required by law, court order, or governmental
                authority.
              </li>
              <li>
                <strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of
                assets, your data may be transferred to a successor entity.
              </li>
              <li>
                <strong>With Your Consent:</strong> In any other circumstance where you have given explicit
                consent.
              </li>
            </ul>
          </section>

          {/* Data Storage and Security */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Data Storage and Security</h2>
            <p>
              Your data is stored using Google Firebase infrastructure, with our primary Firestore
              database located in the <strong>europe-west2</strong> (London) region. Firebase applies
              industry-standard encryption in transit (TLS) and at rest.
            </p>
            <p className="mt-3">
              While we take reasonable technical and organisational measures to protect your data, no
              system is completely secure. We cannot guarantee the absolute security of your information
              and encourage you to use a strong, unique password for your account.
            </p>
          </section>

          {/* Cookies */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Cookies and Local Storage</h2>
            <p>
              The Platform uses cookies and browser local storage to:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>Maintain your authenticated session</li>
              <li>Remember your cookie consent preference</li>
              <li>Collect anonymised analytics data via Google Firebase Analytics</li>
            </ul>
            <p className="mt-3">
              By continuing to use the Platform after accepting our cookie notice, you consent to
              this use. You can clear local storage and cookies through your browser settings at any
              time, though this will log you out and reset your preferences.
            </p>
          </section>

          {/* Data Retention */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Data Retention</h2>
            <p>
              We retain your personal data for as long as your account is active or as needed to
              provide you with Platform services. If you request account deletion, we will remove or
              anonymise your personal data within 30 days, except where retention is required by law
              or for legitimate business purposes (such as resolving disputes or enforcing agreements).
            </p>
          </section>

          {/* Your Rights */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Your Rights</h2>
            <p>Depending on your location, you may have the right to:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your personal data</li>
              <li>Object to or restrict certain processing of your data</li>
              <li>Data portability (receive a copy of your data in a structured format)</li>
              <li>Withdraw consent where processing is based on consent</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, please contact us at{" "}
              <a href="mailto:info@close2source.com" className="text-brand-main underline hover:text-brand-main/80">
                info@close2source.com
              </a>
              .
            </p>
          </section>

          {/* Children */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Children&apos;s Privacy</h2>
            <p>
              The Platform is not directed to individuals under the age of 16. We do not knowingly
              collect personal data from children. If you believe a child has provided us with
              personal information, please contact us and we will delete it promptly.
            </p>
          </section>

          {/* Links */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Third-Party Links</h2>
            <p>
              The Platform may contain links to third-party websites or services. We are not
              responsible for the privacy practices of those sites. We encourage you to review
              the privacy policies of any external services you visit.
            </p>
          </section>

          {/* Changes */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. When we do, we will revise the
              &ldquo;Effective Date&rdquo; at the top of this page. We encourage you to review this
              policy periodically. Continued use of the Platform after changes are posted constitutes
              acceptance of the updated policy.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Contact Us</h2>
            <p>
              If you have any questions or concerns about this Privacy Policy or our data practices,
              please contact us:
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
