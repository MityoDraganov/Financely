import * as React from "react";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  Shield, 
  CheckCircle2, 
  Download, 
  FileText, 
  Lock,
  Users,
  Zap,
  Building2,
  XCircle,
  CreditCard,
} from "lucide-react";

interface PricingSectionProps {
  stripePricingTableId?: string;
  stripePublishableKey?: string;
}

export function PricingSection({ 
  stripePricingTableId,
  stripePublishableKey 
}: PricingSectionProps): React.ReactElement {
  // Load Stripe Pricing Table script
  useEffect(() => {
    if (!stripePricingTableId) return;

    // Check if script is already loaded
    if (document.querySelector('script[src="https://js.stripe.com/v3/pricing-table.js"]')) {
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/pricing-table.js';
    script.async = true;
    script.onerror = () => {
      console.error('Failed to load Stripe Pricing Table script');
    };
    document.body.appendChild(script);

    return () => {
      // Note: We don't remove the script on unmount as it may be used elsewhere
      // The script is lightweight and can remain in the DOM
    };
  }, [stripePricingTableId]);
  // Plan fit personas
  const personas = [
    {
      title: "Solo / Early Stage",
      description: "Get organized and professional without complexity",
      icon: Users,
    },
    {
      title: "Small Team",
      description: "Operational clarity and team collaboration",
      icon: Building2,
    },
    {
      title: "Scale & Automate",
      description: "Advanced workflows and enterprise control",
      icon: Zap,
    },
  ];

  // Risk reversal items
  const riskReversalItems = [
    {
      icon: XCircle,
      text: "Cancel anytime",
    },
    {
      icon: Lock,
      text: "Secure checkout by Stripe",
    },
    {
      icon: Download,
      text: "Export your data anytime",
    },
    {
      icon: FileText,
      text: "VAT invoices available",
    },
    {
      icon: CheckCircle2,
      text: "No long-term contracts",
    },
  ];

  // FAQ items focused on objections
  const faqItems = [
    {
      question: "Can I cancel or downgrade my plan?",
      answer: "Yes, you can cancel or change your plan at any time. Changes take effect at the end of your current billing period. No penalties or fees.",
    },
    {
      question: "What happens if I need to change billing?",
      answer: "You can upgrade, downgrade, or cancel from your account settings. Billing changes are prorated automatically. We'll send you a confirmation email.",
    },
    {
      question: "Who owns my data?",
      answer: "You own all your data. You can export everything at any time in standard formats. We never lock you in or hold your data hostage.",
    },
    {
      question: "Is my payment information secure?",
      answer: "Yes. Payments are processed securely by Stripe, a PCI-DSS Level 1 certified payment processor. We never see or store your full card details.",
    },
    {
      question: "What if my team grows?",
      answer: "You can upgrade your plan anytime. All your existing data and settings migrate automatically. No downtime, no data loss.",
    },
    {
      question: "What kind of support can I expect?",
      answer: "All plans include email support with response times based on your tier. Priority support is available on Pro and Enterprise plans.",
    },
  ];

  return (
    <section id="pricing" className="bg-white dark:bg-[#0f1115] py-24">
      <div className="mx-auto max-w-7xl px-6">
        {/* 4.1 Pricing Section Header (Decision Framing) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <h2 className="mb-4 text-4xl font-bold text-gray-900 dark:text-gray-100">
            Simple, transparent pricing
          </h2>
          <p className="mb-6 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Choose the plan that fits your needs. Cancel anytime, no contracts.
          </p>
          
          {/* Value bullets */}
          <div className="mb-8 flex flex-wrap items-center justify-center gap-6 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#166534] dark:text-[#22c55e]" />
              <span>Automate your finance workflows</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#166534] dark:text-[#22c55e]" />
              <span>Stay compliant with regulations</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#166534] dark:text-[#22c55e]" />
              <span>Scale as you grow</span>
            </div>
          </div>

          {/* Trust micro-badges */}
          <div className="flex flex-wrap items-center justify-center gap-4 opacity-70">
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500">
              <Shield className="h-4 w-4" />
              <span>Stripe secured</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500">
              <Lock className="h-4 w-4" />
              <span>GDPR compliant</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500">
              <CreditCard className="h-4 w-4" />
              <span>PCI-DSS Level 1</span>
            </div>
          </div>
        </motion.div>

        {/* 4.2 Billing Context Row (Pre-Anchor) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
        >
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span>Billed monthly or yearly</span>
          </div>
          <div className="hidden sm:block h-4 w-px bg-gray-300 dark:bg-gray-700" />
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span className="font-medium text-gray-900 dark:text-gray-100">Most teams choose Pro</span>
          </div>
        </motion.div>

        {/* 4.3 "Who Is This For?" Plan Fit Guide */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <h3 className="mb-6 text-center text-lg font-semibold text-gray-900 dark:text-gray-100">
            Who is this for?
          </h3>
          <div className="grid gap-4 md:grid-cols-3">
            {personas.map((persona, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="h-full border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1b1e24] shadow-sm dark:shadow-[0px_4px_4px_#00000030] transition-shadow hover:shadow-md dark:hover:shadow-[0px_4px_4px_#00000030,0px_12px_12px_#00000015]">
                  <CardContent className="p-6">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="rounded-lg bg-[#166534]/10 dark:bg-[#22c55e]/10 p-2">
                        <persona.icon className="h-5 w-5 text-[#166534] dark:text-[#22c55e]" />
                      </div>
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                        {persona.title}
                      </h4>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {persona.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* 4.4 Stripe Pricing Table Container (Centerpiece) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-[#1b1e24]/50 p-8 shadow-sm dark:shadow-[0px_4px_4px_#00000030]">
            {stripePricingTableId ? (
              <div className="stripe-pricing-table-wrapper">
                {/* Stripe Pricing Table embed */}
                {React.createElement('stripe-pricing-table', {
                  'pricing-table-id': stripePricingTableId,
                  'publishable-key': stripePublishableKey || '',
                })}
              </div>
            ) : (
              <div className="py-12 text-center">
                <p className="text-gray-600 dark:text-gray-400">
                  Stripe Pricing Table will appear here
                </p>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">
                  Configure your Stripe Pricing Table ID to display pricing
                </p>
              </div>
            )}
          </div>
        </motion.div>

        {/* 4.5 Post-Pricing Risk Reversal Strip */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1b1e24] p-6 shadow-sm dark:shadow-[0px_4px_4px_#00000030]">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-5">
              {riskReversalItems.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300"
                >
                  <item.icon className="h-5 w-5 shrink-0 text-[#166534] dark:text-[#22c55e]" />
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* 4.6 Objection-Handling FAQ (Accordion) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <h3 className="mb-8 text-center text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Common questions
          </h3>
          <div className="mx-auto max-w-3xl">
            <Accordion type="single" collapsible className="w-full">
              {faqItems.map((item, i) => (
                <AccordionItem key={i} value={`item-${i}`}>
                  <AccordionTrigger className="text-left text-base font-medium text-gray-900 dark:text-gray-100">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-700 dark:text-gray-300">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </motion.div>

        {/* 4.7 Social Proof / Validation (Optional but Strong) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <p className="mb-4 text-sm font-medium text-gray-900 dark:text-gray-100">
            Trusted by finance teams worldwide
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 opacity-60">
            <Badge variant="outline" className="border-gray-300 dark:border-gray-700">
              SOC 2 Compliant
            </Badge>
            <Badge variant="outline" className="border-gray-300 dark:border-gray-700">
              GDPR Ready
            </Badge>
            <Badge variant="outline" className="border-gray-300 dark:border-gray-700">
              ISO 27001
            </Badge>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
