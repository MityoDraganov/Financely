/// <reference types="vite/client" />

declare module "*.gif" {
  const src: string;
  export default src;
}

// Stripe Pricing Table web component
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
    }
  }
}
