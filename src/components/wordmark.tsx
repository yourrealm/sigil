import type { ComponentChildren } from "preact";
import { PiSignatureDuotone } from "@preact-icons/pi";
import { cn } from "@/lib/cn.ts";

export interface WordmarkProps {
  href?: string;
  /** Optional tagline shown after the tilted slash. Hidden below `sm`. */
  tagline?: ComponentChildren;
  class?: string;
  children?: ComponentChildren;
}

export function Wordmark(
  { href, tagline, class: className, children = "Sigil" }: WordmarkProps,
) {
  const cls = cn(
    "font-display uppercase text-3xl tracking-tight text-ink leading-none inline-flex items-center gap-2",
    className,
  );
  const inner = (
    <>
      <PiSignatureDuotone aria-hidden="true" class="text-[1.1em]" />
      <span>{children}</span>
      {tagline && (
        <>
          <span
            class="hidden sm:inline-block w-[3px] h-5 bg-ink mx-2.5 rotate-[18deg] align-middle"
            aria-hidden="true"
          >
          </span>
          <span class="hidden sm:inline font-mono font-bold uppercase text-xs tracking-eyebrow text-ink">
            {tagline}
          </span>
        </>
      )}
    </>
  );
  return href
    ? <a href={href} class={cls}>{inner}</a>
    : <span class={cls}>{inner}</span>;
}
