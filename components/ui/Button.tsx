import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "outline" | "danger" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  icon?: ReactNode;
  fullWidth?: boolean;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover",
  secondary: "bg-primary-light text-primary hover:bg-primary/20",
  outline: "border border-border bg-surface text-slate-700 hover:bg-bg",
  danger: "border border-danger/30 bg-danger-light text-danger hover:bg-danger/20",
  ghost: "text-slate-600 hover:bg-bg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "primary", icon, fullWidth = false, className = "", children, type, ...props },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          variantClasses[variant]
        } ${fullWidth ? "w-full" : ""} ${className}`}
        {...props}
      >
        {icon}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
