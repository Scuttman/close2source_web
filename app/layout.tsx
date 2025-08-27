import type { Metadata } from "next";
import "./globals.css";
import { Inter } from "next/font/google";
import NavBar from "../components/NavBar";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Close2Source",
  description: "Donor-facing updates straight from the source."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-dvh flex flex-col bg-brand-sand text-brand-dark antialiased relative overflow-x-hidden">
        {/* Global background image and overlay */}
        <div className="fixed inset-0 -z-10 w-full h-full">
          <img
            src="/images/african-farming-bg.png"
            alt="African farming landscape background"
            className="w-full h-full object-cover object-center opacity-70"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-black/10" />
        </div>
        <header className="border-b bg-brand-main relative z-10">
          <div className="mx-auto max-w-6xl px-4">
            <NavBar />
          </div>
        </header>
  <main className="mx-auto max-w-6xl px-4 py-2 flex-1 relative z-10">{children}</main>
        <footer className="border-t-0 bg-black relative z-10">
          <div className="absolute top-0 left-0 w-full h-2 bg-brand-main" style={{height: '8px'}} />
          <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-white relative z-10">
            © {new Date().getFullYear()} Close2Source
          </div>
        </footer>
      </body>
    </html>
  );
}