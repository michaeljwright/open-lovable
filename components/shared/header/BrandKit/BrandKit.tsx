"use client";

import { animate, cubicBezier } from "motion";
import { motion } from "motion/react";
import Link from "next/link";
import { useCallback, useRef } from "react";

export default function HeaderBrandKit() {
  return (
    <Link
      className="flex items-center gap-2"
      href="/"
    >
      <img src="/penultimate.png" alt="Logo" style={{ height: '60px', width: 'auto' }} />
    </Link>
  );
}

const Menu = ({ setOpen }: { setOpen: (open: boolean) => void }) => {
  const backgroundRef = useRef<HTMLDivElement>(null);

  const timeoutRef = useRef<number | null>(null);

  const onMouseEnter = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const t = e.target as HTMLElement;

    const target =
      t instanceof HTMLButtonElement
        ? t
        : (t.closest("button") as HTMLButtonElement);

    if (backgroundRef.current) {
      animate(backgroundRef.current, { scale: 0.98, opacity: 1 }).then(() => {
        if (backgroundRef.current) {
          animate(backgroundRef.current!, { scale: 1 });
        }
      });

      animate(
        backgroundRef.current,
        {
          y: target.offsetTop - 4,
        },
        {
          ease: cubicBezier(0.1, 0.1, 0.25, 1),
          duration: 0.2,
        },
      );
    }
  }, []);

  const onMouseLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      if (backgroundRef.current) {
        animate(backgroundRef.current, { scale: 1, opacity: 0 });
      }
    }, 100);
  }, []);

  return (
    <motion.div
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      className="absolute w-220 whitespace-nowrap rounded-16 p-4 bg-white left-0 top-[calc(100%+8px)] z-[2000] border border-border-faint"
      exit={{ opacity: 0, y: 8, scale: 0.98, filter: "blur(1px)" }}
      initial={{ opacity: 0, y: -6, filter: "blur(1px)" }}
      style={{
        boxShadow:
          "0px 12px 24px rgba(0, 0, 0, 0.08), 0px 4px 8px rgba(0, 0, 0, 0.04)",
      }}
      transition={{
        ease: cubicBezier(0.1, 0.1, 0.25, 1),
        duration: 0.2,
      }}
    >
    </motion.div>
  );
};
