import {
  cloneElement,
  type ComponentChildren,
  isValidElement,
  type JSX,
  type VNode,
} from "preact";
import { cn } from "@/lib/cn.ts";
import { useCardStyle } from "@/components/card.tsx";

type Variant = "primary" | "ghost";

type ButtonElProps = JSX.IntrinsicElements["button"];

export interface ButtonProps extends Omit<ButtonElProps, "size" | "icon"> {
  variant?: Variant;
  /** Optional leading icon node — rendered before children. */
  icon?: ComponentChildren;
  /**
   * If true, do not render a `<button>`; instead, merge the button's classes
   * onto the single child element. Use to style an `<a>` like a button:
   * `<Button asChild><a href="/foo">Open</a></Button>`.
   */
  asChild?: boolean;
}

const SHARED =
  "inline-flex items-center justify-center cursor-pointer border-2 border-ink shadow-sm font-bold transition-[transform,box-shadow,background] duration-100 active:translate-x-1 active:translate-y-1 active:shadow-none";
const PRIMARY_DISABLED =
  "disabled:bg-paper disabled:text-muted2 disabled:cursor-not-allowed disabled:shadow-none disabled:active:translate-x-0 disabled:active:translate-y-0";
const GHOST = "bg-paper text-ink hover:bg-yellow";

export function Button(
  {
    variant = "primary",
    icon,
    asChild,
    class: className,
    children,
    type = "button",
    ...rest
  }: ButtonProps,
) {
  const style = useCardStyle();
  const cls = cn(
    SHARED,
    variant === "primary"
      ? `${style.primaryButton} ${PRIMARY_DISABLED}`
      : GHOST,
    className,
  );

  if (asChild) {
    if (!isValidElement(children)) {
      throw new Error("<Button asChild> requires a single element child");
    }
    const child = children as VNode<{ class?: string }>;
    return cloneElement(child, { class: cn(cls, child.props.class) });
  }

  return (
    <button type={type} {...rest} class={cls}>
      {icon
        ? (
          <span class="inline-flex items-center justify-center gap-2">
            {icon}
            {children}
          </span>
        )
        : children}
    </button>
  );
}
