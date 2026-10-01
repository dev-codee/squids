"use client";

import { useEffect } from "react";
import { ATTRIBUTION_COOKIE_NAME, COOKIE_MAX_AGE_DAYS, VisitorAttribution } from "@/lib/attribution";
export { ATTRIBUTION_COOKIE_NAME, type VisitorAttribution };

/**
 * Parses a cookie value by name.
 */
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^|;\\s*)" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

/**
 * Sets a first-party cookie with a 30-day lifetime.
 */
function setCookie(name: string, value: string, days: number = COOKIE_MAX_AGE_DAYS): void {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax${secure}`;
}

/**
 * AttributionCapture:
 *
 * Runs on visitor arrival to capture Google Ads Click IDs (gclid, gbraid, wbraid)
 * and UTM marketing parameters into a 30-day first-party cookie and localStorage.
 */
export default function AttributionCapture() {
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;

      const urlParams = new URLSearchParams(window.location.search);
      const gclid = urlParams.get("gclid");
      const gbraid = urlParams.get("gbraid");
      const wbraid = urlParams.get("wbraid");
      const utm_source = urlParams.get("utm_source");
      const utm_medium = urlParams.get("utm_medium");
      const utm_campaign = urlParams.get("utm_campaign");

      // Only update attribution if at least one tracking parameter is present
      if (gclid || gbraid || wbraid || utm_source || utm_campaign) {
        const attribution: VisitorAttribution = {
          gclid: gclid || undefined,
          gbraid: gbraid || undefined,
          wbraid: wbraid || undefined,
          utm_source: utm_source || undefined,
          utm_medium: utm_medium || undefined,
          utm_campaign: utm_campaign || undefined,
          landingUrl: window.location.pathname,
          referrer: document.referrer || undefined,
          timestamp: Date.now(),
        };

        const json = JSON.stringify(attribution);
        setCookie(ATTRIBUTION_COOKIE_NAME, json, COOKIE_MAX_AGE_DAYS);
        try {
          localStorage.setItem(ATTRIBUTION_COOKIE_NAME, json);
        } catch {
          // localStorage may be disabled in private browsing
        }
      } else {
        // If no URL params, ensure cookie is synced from localStorage if cookie was lost
        const existingCookie = getCookie(ATTRIBUTION_COOKIE_NAME);
        if (!existingCookie) {
          try {
            const stored = localStorage.getItem(ATTRIBUTION_COOKIE_NAME);
            if (stored) {
              setCookie(ATTRIBUTION_COOKIE_NAME, stored, COOKIE_MAX_AGE_DAYS);
            }
          } catch {
            /* ignore */
          }
        }
      }
    } catch (e) {
      console.warn("[AttributionCapture] Failed to capture attribution:", e);
    }
  }, []);

  return null;
}
