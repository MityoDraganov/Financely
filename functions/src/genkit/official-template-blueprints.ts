import {
  officialTemplateBlueprintSchema,
  type OfficialTemplateBlueprint,
} from "./schemas";

const BLUEPRINTS: OfficialTemplateBlueprint[] = [
  {
    id: "official-eu-invoice-service-professional-en",
    type: "invoice",
    language: "en",
    region: "EU",
    archetype: "service",
    title: "Official EU Service Invoice (EN)",
    shortDescription: "Professional EU invoice for services and consulting.",
    description:
      "A clean EU-compliant invoice template for agencies, freelancers, and consulting teams. Includes VAT-friendly totals and service-focused layout.",
    category: "Invoicing",
    tags: ["official", "invoice", "eu", "service", "professional", "english"],
    country: "EU",
    style: "professional",
  },
  {
    id: "official-eu-invoice-service-professional-bg",
    type: "invoice",
    language: "bg",
    region: "EU",
    archetype: "service",
    title: "Официална EU Фактура за Услуги (BG)",
    shortDescription: "Професионална EU фактура за услуги и консултации.",
    description:
      "Изчистен шаблон за EU-съвместима фактура за агенции, фрийлансъри и консултантски екипи. Включва VAT-ориентирани тотали и структура за услуги.",
    category: "Invoicing",
    tags: ["official", "invoice", "eu", "service", "professional", "bulgarian"],
    country: "EU",
    style: "professional",
  },
  {
    id: "official-eu-invoice-product-minimal-en",
    type: "invoice",
    language: "en",
    region: "EU",
    archetype: "product",
    title: "Official EU Product Invoice (EN)",
    shortDescription: "Minimal EU invoice optimized for product sales.",
    description:
      "A minimal EU-compliant invoice template designed for product-focused organizations. Optimized line-item table and tax-ready totals.",
    category: "Invoicing",
    tags: ["official", "invoice", "eu", "product", "minimal", "english"],
    country: "EU",
    style: "minimal",
  },
  {
    id: "official-eu-invoice-product-minimal-bg",
    type: "invoice",
    language: "bg",
    region: "EU",
    archetype: "product",
    title: "Официална EU Фактура за Продажби (BG)",
    shortDescription: "Минимална EU фактура, оптимизирана за продажби.",
    description:
      "Минималистичен EU-съвместим шаблон за фактура, създаден за продуктови компании. Оптимизирана таблица с артикули и данъчни тотали.",
    category: "Invoicing",
    tags: ["official", "invoice", "eu", "product", "minimal", "bulgarian"],
    country: "EU",
    style: "minimal",
  },
  {
    id: "official-eu-invoice-subscription-modern-en",
    type: "invoice",
    language: "en",
    region: "EU",
    archetype: "subscription",
    title: "Official EU Subscription Invoice (EN)",
    shortDescription: "Modern EU invoice for recurring and subscription billing.",
    description:
      "A modern EU-compliant invoice template for SaaS and recurring billing organizations. Built for recurring periods, clear due dates, and tax clarity.",
    category: "Invoicing",
    tags: ["official", "invoice", "eu", "subscription", "modern", "english"],
    country: "EU",
    style: "modern",
  },
  {
    id: "official-eu-invoice-subscription-modern-bg",
    type: "invoice",
    language: "bg",
    region: "EU",
    archetype: "subscription",
    title: "Официална EU Фактура за Абонаменти (BG)",
    shortDescription: "Модерна EU фактура за периодично и абонаментно фактуриране.",
    description:
      "Модерен EU-съвместим шаблон за фактура за SaaS и абонаментни бизнеси. Подходящ за периоди, ясни падежи и данъчна прозрачност.",
    category: "Invoicing",
    tags: ["official", "invoice", "eu", "subscription", "modern", "bulgarian"],
    country: "EU",
    style: "modern",
  },
  {
    id: "official-eu-email-invoice-sent-en",
    type: "email",
    language: "en",
    region: "EU",
    archetype: "invoice_sent",
    title: "Official EU Invoice Sent Email (EN)",
    shortDescription: "Transactional email for sending a newly issued invoice.",
    description:
      "A clear and professional transactional email template for sending newly issued invoices with links and due date context.",
    category: "Email",
    tags: ["official", "email", "eu", "invoice", "transactional", "english"],
    country: "EU",
    style: "transactional",
  },
  {
    id: "official-eu-email-invoice-sent-bg",
    type: "email",
    language: "bg",
    region: "EU",
    archetype: "invoice_sent",
    title: "Официален Имейл: Изпратена Фактура (BG)",
    shortDescription: "Транзакционен имейл за изпращане на новоиздадена фактура.",
    description:
      "Ясен и професионален транзакционен имейл шаблон за изпращане на новоиздадени фактури с линкове и информация за падеж.",
    category: "Email",
    tags: ["official", "email", "eu", "invoice", "transactional", "bulgarian"],
    country: "EU",
    style: "transactional",
  },
  {
    id: "official-eu-email-payment-reminder-en",
    type: "email",
    language: "en",
    region: "EU",
    archetype: "payment_reminder",
    title: "Official EU Payment Reminder Email (EN)",
    shortDescription: "Friendly reminder email for upcoming or missed invoice due dates.",
    description:
      "A polite payment reminder email template for invoice follow-ups. Designed to improve collection rates while preserving customer tone.",
    category: "Email",
    tags: ["official", "email", "eu", "reminder", "invoice", "english"],
    country: "EU",
    style: "professional",
  },
  {
    id: "official-eu-email-payment-reminder-bg",
    type: "email",
    language: "bg",
    region: "EU",
    archetype: "payment_reminder",
    title: "Официален Имейл: Напомняне за Плащане (BG)",
    shortDescription: "Учтив имейл за напомняне при предстоящ или просрочен падеж.",
    description:
      "Учтив шаблон за имейл напомняне при проследяване на фактури. Създаден за по-добра събираемост без агресивен тон.",
    category: "Email",
    tags: ["official", "email", "eu", "reminder", "invoice", "bulgarian"],
    country: "EU",
    style: "professional",
  },
  {
    id: "official-eu-email-overdue-final-en",
    type: "email",
    language: "en",
    region: "EU",
    archetype: "overdue_final",
    title: "Official EU Final Overdue Email (EN)",
    shortDescription: "Final overdue notice template with firm but professional tone.",
    description:
      "A final overdue notice email template with clear next steps and payment request. Balanced to stay professional and actionable.",
    category: "Email",
    tags: ["official", "email", "eu", "overdue", "final", "english"],
    country: "EU",
    style: "professional",
  },
  {
    id: "official-eu-email-overdue-final-bg",
    type: "email",
    language: "bg",
    region: "EU",
    archetype: "overdue_final",
    title: "Официален Имейл: Финално Просрочие (BG)",
    shortDescription: "Финално известие за просрочие с твърд, но професионален тон.",
    description:
      "Шаблон за финално известие при просрочие с ясни следващи стъпки и искане за плащане. Балансиран и професионален стил.",
    category: "Email",
    tags: ["official", "email", "eu", "overdue", "final", "bulgarian"],
    country: "EU",
    style: "professional",
  },
];

export const OFFICIAL_TEMPLATE_BLUEPRINTS: OfficialTemplateBlueprint[] = BLUEPRINTS.map((blueprint) =>
  officialTemplateBlueprintSchema.parse(blueprint),
);

const blueprintById = new Map(OFFICIAL_TEMPLATE_BLUEPRINTS.map((blueprint) => [blueprint.id, blueprint]));

export function getOfficialTemplateBlueprints(ids?: string[]): OfficialTemplateBlueprint[] {
  if (!ids || ids.length === 0) {
    return [...OFFICIAL_TEMPLATE_BLUEPRINTS];
  }

  const selected: OfficialTemplateBlueprint[] = [];
  ids.forEach((id) => {
    const blueprint = blueprintById.get(id);
    if (blueprint) {
      selected.push(blueprint);
    }
  });
  return selected;
}
