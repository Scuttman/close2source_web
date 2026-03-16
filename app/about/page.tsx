import PageShell from "../../components/PageShell";

export default function AboutPage() {
  return (
    <PageShell title={<span>About</span>} contentClassName="p-6 md:p-8">
      <div className="space-y-6 max-w-3xl">
        <h1 className="text-3xl font-bold text-brand-main">About Close2Source</h1>
        <p className="text-brand-dark leading-relaxed">Close2Source connects donors and supporters directly with projects and individuals, providing updates straight from the source.</p>
      </div>
    </PageShell>
  );
}
