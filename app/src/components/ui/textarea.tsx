import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const textareaVariants = cva(
  "border-neutral-200 placeholder:text-neutral-500 focus-visible:border-neutral-950 focus-visible:ring-neutral-950/50 aria-invalid:ring-red-500/20 dark:aria-invalid:ring-red-500/40 aria-invalid:border-red-500 dark:bg-neutral-200/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:border-neutral-800 dark:placeholder:text-neutral-400 dark:focus-visible:border-neutral-300 dark:focus-visible:ring-neutral-300/50 dark:aria-invalid:ring-red-900/20 dark:dark:aria-invalid:ring-red-900/40 dark:aria-invalid:border-red-900 dark:dark:bg-neutral-800/30",
  {
    variants: {
      variant: {
        default: "",
        input: "h-9 min-h-9 items-center border-border rounded-sm focus-visible:border-primary focus-visible:ring-primary/50",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface TextareaProps
  extends React.ComponentProps<"textarea">,
    VariantProps<typeof textareaVariants> {}

function Textarea({ className, variant, ...props }: TextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(textareaVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Textarea, textareaVariants };
