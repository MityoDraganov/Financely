import * as React from "react";

import { cn } from "@/lib/utils";

type InputProps = React.ComponentProps<"input"> & {
  allowEmptyNumber?: boolean;
};

function Input({
  className,
  type,
  value,
  onChange,
  onFocus,
  onBlur,
  allowEmptyNumber = false,
  ...props
}: InputProps) {
  const isControlled = value !== undefined;
  const isControlledNumber = type === "number" && isControlled;
  const [draft, setDraft] = React.useState(value == null ? "" : String(value));
  const [isFocused, setIsFocused] = React.useState(false);

  React.useEffect(() => {
    if (!isControlledNumber || isFocused) return;
    setDraft(value == null ? "" : String(value));
  }, [isControlledNumber, isFocused, value]);

  if (!isControlledNumber) {
    return (
      <input
        type={type}
        data-slot="input"
        className={cn(
          "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground bg-background border-border text-foreground flex h-9 w-full min-w-0 rounded-sm border px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "focus-visible:border-primary focus-visible:ring-primary/50 focus-visible:ring-[3px]",
          "aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
          className,
        )}
        value={value}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        {...props}
      />
    );
  }

  return (
    <input
      type="number"
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground bg-background border-border text-foreground flex h-9 w-full min-w-0 rounded-sm border px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-primary focus-visible:ring-primary/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
        className,
      )}
      value={isFocused ? draft : value}
      onFocus={(event) => {
        setIsFocused(true);
        onFocus?.(event);
      }}
      onChange={(event) => {
        const nextRaw = event.target.value;
        setDraft(nextRaw);

        if (nextRaw.trim() === "") {
          if (allowEmptyNumber) {
            onChange?.(event);
          }
          return;
        }

        const parsed = Number(nextRaw);
        if (!Number.isFinite(parsed)) return;

        onChange?.(event);
      }}
      onBlur={(event) => {
        setIsFocused(false);

        const trimmed = event.target.value.trim();
        if (trimmed === "") {
          if (!allowEmptyNumber) {
            setDraft(value == null ? "" : String(value));
          }
          onBlur?.(event);
          return;
        }

        const parsed = Number(trimmed);
        if (!Number.isFinite(parsed)) {
          setDraft(value == null ? "" : String(value));
        }

        onBlur?.(event);
      }}
      {...props}
    />
  );
}

export { Input };
