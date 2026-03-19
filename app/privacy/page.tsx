import PageShell from "../../components/PageShell";

export default function PrivacyPolicyPage() {
  const effectiveDate = "18 March 2026";

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
            <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm">
              <p className="font-semibold text-gray-800 mb-1">Data Controller</p>
              <p className="text-gray-600">
                Christopher Scutt trading as <strong>Close2Source</strong><br />
                87 Little Breach, Chichester, West Sussex, PO19 5TZ, United Kingdom<br />
                Email:{" "}
                <a href="mailto:info@close2source.com" className="text-brand-main underline hover:text-brand-main/80">
                  info@close2source.com
                </a>
              </p>
              <p className="text-gray-500 text-xs mt-1">
                Sole trader (unregistered). VAT registration not applicable at current trading scale.
              </p>
            </div>
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

          {/* Lawful Basis for Processing */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3a. Lawful Basis for Processing (UK GDPR Article 6)</h2>
            <p className="mb-3">
              Under UK GDPR, we are required to identify a lawful basis for each category of processing.
              The table below sets out the basis we rely on for each activity.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold text-gray-700 border-b border-gray-200 w-1/2">Processing Activity</th>
                    <th className="text-left px-4 py-2 font-semibold text-gray-700 border-b border-gray-200">Lawful Basis (Article 6 ground)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[
                    ["Account credentials (name, email, password)", "Performance of a contract — Art. 6(1)(b)"],
                    ["Providing Platform services (project/org management, profiles)", "Performance of a contract — Art. 6(1)(b)"],
                    ["Transactional emails (confirmations, notifications)", "Performance of a contract — Art. 6(1)(b)"],
                    ["Credit processing and transactions", "Performance of a contract — Art. 6(1)(b)"],
                    ["Firebase Analytics (usage data, session data)", "Consent — Art. 6(1)(a)"],
                    ["AI-powered features (profile improvement, project analysis)", "Consent — Art. 6(1)(a)"],
                    ["Mandatory AI content moderation (safeguarding scan on publish)", "Legal obligation / Legitimate interests — Art. 6(1)(c)/(f)"],
                    ["Partner and pledge data", "Performance of a contract / Legitimate interests — Art. 6(1)(b)/(f)"],
                    ["Contact form messages", "Legitimate interests — Art. 6(1)(f)"],
                    ["Fraud prevention and platform security", "Legitimate interests — Art. 6(1)(f)"],
                    ["Legal compliance obligations", "Legal obligation — Art. 6(1)(c)"],
                  ].map(([activity, basis]) => (
                    <tr key={activity} className="even:bg-gray-50">
                      <td className="px-4 py-2 text-gray-700">{activity}</td>
                      <td className="px-4 py-2 text-gray-600">{basis}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-gray-500">
              Where we rely on consent (Art. 6(1)(a)), you may withdraw consent at any time via your{" "}
              <a href="/settings" className="text-brand-main underline hover:text-brand-main/80">Account Settings</a>{" "}
              without affecting the lawfulness of processing before withdrawal.
            </p>
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
                <strong>Google Firebase (USA / London):</strong> We use Firebase Authentication,
                Firestore, Cloud Storage, and Analytics to operate core Platform services. Primary data
                storage is in the <strong>europe-west2 (London)</strong> region. Firebase is operated
                by Google LLC under the Google Cloud Data Processing Addendum.
              </li>
              <li>
                <strong>Krystal Hosting Ltd (UK):</strong> Outbound transactional emails (contact form
                and notification emails) are sent via mail servers operated by Krystal Hosting Ltd,
                124 City Road, London EC1V 2NX (Company No. 07571790). Krystal is a UK-registered
                processor; no international transfer is involved. A Data Processing Agreement is in
                place under{" "}
                <a
                  href="https://krystal.io/legal/data-processing-agreement"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-main underline hover:text-brand-main/80"
                >
                  krystal.io/legal/data-processing-agreement
                </a>
                .
              </li>
              <li>
                <strong>OpenAI, Inc. (USA):</strong> When you use AI-powered features on the Platform
                (such as profile improvement, project analysis, or AI-assisted registration), content
                you provide is processed by OpenAI's servers in the United States. This international
                transfer is made under Standard Contractual Clauses and the UK International Data
                Transfer Addendum (IDTA). OpenAI acts as a data processor under a signed Data
                Processing Addendum. You can opt out of AI features at any time in{" "}
                <a href="/settings" className="text-brand-main underline hover:text-brand-main/80">Settings</a>.{" "}
                See our <a href="/ai-policy" className="text-brand-main underline hover:text-brand-main/80">AI Use Policy</a> for full details.
              </li>
              <li>
                <strong>OpenAI Moderation (mandatory):</strong> All profile content submitted for
                publication is scanned by OpenAI's content moderation API for safeguarding and safety
                purposes. This processing is mandatory, does not require your consent, and is carried
                out on the basis of legitimate interests / legal compliance obligations (Art. 6(1)(c)/(f)).
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

          {/* International Transfers */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4a. International Data Transfers</h2>
            <p>
              The Platform primarily processes data within the UK and EEA (Google Firebase, europe-west2,
              London). Where data is transferred to a country outside the UK/EEA (specifically to OpenAI
              in the United States), we ensure adequate safeguards are in place:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-3">
              <li>
                <strong>OpenAI (USA):</strong> Transfer is governed by Standard Contractual Clauses (SCCs)
                and the UK IDTA. OpenAI's current data processing terms are available at{" "}
                <a
                  href="https://openai.com/policies/data-processing-addendum"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-main underline hover:text-brand-main/80"
                >
                  openai.com/policies/data-processing-addendum
                </a>
                .
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
            <p className="mt-3">
              <strong>Data breach notification:</strong> In the event of a personal data breach that is
              likely to result in a risk to your rights and freedoms, we will notify the Information
              Commissioner&apos;s Office (ICO) within <strong>72 hours</strong> of becoming aware, as
              required by UK GDPR Article 33. Where the breach is likely to result in a high risk to
              you, we will also notify you directly without undue delay.
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
            <p>
              Under UK GDPR you have the following rights in relation to your personal data:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li><strong>Access</strong> — request a copy of the personal data we hold about you</li>
              <li><strong>Rectification</strong> — request correction of inaccurate or incomplete data</li>
              <li><strong>Erasure</strong> — request deletion of your personal data (subject to legal obligations to retain)</li>
              <li><strong>Restriction</strong> — request that we restrict processing of your data in certain circumstances</li>
              <li><strong>Portability</strong> — receive a copy of your data in a structured, machine-readable format</li>
              <li><strong>Objection</strong> — object to processing based on legitimate interests</li>
              <li><strong>Withdraw consent</strong> — where processing is based on consent, withdraw it at any time via{" "}
                <a href="/settings" className="text-brand-main underline hover:text-brand-main/80">Settings</a>
              </li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, please contact us at{" "}
              <a href="mailto:info@close2source.com" className="text-brand-main underline hover:text-brand-main/80">
                info@close2source.com
              </a>
              . We will respond within one calendar month as required by UK GDPR Article 12.
            </p>
            <p className="mt-3">
              <strong>Right to complain:</strong> If you believe we have not handled your personal data
              in accordance with the law, you have the right to lodge a complaint with the{" "}
              <strong>Information Commissioner&apos;s Office (ICO)</strong>:{" "}
              <a
                href="https://ico.org.uk/make-a-complaint"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-main underline hover:text-brand-main/80"
              >
                ico.org.uk/make-a-complaint
              </a>{" "}
              or by calling <strong>0303 123 1113</strong>. We would, however, appreciate the chance to
              address your concerns before you contact the ICO.
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
