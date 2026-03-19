"use client";
import PageShell from "../../components/PageShell";

export default function AIPolicyPage() {
  return (
    <PageShell title={<span>AI Use Policy</span>} contentClassName="p-6 md:p-8">
      <div className="max-w-3xl mx-auto space-y-8 text-sm leading-relaxed text-gray-800">

        <div className="border-b pb-4">
          <h1 className="text-2xl font-bold text-gray-900">AI Use Policy</h1>
          <p className="text-gray-500 mt-1">Version 1.0 — Effective 18 March 2026</p>
        </div>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">1. What This Policy Covers</h2>
          <p>
            Close2Source uses artificial intelligence (AI) tools to help users create and improve written
            content on the platform — including project descriptions, individual profiles, and post text.
            This policy explains what data is processed when you use those features, how it is protected,
            and how you can control your participation.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">2. Which AI Features Are Available</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>AI Text Improvement</strong> — Improve, shorten, or lengthen text you have written in forms and profiles.</li>
            <li><strong>Project AI Review</strong> — A guided chat assistant that helps you build a compelling project proposal.</li>
            <li><strong>Individual Profile Review</strong> — A conversational tool that helps you craft your personal or ministry profile.</li>
          </ul>
          <p className="mt-2">All AI features are optional. You can use the platform fully without enabling AI.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">3. What Data Is Sent to the AI Provider</h2>
          <p>
            When you use an AI feature, the content you have entered in the relevant form fields
            (for example, a project description, profile bio, or post text) is transmitted to OpenAI, Inc.
            ("OpenAI") via a secure server-side connection. This includes:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Text content from the specific fields you are working on</li>
            <li>A system prompt that describes the context (e.g. "project proposal assistant")</li>
            <li>Conversation history for multi-turn chat features</li>
          </ul>
          <p className="mt-2 font-medium text-orange-700">
            We do not send your name, email address, payment information, or account credentials to OpenAI.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">4. Where the Data Goes — International Transfer</h2>
          <p>
            OpenAI is headquartered in the United States. When you use an AI feature, your content is
            processed on OpenAI's servers in the US. This transfer is covered by OpenAI's Data Processing
            Addendum, which incorporates the UK International Data Transfer Addendum (IDTA) and Standard
            Contractual Clauses (SCCs) as required under UK GDPR Chapter V.
          </p>
          <p className="mt-2">
            OpenAI does not use data submitted through the API to train its models, subject to its current
            API data usage policy. You can review OpenAI's privacy practices at{" "}
            <a
              href="https://openai.com/policies/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-600 underline hover:text-orange-800"
            >
              openai.com/policies/privacy-policy
            </a>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Legal Basis for AI Processing</h2>
          <p>
            The legal basis for processing your content through AI tools is your <strong>explicit consent</strong> (UK
            GDPR Article 6(1)(a)). You must actively opt in to AI features during account registration or
            in your account settings. AI features are disabled by default.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Your Rights and How to Opt Out</h2>
          <p>You can:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>
              <strong>Decline AI during registration</strong> — all AI features will be hidden from
              your account.
            </li>
            <li>
              <strong>Change your preference at any time</strong> — go to your account Settings and
              toggle the AI Features switch on or off. This takes effect immediately.
            </li>
            <li>
              <strong>Request erasure</strong> — if you believe your content was processed in error,
              contact us at{" "}
              <a href="mailto:privacy@close2source.com" className="text-orange-600 underline">
                privacy@close2source.com
              </a>{" "}
              to request deletion.
            </li>
          </ul>
          <p className="mt-2">
            Withdrawing consent does not affect the lawfulness of processing that occurred before withdrawal.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Accuracy and Human Review</h2>
          <p>
            AI-generated suggestions are not guaranteed to be accurate, complete, or appropriate. You remain
            fully responsible for reviewing any AI output before saving it to your profile or project.
            Close2Source does not validate the factual accuracy of AI suggestions.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">8. Changes to This Policy</h2>
          <p>
            We may update this policy to reflect changes to AI features or legal requirements. We will
            notify you by email if we make material changes, and you may be asked to review and re-consent.
            The current version and effective date are always shown at the top of this page.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">9. Contact</h2>
          <p>
            Questions about AI data processing can be directed to{" "}
            <a href="mailto:privacy@close2source.com" className="text-orange-600 underline">
              privacy@close2source.com
            </a>.
          </p>
        </section>

      </div>
    </PageShell>
  );
}
