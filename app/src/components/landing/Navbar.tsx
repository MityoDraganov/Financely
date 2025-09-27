import * as React from "react";
import { Button } from "@/components/ui/button";

export function Navbar(): React.ReactElement {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <a href="#" className="text-2xl font-extrabold tracking-tight text-[#166534]">Financely</a>
        <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
          <a href="#features" className="text-gray-700 hover:text-[#166534] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#166534] focus-visible:rounded">Features</a>
          <a href="#how-it-works" className="text-gray-700 hover:text-[#166534] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#166534] focus-visible:rounded">How It Works</a>
          <a href="#pricing" className="text-gray-700 hover:text-[#166534] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#166534] focus-visible:rounded">Pricing</a>
          <a href="#faq" className="text-gray-700 hover:text-[#166534] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#166534] focus-visible:rounded">FAQ</a>
        </nav>
        <Button className="rounded-xl bg-[#166534] px-5 text-white shadow-sm transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#166534]">
          Get Started
        </Button>
      </div>
    </header>
  );
}


