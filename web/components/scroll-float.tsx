"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

type ScrollFloatProps = {
  text?: string;
  className?: string;
  style?: React.CSSProperties;
  as?: "h1" | "h2" | "h3" | "p" | "div" | "span";
};

export function ScrollFloat({
  text = "WE HOST AI",
  className,
  style,
  as = "div",
}: ScrollFloatProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chars = el.querySelectorAll<HTMLSpanElement>(".char");

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: document.body,
        start: "top top",
        end: "+=1000",
        scrub: 1.5,
        animation: gsap.fromTo(
          chars,
          {
            opacity: 1,
            yPercent: 0,
            scaleY: 1,
            scaleX: 1,
            transformOrigin: "50% 0%",
          },
          {
            opacity: 0,
            yPercent: 250,
            scaleY: 1.2,
            scaleX: 0.9,
            stagger: 0.05,
            ease: "power2.inOut",
            duration: 1,
          },
        ),
      });
    }, el);

    return () => ctx.revert();
  }, []);

  const lines = text.split("\n");
  const Tag = as;

  return (
    <Tag
      ref={containerRef as never}
      className={className}
      style={style}
      aria-label={text}
    >
      {lines.map((line, li) => (
        <span key={li} style={{ display: "block" }}>
          {line.split(" ").map((word, wi, wordsArr) => (
            <span
              key={`${li}-${wi}`}
              style={{ display: "inline-block", whiteSpace: "nowrap" }}
            >
              {word.split("").map((char, ci) => (
                <span key={`${li}-${wi}-${ci}`} className="char">
                  {char === " " ? "\u00A0" : char}
                </span>
              ))}
              {wi < wordsArr.length - 1 && (
                <span className="char">&nbsp;</span>
              )}
            </span>
          ))}
        </span>
      ))}
    </Tag>
  );
}
