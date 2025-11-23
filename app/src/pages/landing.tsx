'use client'

import { 
  Hero, 
  HowItWorks, 
  Features, 
  Metrics, 
  FAQ, 
  CTA, 
  Footer, 
  Navbar,
  TrustSignals,
  ProblemSolution,
  Testimonials,
  ProductDemo
} from "@/components/landing";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen font-inter text-gray-900 dark:text-gray-100 bg-white dark:bg-[#0f1115] w-screen overflow-x-hidden">
      <Navbar />
      <Hero />
      <TrustSignals />
      <ProblemSolution />
      <HowItWorks />
      <Features />
      <ProductDemo />
      <Testimonials />
      <Metrics /> 
      <FAQ />
      <CTA />
      <Footer />
    </div>
  );
}
