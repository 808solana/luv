"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

type FlowButtonProps = {
  text?: string;
  href?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
};

const inner = (text: string) => (
  <>
    <ArrowRight
      className="absolute left-4 z-[9] h-4 w-4 -translate-x-6 fill-none stroke-[#111111] opacity-0 transition-[transform,opacity] duration-300 ease-out group-hover:translate-x-0 group-hover:opacity-100"
      aria-hidden="true"
    />
    <span className="relative z-[1] -translate-x-3 text-[#111111] transition-transform duration-300 ease-out group-hover:translate-x-3">
      {text}
    </span>
    <ArrowRight
      className="absolute right-4 z-[9] h-4 w-4 fill-none stroke-[#111111] transition-[transform,opacity] duration-300 ease-out group-hover:translate-x-8 group-hover:opacity-0"
      aria-hidden="true"
    />
  </>
);

const className =
  "liquid-glass group relative flex min-h-11 items-center gap-1 overflow-hidden rounded-[100px] bg-white/25 px-8 py-3 text-sm font-semibold text-[#111111] cursor-pointer transition-[transform,opacity] duration-200 ease-out active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";

export function FlowButton({
  text = "Api Key",
  href,
  type = "button",
  disabled,
  onClick,
}: FlowButtonProps) {
  if (href) {
    return (
      <Link href={href} className={className} aria-disabled={disabled}>
        {inner(text)}
      </Link>
    );
  }

  return (
    <button
      type={type}
      className={className}
      disabled={disabled}
      onClick={onClick}
    >
      {inner(text)}
    </button>
  );
}
