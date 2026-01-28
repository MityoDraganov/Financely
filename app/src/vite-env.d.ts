/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STRIPE_PRICE_ID?: string;
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.gif" {
  const src: string;
  export default src;
}

// Stripe web components
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'stripe-pricing-table': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          'pricing-table-id'?: string;
          'publishable-key'?: string;
        },
        HTMLElement
      >;
      'stripe-buy-button': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          'buy-button-id'?: string;
          'publishable-key'?: string;
        },
        HTMLElement
      >;
    }
  }
}
