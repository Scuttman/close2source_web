import PageShell from "../../components/PageShell";

export default function ContactPage() {
  return (
    <PageShell title={<span>Contact</span>} contentClassName="p-6 md:p-8">
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-3xl font-bold text-brand-main">Contact</h1>
        <p className="text-brand-dark leading-relaxed">Have questions or want to get involved? Reach out to us!</p>
        {/* Contact form or details can go here */}
      </div>
    </PageShell>
  );
}
