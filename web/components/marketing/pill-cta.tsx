import Link from "next/link";
import { cn } from "@/lib/utils";

type PillCtaProps = {
  href?: string;
  children: React.ReactNode;
  className?: string;
  size?: "default" | "sm";
  variant?: "solid" | "ghost";
  type?: "button" | "submit";
  onClick?: () => void;
};

export function PillCta({
  href,
  children,
  className,
  size = "default",
  variant = "solid",
  type = "button",
  onClick,
}: PillCtaProps) {
  const classes = cn(
    "pill-cta",
    size === "sm" && "pill-cta-sm",
    variant === "ghost" && "pill-cta-ghost",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes} onClick={onClick}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} className={classes} onClick={onClick}>
      {children}
    </button>
  );
}
