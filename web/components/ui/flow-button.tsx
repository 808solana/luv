'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

type FlowButtonProps = {
  text?: string;
  href?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
  onClick?: () => void;
};

const inner = (text: string) => (
  <>
    <ArrowRight
      className="absolute w-4 h-4 left-[-25%] stroke-[#111111] fill-none z-[9] group-hover:left-4 transition-all duration-[800ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]"
      aria-hidden="true"
    />
    <span className="relative z-[1] -translate-x-3 group-hover:translate-x-3 transition-all duration-[800ms] ease-out text-[#111111]">
      {text}
    </span>
    <ArrowRight
      className="absolute w-4 h-4 right-4 stroke-[#111111] fill-none z-[9] group-hover:right-[-25%] transition-all duration-[800ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]"
      aria-hidden="true"
    />
  </>
);

const className =
  'liquid-glass group relative flex items-center gap-1 overflow-hidden rounded-[100px] bg-white/25 px-8 py-3 text-sm font-semibold text-[#111111] cursor-pointer transition-all duration-[600ms] ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.95] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#675c56] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100';

export function FlowButton({
  text = 'Api Key',
  href,
  type = 'button',
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
