/**
 * Returns true if the user has requested reduced motion via
 * the `prefers-reduced-motion: reduce` media query.
 *
 * Called at component render time so it reacts to changes without
 * requiring a hook. Charts should pass `isAnimationActive={!prefersReducedMotion()}`
 * to suppress Recharts' JS-driven entry animations, which are not covered
 * by the global CSS `transition-duration: 0.01ms` rule.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
