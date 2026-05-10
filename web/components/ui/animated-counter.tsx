"use client";

import { useEffect } from "react";
import { animate, useMotionValue, useTransform, motion } from "framer-motion";

type Props = {
  /** Final value to animate to. */
  value: number;
  /** Animation duration in seconds. Defaults to 1.4s. */
  duration?: number;
  /** Number of decimals. Defaults to 2 for currency. */
  decimals?: number;
  /** Optional prefix, eg '$'. */
  prefix?: string;
  /** Optional suffix, eg ' USDC'. */
  suffix?: string;
  className?: string;
};

/**
 * Counts up from 0 to `value` smoothly. Used during the close cascade so
 * payout numbers visibly tick up rather than just appearing — small detail
 * that makes the moment feel like money is actually flowing.
 */
export function AnimatedCounter({
  value,
  duration = 1.4,
  decimals = 2,
  prefix = "",
  suffix = "",
  className,
}: Props) {
  const motionValue = useMotionValue(0);
  const display = useTransform(
    motionValue,
    (latest) => `${prefix}${latest.toFixed(decimals)}${suffix}`
  );

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration,
      ease: "easeOut",
    });
    return () => controls.stop();
  }, [value, duration, motionValue]);

  return <motion.span className={className}>{display}</motion.span>;
}
