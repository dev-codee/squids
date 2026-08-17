# Phase 2 — Region-Specific Language for AI-Generated Content

> Phase 1 (static UI translation via dictionaries) is complete. This document
> plans Phase 2: making the **AI-generated content** — deal titles/descriptions
> and store pages — render in each region's default language instead of always
> English.

Scope of languages (same as Phase 1): **en, de, fr, es, it**. Every other region
falls back to English.

---

## 1. The problem

There are two blockers, and both must be fixed together.

### 1a. Prompt gap — the model is never told what language to write in
- `src/lib/ai/dealContent.ts` — builds title/description. The prompt has no
  language instruction, and the function isn't even passed the country/locale.
- `src/lib/ai/storeContent.ts` — builds the full store page. It passes the
  country/currency as *data*, but never instructs Claude to write in that
  region's language.

Result: everything comes back in English.

### 1b. Architectural blocker — AI output is stored language-less, cache-once
AI output lives in single fields, not keyed by language:
- Deals: `aiTitle`, `aiDescription`, `aiGeneratedAt` (one value per deal).
- Advertisers: `aiStorePage`, `aiStorePageAt` (one value per store).

And generation is first-visitor-wins:
- `src/lib/storeData.ts:442` → `if (advertiser.aiStorePage) return advertiser.aiStorePage;`
- `src/lib/storeData.ts:306` → skips a deal if `aiTitle && aiDescription` already exist.

A single deal's `regionCodes` can span many countries (US, DE, FR…). With one
language-less slot, whichever region loads first "wins" and every other region is
served that language. **Fixing the prompt alone is not enough** — there is
nowhere to store more than one language.

---

## 2. Target design

Key every AI field **by language**, generate **on demand per locale**, and add an
explicit **language instruction** to both prompts. English stays as the fallback
during and after rollout.

### 2a. Data model (MongoDB — additive, backward-compatible)

Deals (`deals` collection):
```
aiTitleByLang:       { en: string, de: string, ... }
aiDescriptionByLang: { en: string, de: string, ... }
aiStatusByLang:      { en: "APPROVED"|..., de: ... }
aiGeneratedAtByLang: { en: ISOString, de: ... }
```
Keep the existing `aiTitle` / `aiDescription` / `aiGeneratedAt` as the **`en`
alias** so nothing breaks before migration. Reads prefer `...ByLang[locale]`,
then `...ByLang.en`, then the legacy flat field.

Advertisers (`advertisers` collection):
```
aiStorePageByLang:   { en: StorePageContent, de: StorePageContent, ... }
aiStorePageAtByLang: { en: ISOString, de: ... }
```
Keep `aiStorePage` / `aiStorePageAt` as the `en` alias.

> Storage cost: worst case 5× the AI text per deal/store. Acceptable — text is
> small and generation is still once-per-(entity × language), not per request.

### 2b. Prompt changes

`src/lib/ai/dealContent.ts`
- Thread a `locale` / language name into `generateDealContent(deal, { language })`.
- Add to the system prompt, e.g.:
  > "Write ALL output (title and description) in **{language}**. Keep merchant
  > names, product names, brand names and any coupon codes verbatim. Preserve
  > numbers, prices, currency symbols and 'Up to X%' exactly. Do not translate
  > proper nouns."

`src/lib/ai/storeContent.ts`
- It already receives `ctx.country` / `ctx.currency`; add `ctx.language`.
- Same explicit "write everything in {language}" rule, plus keep the existing
  "never invent facts" and coupon-code rules intact.
- `"Not available"` sentinel values should be localized too (or mapped on read).

Language name is derived from the region locale (reuse Phase 1's
`localeForCountry` in `src/i18n/index.ts`): `de → "German"`, `fr → "French"`, etc.

### 2c. Read path (generate-on-demand per language)

`src/lib/storeData.ts`
- Compute `locale = localeForCountry(country)`.
- `loadStoreAiContent`: return `advertiser.aiStorePageByLang?.[locale]` if present;
  else generate for **that** locale, persist into that slot, return it.
- Per-request deal AI copy (currently `AI_GEN_PER_REQUEST = 6`): look up
  `...ByLang[locale]`; if missing, generate for that locale and cache in that slot.
- Everywhere a deal title/description is displayed, resolve via a helper:
  `dealDisplayTitle(deal, locale)` → `aiTitleByLang[locale] ?? aiTitleByLang.en ?? title`.
  (Update `src/lib/deals.ts` `dealDisplayTitle` / `dealDisplayDescription`.)

### 2d. Admin generation routes
- `src/app/api/admin/deals/generate-content/route.ts` and
  `src/app/api/admin/advertisers/generate-store-page/route.ts`: accept a
  `language` (or `country`) param, and a "generate for all languages" option so
  content can be pre-warmed rather than lazily generated on first visit.
- `ensureDealAiContent` / `ensureAdvertiserStorePage` (in `src/lib/db/deals.ts`
  and `src/lib/db/advertisers.ts`): add a `language`/`locale` arg and write into
  the correct `...ByLang` slot; the `force` flag regenerates just that slot.

---

## 3. Files to touch

| File | Change |
| --- | --- |
| `src/lib/ai/dealContent.ts` | Accept language; add language rule to prompt |
| `src/lib/ai/storeContent.ts` | Accept language; add language rule to prompt |
| `src/lib/db/deals.ts` | `...ByLang` fields; `ensureDealAiContent(deal, {locale, force})` |
| `src/lib/db/advertisers.ts` | `aiStorePageByLang`; `ensureAdvertiserStorePage(..., {locale, force})` |
| `src/lib/deals.ts` | `dealDisplayTitle/Description(deal, locale)` with en fallback |
| `src/lib/storeData.ts` | Resolve locale; per-locale lookup + generate-on-demand |
| `src/app/api/admin/deals/generate-content/route.ts` | `language` param + all-languages option |
| `src/app/api/admin/advertisers/generate-store-page/route.ts` | `language` param + all-languages option |
| Consumers of `deal.aiTitle`/`aiDescription` | Pass `locale` (e.g. `TopDealsClient`, `HomeRecentDeals`, store components) |

> Grep for `aiTitle`, `aiDescription`, `aiStorePage` before starting to catch
> every read site.

---

## 4. Rollout / migration

1. Ship the additive schema + read helpers with en-fallback (no behavior change:
   existing English content is served as `en`).
2. Backfill script: copy legacy `aiTitle`→`aiTitleByLang.en`,
   `aiStorePage`→`aiStorePageByLang.en`.
3. Enable prompt language + per-locale generation. Non-English regions generate
   lazily on first visit (bounded per request, same as today) — or pre-warm via
   the admin "all languages" route.
4. Monitor token spend (worst case ~5× for fully-covered entities).

## 5. Open decisions (confirm before coding)

- **Pre-warm vs lazy?** Lazy = cheapest, but first visitor in a language eats the
  latency (already how English works today). Pre-warm = instant but 5× tokens up
  front. Recommendation: **lazy**, with the admin all-languages button for
  important stores.
- **Localize `"Not available"` sentinels** in store content, or keep English and
  map on read? Recommendation: instruct the model to localize them.
- **Regeneration of existing English deals** — leave as-is (served as `en`) and
  only generate other languages on demand; don't re-spend tokens re-doing English.

---

*Phase 1 reference: static UI is translated via `src/i18n/dictionaries/*.json`
and `localeForCountry()` in `src/i18n/index.ts`. Phase 2 reuses that same
locale-resolution logic so UI language and AI-content language always match.*
