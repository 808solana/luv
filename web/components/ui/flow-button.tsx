'use client';
import { ArrowRight } from 'lucide-react';

export function FlowButton({ text = 'Api Key' }: { text?: string }) {
  return (
    <button className="liquid-glass group relative flex items-center gap-1 overflow-hidden rounded-[100px] bg-white/25 px-8 py-3 text-sm font-semibold text-[#111111] cursor-pointer transition-all duration-[600ms] ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.95]">
      {/* Left arrow (enters from the left on hover) */}
      <ArrowRight
        className="absolute w-4 h-4 left-[-25%] stroke-[#111111] fill-none z-[9] group-hover:left-4 transition-all duration-[800ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]"
      />

      {/* Text — always black */}
      <span className="relative z-[1] -translate-x-3 group-hover:translate-x-3 transition-all duration-[800ms] ease-out text-[#111111]">
        {text}
      </span>

      {/* Right arrow (exits to the right on hover) */}
      <ArrowRight
        className="absolute w-4 h-4 right-4 stroke-[#111111] fill-none z-[9] group-hover:right-[-25%] transition-all duration-[800ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]"
      />
    </button>
  );
}
