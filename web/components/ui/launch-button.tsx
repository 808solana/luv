"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";

type LaunchButtonProps = {
  href?: string;
  label?: string;
  type?: "button" | "submit";
  onClick?: () => void;
};

const baseClassName =
  "inline-flex items-center justify-center rounded-full border border-black bg-white px-[1.22rem] py-[0.49rem] text-[0.853rem] font-medium tracking-tight text-black touch-manipulation select-none transition-[transform,box-shadow,background-color] duration-150 ease-out will-change-transform focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_#fff,0_0_0_5px_#0d0c12] [@media(hover:hover)]:hover:scale-[1.03] [@media(hover:hover)]:hover:shadow-[0_0_0_3px_#fff,0_0_0_4px_#0d0c12]";

export default function LaunchButton({
  href,
  label = "AI models now",
  type = "button",
  onClick,
}: LaunchButtonProps) {
  const [pressed, setPressed] = useState(false);

  const onPointerDown = useCallback(() => setPressed(true), []);
  const onPointerUp = useCallback(() => setPressed(false), []);
  const onPointerLeave = useCallback(() => setPressed(false), []);
  const onPointerCancel = useCallback(() => setPressed(false), []);

  const className = cn(
    baseClassName,
    pressed
      ? "scale-[0.96] bg-white/90 shadow-none"
      : "scale-100 shadow-none",
  );

  const pressProps = {
    onPointerDown,
    onPointerUp,
    onPointerLeave,
    onPointerCancel,
  };

  if (href) {
    return (
      <Link href={href} className={className} {...pressProps}>
        {label}
      </Link>
    );
  }

  return (
    <button
      type={type}
      className={className}
      onClick={onClick}
      {...pressProps}
    >
      {label}
    </button>
  );
}
