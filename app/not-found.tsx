import Link from "next/link";
import PageShell from "../components/PageShell";
import C2SStampSVG from "../components/C2SStampSVG";

export default function NotFound() {
  return (
    <PageShell title="404 Page Not Found">
      <div className="flex flex-col items-center justify-center py-20 gap-6">
        <C2SStampSVG message="Sorry, we couldn't get you to source!" size={300} />
        <p className="text-gray-500 text-sm">The page you were looking for doesn&apos;t exist.</p>
        <Link
          href="/"
          className="px-6 py-2 bg-brand-main text-white rounded-lg font-semibold hover:bg-brand-dark transition"
        >
          Go to Home
        </Link>
      </div>
    </PageShell>
  );
}
