/**
 * Attribution Types and Constants
 * Shared between client components and server route handlers.
 */

export const ATTRIBUTION_COOKIE_NAME = "_fz_attr";
export const COOKIE_MAX_AGE_DAYS = 30;

export interface VisitorAttribution {
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  landingUrl?: string;
  referrer?: string;
  timestamp: number;
}
