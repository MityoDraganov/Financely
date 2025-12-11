import { EmailTemplateBlock, EmailSection, EmailSectionType } from "../entities/email-template";

export type RowLayoutVariant = 
  | "1col"
  | "2col-50-50"
  | "2col-33-67"
  | "2col-67-33"
  | "2col-60-40"
  | "3col";

export interface Pattern {
  id: string;
  label: string;
  description: string;
  icon?: string;
  allowedSectionKinds: EmailSection[];
  defaultSectionRole: EmailSectionType;
  defaultRows: PatternRow[];
  recommendedBlocks?: EmailTemplateBlock["type"][];
}

export interface PatternRow {
  layoutVariant: RowLayoutVariant;
  columns: PatternColumn[];
  gap?: "none" | "sm" | "md" | "lg";
  stackOnMobile?: boolean;
}

export interface PatternColumn {
  widthPercent: number;
  defaultBlocks: PatternBlock[];
}

export interface PatternBlock {
  type: EmailTemplateBlock["type"];
  defaults?: Partial<EmailTemplateBlock>;
}

// Pattern Catalog
export const emailPatterns: Pattern[] = [
  // Header Patterns
  {
    id: "brand-header",
    label: "Brand Header",
    description: "Logo with optional navigation",
    allowedSectionKinds: ["header"],
    defaultSectionRole: "brandHeader",
    defaultRows: [
      {
        layoutVariant: "1col",
        columns: [
          {
            widthPercent: 100,
            defaultBlocks: [
              { type: "logo", defaults: { align: "center" } },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "brand-nav-header",
    label: "Brand + Navigation",
    description: "Logo with navigation links",
    allowedSectionKinds: ["header"],
    defaultSectionRole: "navHeader",
    defaultRows: [
      {
        layoutVariant: "1col",
        columns: [
          {
            widthPercent: 100,
            defaultBlocks: [
              { type: "logo", defaults: { align: "center" } },
            ],
          },
        ],
      },
      {
        layoutVariant: "1col",
        columns: [
          {
            widthPercent: 100,
            defaultBlocks: [
              { type: "navigation", defaults: { align: "center" } },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "announcement-header",
    label: "Announcement Bar",
    description: "Promotional banner or announcement",
    allowedSectionKinds: ["header"],
    defaultSectionRole: "announcementHeader",
    defaultRows: [
      {
        layoutVariant: "1col",
        columns: [
          {
            widthPercent: 100,
            defaultBlocks: [
              { 
                type: "text", 
                defaults: { 
                  content: "Special offer: 20% off this month!",
                  align: "center",
                  emphasize: true,
                } 
              },
            ],
          },
        ],
      },
    ],
  },
  
  // Body Patterns
  {
    id: "hero-centered",
    label: "Hero - Centered",
    description: "Centered hero section with heading and CTA",
    allowedSectionKinds: ["body"],
    defaultSectionRole: "hero",
    defaultRows: [
      {
        layoutVariant: "1col",
        columns: [
          {
            widthPercent: 100,
            defaultBlocks: [
              { 
                type: "text", 
                defaults: { 
                  content: "Welcome!",
                  align: "center",
                  emphasize: true,
                } 
              },
              { 
                type: "text", 
                defaults: { 
                  content: "This is your hero message. Make it compelling!",
                  align: "center",
                } 
              },
              { 
                type: "button", 
                defaults: { 
                  label: "Get Started",
                  url: "https://example.com",
                  align: "center",
                } 
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "hero-image-right",
    label: "Hero - Image Right",
    description: "Hero with content on left, image on right",
    allowedSectionKinds: ["body"],
    defaultSectionRole: "hero",
    defaultRows: [
      {
        layoutVariant: "2col-60-40",
        columns: [
          {
            widthPercent: 60,
            defaultBlocks: [
              { 
                type: "text", 
                defaults: { 
                  content: "Your Heading",
                  align: "left",
                  emphasize: true,
                } 
              },
              { 
                type: "text", 
                defaults: { 
                  content: "Your compelling message here.",
                  align: "left",
                } 
              },
              { 
                type: "button", 
                defaults: { 
                  label: "Learn More",
                  url: "https://example.com",
                  align: "left",
                } 
              },
            ],
          },
          {
            widthPercent: 40,
            defaultBlocks: [
              { 
                type: "image", 
                defaults: { 
                  align: "center",
                } 
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "invoice-summary",
    label: "Invoice Summary",
    description: "Invoice details card",
    allowedSectionKinds: ["body"],
    defaultSectionRole: "summary",
    defaultRows: [
      {
        layoutVariant: "1col",
        columns: [
          {
            widthPercent: 100,
            defaultBlocks: [
              { 
                type: "text", 
                defaults: { 
                  content: "Invoice Summary",
                  align: "center",
                  emphasize: true,
                } 
              },
              { 
                type: "divider", 
                defaults: { 
                  align: "center",
                } 
              },
              { 
                type: "text", 
                defaults: { 
                  content: "Invoice #{{invoice.number}}\nAmount: {{invoice.total}}\nDue: {{invoice.dueDate}}",
                  align: "left",
                } 
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "two-column-content",
    label: "Two Column Content",
    description: "Side-by-side content blocks",
    allowedSectionKinds: ["body"],
    defaultSectionRole: "content",
    defaultRows: [
      {
        layoutVariant: "2col-50-50",
        columns: [
          {
            widthPercent: 50,
            defaultBlocks: [
              { 
                type: "text", 
                defaults: { 
                  content: "Left Column",
                  align: "left",
                } 
              },
            ],
          },
          {
            widthPercent: 50,
            defaultBlocks: [
              { 
                type: "text", 
                defaults: { 
                  content: "Right Column",
                  align: "left",
                } 
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "three-features",
    label: "Three Features",
    description: "Three-column feature grid",
    allowedSectionKinds: ["body"],
    defaultSectionRole: "featureGrid",
    defaultRows: [
      {
        layoutVariant: "3col",
        columns: [
          {
            widthPercent: 33.33,
            defaultBlocks: [
              { 
                type: "text", 
                defaults: { 
                  content: "Feature 1",
                  align: "center",
                  emphasize: true,
                } 
              },
              { 
                type: "text", 
                defaults: { 
                  content: "Feature description",
                  align: "center",
                } 
              },
            ],
          },
          {
            widthPercent: 33.33,
            defaultBlocks: [
              { 
                type: "text", 
                defaults: { 
                  content: "Feature 2",
                  align: "center",
                  emphasize: true,
                } 
              },
              { 
                type: "text", 
                defaults: { 
                  content: "Feature description",
                  align: "center",
                } 
              },
            ],
          },
          {
            widthPercent: 33.33,
            defaultBlocks: [
              { 
                type: "text", 
                defaults: { 
                  content: "Feature 3",
                  align: "center",
                  emphasize: true,
                } 
              },
              { 
                type: "text", 
                defaults: { 
                  content: "Feature description",
                  align: "center",
                } 
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "cta-block",
    label: "Call to Action",
    description: "Strong CTA with heading and button",
    allowedSectionKinds: ["body"],
    defaultSectionRole: "cta",
    defaultRows: [
      {
        layoutVariant: "1col",
        columns: [
          {
            widthPercent: 100,
            defaultBlocks: [
              { 
                type: "text", 
                defaults: { 
                  content: "Ready to get started?",
                  align: "center",
                  emphasize: true,
                } 
              },
              { 
                type: "text", 
                defaults: { 
                  content: "Take action now!",
                  align: "center",
                } 
              },
              { 
                type: "button", 
                defaults: { 
                  label: "Get Started",
                  url: "https://example.com",
                  align: "center",
                } 
              },
            ],
          },
        ],
      },
    ],
  },
  
  // Footer Patterns
  {
    id: "classic-footer",
    label: "Classic Footer",
    description: "Full footer with contact, social, and legal links",
    allowedSectionKinds: ["footer"],
    defaultSectionRole: "brandFooter",
    defaultRows: [
      {
        layoutVariant: "1col",
        columns: [
          {
            widthPercent: 100,
            defaultBlocks: [
              { type: "footerText", defaults: { content: "Company Name", align: "center" } },
            ],
          },
        ],
      },
      {
        layoutVariant: "1col",
        columns: [
          {
            widthPercent: 100,
            defaultBlocks: [
              { type: "socialLinks", defaults: { align: "center" } },
            ],
          },
        ],
      },
      {
        layoutVariant: "1col",
        columns: [
          {
            widthPercent: 100,
            defaultBlocks: [
              { type: "unsubscribe", defaults: { align: "center" } },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "minimal-footer",
    label: "Minimal Footer",
    description: "Simple footer with unsubscribe",
    allowedSectionKinds: ["footer"],
    defaultSectionRole: "contactsFooter",
    defaultRows: [
      {
        layoutVariant: "1col",
        columns: [
          {
            widthPercent: 100,
            defaultBlocks: [
              { type: "footerText", defaults: { content: "© 2024 Company", align: "center" } },
              { type: "unsubscribe", defaults: { align: "center" } },
            ],
          },
        ],
      },
    ],
  },
];

// Helper function to convert pattern to blocks
export function patternToBlocks(
  pattern: Pattern,
  section: EmailSection,
  createBlockFn: (type: EmailTemplateBlock["type"], section: EmailSection) => EmailTemplateBlock
): EmailTemplateBlock[] {
  const blocks: EmailTemplateBlock[] = [];
  
  for (const row of pattern.defaultRows) {
    for (const column of row.columns) {
      for (const patternBlock of column.defaultBlocks) {
        const block = createBlockFn(patternBlock.type, section);
        
        // Apply defaults
        if (patternBlock.defaults) {
          Object.assign(block, patternBlock.defaults);
        }
        
        blocks.push(block);
      }
    }
  }
  
  return blocks;
}

// Helper to get patterns for a section
export function getPatternsForSection(section: EmailSection): Pattern[] {
  return emailPatterns.filter(p => p.allowedSectionKinds.includes(section));
}

// Helper to get pattern by ID
export function getPatternById(id: string): Pattern | undefined {
  return emailPatterns.find(p => p.id === id);
}

