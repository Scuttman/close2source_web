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
      <body className="min-h-dvh flex flex-col bg-brand-sand text-brand-dark antialiased">
        <header className="border-b bg-brand-main">
          <div className="mx-auto max-w-6xl px-4">
            <NavBar />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-10 flex-1">{children}</main>
        <footer className="border-t-0 bg-black relative">
          <div className="absolute top-0 left-0 w-full h-2 bg-brand-main" style={{height: '8px'}} />
          <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-white relative z-10">
            © {new Date().getFullYear()} Close2Source
          </div>
        </footer>
      </body>
    </html>
  );
}