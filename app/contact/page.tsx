"use client";

import PageShell from "../../components/PageShell";
import { useState, useEffect } from "react";

function generateMath() {
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  return { a, b, answer: a + b };
}

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [honeypot, setHoneypot] = useState("");
  const [math, setMath] = useState({ a: 3, b: 4, answer: 7 });
  const [mathInput, setMathInput] = useState("");
  const [mathError, setMathError] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => { setMath(generateMath()); }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMathError(false);

    // Client-side math check
    if (parseInt(mathInput, 10) !== math.answer) {
      setMathError(true);
      setMath(generateMath());
      setMathInput("");
      return;
    }

    setStatus("sending");
    setErrorMsg("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, honeypot }),
      });

      if (res.ok) {
        setStatus("success");
        setForm({ name: "", email: "", subject: "", message: "" });
        setMathInput("");
        setMath(generateMath());
      } else {
        const data = await res.json();
        setErrorMsg(data.error || "Something went wrong.");
        setStatus("error");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
      setStatus("error");
    }
  };

  return (
    <PageShell title={<span>Contact</span>} contentClassName="p-6 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-brand-main mb-2">Get in Touch</h1>
          <p className="text-brand-dark leading-relaxed">
            Have questions or want to get involved? Send us a message and we&apos;ll get back to you.
          </p>
        </div>

        {status === "success" ? (
          <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center">
            <div className="text-4xl mb-3">✓</div>
            <h2 className="text-xl font-semibold text-green-800 mb-1">Message sent!</h2>
            <p className="text-green-700 text-sm">We&apos;ll get back to you at {form.email || "your email"} as soon as possible.</p>
            <button
              onClick={() => setStatus("idle")}
              className="mt-4 px-4 py-2 rounded bg-brand-main text-white text-sm font-semibold hover:bg-brand-dark transition"
            >
              Send another message
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-xl border border-brand-100 p-6 shadow-sm">
            {/* Honeypot – hidden from real users, bots fill this in */}
            <div aria-hidden="true" style={{ display: "none" }}>
              <input type="text" name="website" value={honeypot} onChange={e => setHoneypot(e.target.value)} tabIndex={-1} autoComplete="off" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-brand-dark mb-1">Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  placeholder="Your name"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-main/30 focus:border-brand-main"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-dark mb-1">Email <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  placeholder="your@email.com"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-main/30 focus:border-brand-main"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Subject <span className="text-red-500">*</span></label>
              <input
                type="text"
                name="subject"
                value={form.subject}
                onChange={handleChange}
                required
                placeholder="What is this about?"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-main/30 focus:border-brand-main"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Message <span className="text-red-500">*</span></label>
              <textarea
                name="message"
                value={form.message}
                onChange={handleChange}
                required
                rows={6}
                placeholder="Tell us how we can help..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-main/30 focus:border-brand-main resize-none"
              />
            </div>

            {/* Math spam check */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-brand-dark mb-2">
                Spam check: what is {math.a} + {math.b}? <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={mathInput}
                onChange={e => { setMathInput(e.target.value); setMathError(false); }}
                required
                placeholder="Your answer"
                className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-main/30 focus:border-brand-main"
              />
              {mathError && (
                <p className="text-red-600 text-xs mt-1">Incorrect answer — please try again.</p>
              )}
            </div>

            {status === "error" && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full py-2.5 px-4 rounded-lg bg-brand-main text-white font-semibold hover:bg-brand-dark transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {status === "sending" ? "Sending…" : "Send Message"}
            </button>
          </form>
        )}

        <div className="text-sm text-brand-dark/70 text-center">
          Or email us directly at{" "}
          <a href="mailto:info@close2source.com" className="text-brand-main hover:underline font-medium">
            info@close2source.com
          </a>
        </div>
      </div>
    </PageShell>
  );
}
