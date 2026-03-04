"use client";

import { useState, useEffect } from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * Detects whether the current device is mobile based on viewport width
 * and user-agent string. SSR-safe – returns `false` until hydrated.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check both viewport width AND touch capability / user-agent
    const checkMobile = () => {
      const narrowViewport = window.innerWidth < MOBILE_BREAKPOINT;
      const touchDevice =
        "ontouchstart" in window || navigator.maxTouchPoints > 0;
      const mobileUA = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
      setIsMobile(narrowViewport || (touchDevice && mobileUA));
    };

    checkMobile();

    // Also use matchMedia for efficient listener
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => checkMobile();
    mql.addEventListener("change", onChange);
    window.addEventListener("resize", onChange);

    return () => {
      mql.removeEventListener("change", onChange);
      window.removeEventListener("resize", onChange);
    };
  }, []);

  return isMobile;
}
