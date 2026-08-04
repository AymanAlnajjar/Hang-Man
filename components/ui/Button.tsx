"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant =
  | "primary"
  | "secondary"
  | "coral"
  | "yellow"
  | "success"
  | "danger"
  | "ghost";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
  block?: boolean;
};

const VARIANT: Record<Variant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  coral: "btn-coral",
  yellow: "btn-yellow",
  success: "btn-success",
  danger: "btn-danger",
  ghost: "btn-ghost",
};

// Neo-brutalist button: strong border, tactile offset shadow, clear states.
const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", loading, block, disabled, className = "", children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        "btn",
        VARIANT[variant],
        block ? "w-full" : "",
        className,
      ].join(" ")}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
});

export default Button;
