import type { ComponentChildren, JSX, Ref } from "preact";
import { cn } from "@/lib/cn.ts";
import { Eyebrow } from "@/components/eyebrow.tsx";

export interface DialogProps
  extends Omit<JSX.HTMLAttributes<HTMLDialogElement>, "onClick"> {
  dialogRef: Ref<HTMLDialogElement>;
  children?: ComponentChildren;
}

/**
 * Native `<dialog>` wrapper that closes when the backdrop is clicked.
 * Use `dialogRef.current?.showModal()` / `.close()` to control visibility.
 */
export function Dialog(
  { dialogRef, class: className, children, ...rest }: DialogProps,
) {
  return (
    <dialog
      ref={dialogRef}
      {...rest}
      class={cn(
        "p-0 m-auto border-2 border-ink shadow-xl backdrop:bg-ink/55",
        className,
      )}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          (e.currentTarget as HTMLDialogElement).close();
        }
      }}
    >
      {children}
    </dialog>
  );
}

export interface DialogHeadProps {
  eyebrow: ComponentChildren;
  title: ComponentChildren;
}

/** Black title bar shared by ChangesDialog and CompareDialog. */
export function DialogHead({ eyebrow, title }: DialogHeadProps) {
  return (
    <div class="bg-ink text-paper border-b-2 border-ink px-5 py-4 flex items-center justify-between">
      <div>
        <Eyebrow class="mb-1 block text-yellow">{eyebrow}</Eyebrow>
        <div class="font-display text-xl leading-none text-paper">{title}</div>
      </div>
      <form method="dialog">
        <button
          type="submit"
          class="w-8 h-8 grid place-items-center hover:bg-yellow hover:text-ink transition-colors"
          aria-label="Close"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width={2.5}
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </form>
    </div>
  );
}
