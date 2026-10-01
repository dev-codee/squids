/**
 * Server-side IP geolocation.
 *
 * Order of precedence:
 *   1. Vercel's `x-vercel-ip-country` header (present in production on Vercel).
 *   2. A free IP lookup via ip-api.com (covers local dev / non-Vercel hosts).
 *   3. A configurable default country (DEFAULT_COUNTRY env, else "US").
 */

export type GeoSource = "vercel" | "ip-api" | "default";

export interface GeoResult {
  /** 2-letter ISO country code, uppercase. */
  country: string;
  /** Where the value came from — useful for debugging / the UI. */
  source: GeoSource;
}

/** Minimal shape we need from the incoming request. */
type RequestLike = { headers: { get(name: string): string | null } };

const CODE_RE = /^[A-Za-z]{2}$/;

function getDefaultCountry(): string {
  const value = process.env.DEFAULT_COUNTRY?.toUpperCase();
  return value && CODE_RE.test(value) ? value : "US";
}

/** Pull the best-guess client IP from common proxy headers. */
function getClientIp(request: RequestLike): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip");
}

/** Localhost / RFC-1918 ranges we can't geolocate. */
function isPrivateIp(ip: string): boolean {
  if (ip === "::1" || ip.startsWith("127.") || ip.startsWith("::ffff:127."))
    return true;
  if (ip.startsWith("10.") || ip.startsWith("192.168.")) return true;
  const m = ip.match(/^172\.(\d+)\./);
  if (m) {
    const second = Number(m[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

/**
 * Resolve the user's country for the given request.
 *
 * Note: when the client IP is missing/private (typical in local dev), we query
 * ip-api.com *without* an IP — it then geolocates the server's own egress IP,
 * which in local development is your machine, giving a sensible result.
 */
export async function getUserCountry(request: RequestLike): Promise<GeoResult> {
  const vercelCountry = request.headers.get("x-vercel-ip-country");
  if (vercelCountry && CODE_RE.test(vercelCountry)) {
    return { country: vercelCountry.toUpperCase(), source: "vercel" };
  }

  const ip = getClientIp(request);
  const lookupIp = ip && !isPrivateIp(ip) ? ip : "";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    // ip-api.com free tier is HTTP-only; that's fine for a server-side call.
    const res = await fetch(
      `http://ip-api.com/json/${lookupIp}?fields=status,countryCode`,
      { signal: controller.signal, cache: "no-store" },
    );
    clearTimeout(timeout);

    if (res.ok) {
      const data = (await res.json()) as {
        status?: string;
        countryCode?: string;
      };
      if (
        data.status === "success" &&
        data.countryCode &&
        CODE_RE.test(data.countryCode)
      ) {
        return { country: data.countryCode.toUpperCase(), source: "ip-api" };
      }
    }
  } catch {
    // Swallow network/timeout errors and fall through to the default.
  }

  return { country: getDefaultCountry(), source: "default" };
}
