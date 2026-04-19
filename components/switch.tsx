import type { Signal } from "@preact/signals";
import { cn } from "@/lib/cn.ts";
import { useCardStyle } from "@/components/card.tsx";

export interface SwitchProps {
  checked: Signal<boolean>;
  label: string;
  sublabel?: string;
}

export function Switch({ checked, label, sublabel }: SwitchProps) {
  const style = useCardStyle();
  const toggle = () => (checked.value = !checked.value);
  const on = checked.value;
  return (
    <div
      role="switch"
      aria-checked={on ? "true" : "false"}
      tabindex={0}
      class="mb-4 p-4 border-2 border-ink bg-paper flex items-start gap-4 cursor-pointer select-none focus-visible:outline-3 focus-visible:outline-yellow"
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          toggle();
        }
      }}
    >
      <span
        class={cn(
          "relative w-16 h-8 flex-none border-2 border-ink shadow-sm transition-colors duration-150 ease-out mt-0.5",
          on ? style.switchOn : "bg-paper",
        )}
      >
        <span
          class={cn(
            "absolute top-0.5 grid place-items-center w-6 h-6 transition-all duration-200 ease-out",
            on ? "translate-x-7 bg-yellow" : "translate-x-0.5 bg-ink",
          )}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width={3}
            stroke-linecap="round"
            stroke-linejoin="round"
            class={cn(
              "text-ink transition-opacity duration-100",
              on ? "opacity-100" : "opacity-0",
            )}
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
      </span>
      <div class="text-sm leading-snug text-ink2 flex-1">
        {label}
        {sublabel && (
          <span class="block text-xs text-muted mt-1">{sublabel}</span>
        )}
      </div>
    </div>
  );
}
