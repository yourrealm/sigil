import type { ComponentChildren } from "preact";
import { cn } from "@/lib/cn.ts";

type Variant = "plain" | "boxed";

export interface EyebrowProps {
  variant?: Variant;
  class?: string;
  children?: ComponentChildren;
}

export function Eyebrow(
  { variant = "plain", class: className, children }: EyebrowProps,
) {
  return (
    <span
      class={cn(
        "font-mono font-bold uppercase text-xs tracking-eyebrow",
        variant === "boxed" && "inline-block bg-ink text-paper px-2 py-0.5",
        className,
      )}
    >
      {children}
    </span>
  );
}
