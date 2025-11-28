'use client'

import { 
  Hero, 
  HowItWorks, 
  Features, 
  FAQ, 
  CTA, 
  Navbar,
  ProblemSolution,
  ProductDemo
} from "@/components/landing";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen font-inter text-gray-900 dark:text-gray-100 bg-white dark:bg-[#0f1115] w-screen overflow-x-hidden">
      <Navbar />
      <Hero />
      <ProblemSolution />
      <HowItWorks />
      <Features />
      <ProductDemo />
      <FAQ />
      <CTA />
    </div>
  );
}
