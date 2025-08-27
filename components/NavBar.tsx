
"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
const UserHero = dynamic(() => import("./UserHero"), { ssr: false });

export default function NavBar() {
  return (
    <nav className="flex items-center justify-between py-4">
      <div className="font-bold text-xl text-white">Close2Source</div>
      <div className="flex items-center gap-6">
        <ul className="flex gap-6 text-white font-medium">
          <li><Link href="/">Home</Link></li>
          <li><Link href="/projects">Projects</Link></li>
          <li><Link href="/individuals">Individuals</Link></li>
          <li><Link href="/about">About</Link></li>
          <li><Link href="/contact">Contact</Link></li>
        </ul>
        <div className="ml-6"><UserHero /></div>
      </div>
    </nav>
  );
}
