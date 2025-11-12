'use client'

import { Hero, HowItWorks, Features, Metrics, Pricing, FAQ, CTA, Footer, Navbar } from "@/components/landing";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen font-inter text-gray-900 dark:text-gray-100 bg-white dark:bg-[#0f1115] w-screen">
      <Navbar />
      <Hero />
      <HowItWorks />
      <Features />
      <Metrics />
      <Pricing />
      <FAQ />
      <CTA />
      <Footer />
    </div>
  );
}
