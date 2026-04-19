import type { ComponentChildren } from "preact";
import { cn } from "@/lib/cn.ts";

export interface BannerProps {
  icon?: ComponentChildren;
  /** Bold leading line (e.g. red warning kicker). */
  kicker?: ComponentChildren;
  /** Text color class for the kicker. Defaults to text-warn. */
  kickerColor?: string;
  children?: ComponentChildren;
  /** Footer line under the body (links, version chips, etc.). */
  footer?: ComponentChildren;
}

export function Banner(
  { icon, kicker, kickerColor = "text-warn", children, footer }: BannerProps,
) {
  return (
    <div class="bg-yellow text-ink border-2 border-ink shadow-sm px-4 py-3 mb-4 flex gap-3 items-start">
      {icon && (
        <div class={cn("text-xl mt-0.5 flex-none", kickerColor)}>{icon}</div>
      )}
      <div class="text-sm leading-snug">
        {kicker && (
          <div class={cn("font-medium mb-0.5", kickerColor)}>{kicker}</div>
        )}
        {children}
        {footer && (
          <div class="mt-2 flex items-center gap-3 text-xs opacity-80">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
