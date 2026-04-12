export const PLAN = {
  name: "Pro Plan",
  priceId: import.meta.env.VITE_STRIPE_PRICE_ID || "price_1SrZmZKFYBp87OV7EqNtL0T0",
  price: "€5",
  period: "month",
  trialDays: 14,
  features: [
    "Unlimited invoices & proposals",
    "Custom templates & brand site",
    "Email automation",
    "Analytics dashboard",
    "AI-powered generation",
    "Priority support",
  ],
};
