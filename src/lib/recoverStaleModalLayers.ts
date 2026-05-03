/**
 * Radix modals (Dialog/Sheet/Alert) use body scroll-lock and sometimes touch `body` / `html` styles.
 * If a dialog closes during navigation, Fast Refresh, or an error, cleanup can be skipped and the
 * whole app stops receiving clicks — often nothing obvious in Inspect because the hit target is `body`.
 */
export function recoverStaleModalLayers(): void {
  const body = document.body;
  const html = document.documentElement;

  body.style.removeProperty("pointer-events");
  body.style.removeProperty("overflow");
  html.style.removeProperty("overflow");
  html.style.removeProperty("padding-right");

  body.classList.remove("right-scroll-bar-position", "width-before-scroll-bar", "with-scroll-bars-hidden");

  const root = document.getElementById("root");
  if (root?.getAttribute("aria-hidden") === "true") {
    root.removeAttribute("aria-hidden");
  }
}
