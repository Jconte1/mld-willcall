"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PhoneInputProps = Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type" | "inputMode"> & {
  value: string;
  onChange: (value: string) => void;
};

function formatPhone(digitsOnly: string) {
  const d = digitsOnly.replace(/\D/g, "").slice(0, 10);
  const a = d.slice(0, 3);
  const b = d.slice(3, 6);
  const c = d.slice(6, 10);

  if (d.length <= 3) return a ? `(${a}` : "";
  if (d.length <= 6) return `(${a}) ${b}`;
  return `(${a}) ${b}-${c}`;
}

/**
 * Controlled phone input.
 * - Stores digits-only in state/DB
 * - Displays a friendly (###) ###-#### mask
 */
export default function PhoneInput({ value, onChange, className, ...props }: PhoneInputProps) {
  const display = React.useMemo(() => formatPhone(value), [value]);

  return (
    <Input
      {...props}
      className={cn(className)}
      type="tel"
      inputMode="tel"
      placeholder={props.placeholder ?? "(555) 555-5555"}
      value={display}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
        onChange(digits);
      }}
    />
  );
}
