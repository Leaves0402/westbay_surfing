import Link, { type LinkProps } from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { getButtonClasses, type ButtonVariant } from "@/components/ui/Button";

type LinkButtonProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    variant?: ButtonVariant;
    icon?: ReactNode;
    fullWidth?: boolean;
    children?: ReactNode;
  };

export function LinkButton({
  variant = "primary",
  icon,
  fullWidth = false,
  className = "",
  children,
  ...props
}: LinkButtonProps) {
  return (
    <Link className={getButtonClasses(variant, { fullWidth, className })} {...props}>
      {icon}
      {children}
    </Link>
  );
}
