import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

type Props = {
  children: React.ReactNode;
};

export const AppShell: React.FC<Props> = ({ children }) => {
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <header className="border-b sticky top-0 z-30 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 select-none">
            <div className="size-6 rounded-sm bg-[#0566FF]" />
            <span className="text-base font-semibold tracking-tight">Financely</span>
          </Link>
          <nav className="hidden md:flex items-center gap-4">
            <Link to="/create-proposal" className="text-sm text-neutral-600 hover:text-neutral-900">Create Proposal</Link>
            <Link to="/proposals" className="text-sm text-neutral-600 hover:text-neutral-900">Proposals</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <a href="/create-proposal">New Proposal</a>
            </Button>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t mt-12">
        <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-neutral-500 flex items-center justify-between">
          <span>© {new Date().getFullYear()} Financely</span>
          <div className="flex items-center gap-4">
            <a className="hover:text-neutral-900" href="#">Privacy</a>
            <a className="hover:text-neutral-900" href="#">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AppShell;


