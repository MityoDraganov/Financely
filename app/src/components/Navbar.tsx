import * as React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { SignedIn, SignedOut } from "@clerk/clerk-react";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { LanguageSelector } from "@/components/language-selector";

export function Navbar(): React.ReactElement {
  const { t } = useTranslation();  
  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-[#1b1e24]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <img 
            src={"/financely-logo.svg"} 
            alt="Logo" 
            className=""
          />
        </div>
        <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
          <a href="#features" className="text-gray-700 dark:text-gray-300 hover:text-[#166534] dark:hover:text-[#22c55e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#166534] dark:focus-visible:ring-[#22c55e] focus-visible:rounded transition-colors">{t('landing.navbar.features')}</a>
          <a href="#how-it-works" className="text-gray-700 dark:text-gray-300 hover:text-[#166534] dark:hover:text-[#22c55e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#166534] dark:focus-visible:ring-[#22c55e] focus-visible:rounded transition-colors">{t('landing.navbar.howItWorks')}</a>
          <a href="#pricing" className="text-gray-700 dark:text-gray-300 hover:text-[#166534] dark:hover:text-[#22c55e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#166534] dark:focus-visible:ring-[#22c55e] focus-visible:rounded transition-colors">{t('landing.navbar.pricing')}</a>
          <a href="#faq" className="text-gray-700 dark:text-gray-300 hover:text-[#166534] dark:hover:text-[#22c55e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#166534] dark:focus-visible:ring-[#22c55e] focus-visible:rounded transition-colors">{t('landing.navbar.faq')}</a>
        </nav>
        <div className="flex items-center gap-2">
          <LanguageSelector />
          <ModeToggle />
          <SignedOut>
          <Button asChild className="rounded-xl px-5 bg-white dark:bg-[#2a2d35] text-[#166534] dark:text-gray-100 border border-gray-200 dark:border-gray-700 shadow-sm dark:shadow-[0px_4px_4px_#00000030] transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#166534] dark:focus-visible:ring-[#22c55e]">
            <Link to="/sign-in">{t('landing.navbar.signIn')}</Link>
          </Button>
          <Button asChild className="rounded-xl bg-[#166534] dark:bg-[#22c55e] px-5 text-white dark:text-[#0f1115] shadow-sm dark:shadow-[0px_4px_4px_#00000030] transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#166534] dark:focus-visible:ring-[#22c55e]">
            <Link to="/sign-up">{t('landing.navbar.getStarted')}</Link>
          </Button>
          </SignedOut>
          <SignedIn>
            <Button asChild className="rounded-xl bg-[#166534] dark:bg-[#22c55e] px-5 text-white dark:text-[#0f1115] shadow-sm dark:shadow-[0px_4px_4px_#00000030] transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#166534] dark:focus-visible:ring-[#22c55e]">
              <Link to="/dashboard">{t('landing.navbar.dashboard')}</Link>
            </Button>
          </SignedIn>
        </div>
      </div>
    </header>
  );
}


