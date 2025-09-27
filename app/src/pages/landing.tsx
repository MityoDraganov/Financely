'use client'

import { Navbar, Hero, HowItWorks, Features, Metrics, Pricing, FAQ, CTA, Footer } from "@/components/landing";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen font-inter text-gray-900 w-screen">
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
