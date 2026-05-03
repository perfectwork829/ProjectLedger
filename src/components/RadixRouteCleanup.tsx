import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { recoverStaleModalLayers } from "@/lib/recoverStaleModalLayers";

/**
 * After each client navigation, clear stale global styles from closed Radix modals.
 * See `recoverStaleModalLayers` for why this is needed.
 */
export function RadixRouteCleanup() {
  const { pathname, search, hash } = useLocation();

  useLayoutEffect(() => {
    recoverStaleModalLayers();
  }, [pathname, search, hash]);

  return null;
}
