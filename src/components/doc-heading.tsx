import type { ComponentChildren } from "preact";
import { cn } from "@/lib/cn.ts";

export interface DocHeadingProps {
  /** The accent word, rendered with the yellow rotated em treatment. */
  accent?: ComponentChildren;
  /** Optional smaller subheading rendered below. */
  sub?: ComponentChildren;
  /** Override font size — e.g. "text-6xl" for the error view. */
  size?: string;
  children?: ComponentChildren;
}

export function DocHeading(
  { accent, sub, size = "text-7xl", children }: DocHeadingProps,
) {
  return (
    <h1
      class={cn(
        "font-display uppercase tracking-tighter text-ink leading-[0.95]",
        size,
      )}
    >
      {accent && (
        <em class="not-italic inline-block bg-yellow border-2 border-ink shadow-sm -rotate-2 px-1.5">
          {accent}
        </em>
      )}
      {children}
      {sub && (
        <>
          <br />
          <span class="inline-block text-5xl leading-[0.95] mt-1">{sub}</span>
        </>
      )}
    </h1>
  );
}
