"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface CookieConsentBannerProps {
  country?: string;
}

interface ConsentPreferences {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
}

const STORAGE_KEY = "foxzil_cookie_consent";
const COOKIE_NAME = "_fz_consent";

const TEXTS: Record<
  string,
  {
    title: string;
    description: string;
    acceptAll: string;
    essentialOnly: string;
    customize: string;
    savePreferences: string;
    privacyLink: string;
    analytics: string;
    marketing: string;
    essential: string;
  }
> = {
  de: {
    title: "Ihre Datenschutzeinstellungen",
    description:
      "Wir verwenden Cookies, um Ihre ausgewählte Region zu speichern, die Websitenutzung zu analysieren und Affiliate-Provisionen zuzuordnen. Sie können auswählen, welche Cookies Sie zulassen möchten.",
    acceptAll: "Alle akzeptieren",
    essentialOnly: "Nur notwendige",
    customize: "Einstellungen anpassen",
    savePreferences: "Auswahl speichern",
    privacyLink: "Datenschutzerklärung",
    analytics: "Analyse & Reichweitenmessung",
    marketing: "Affiliate-Zuordnung & Partner",
    essential: "Technisch notwendig (immer aktiv)",
  },
  fr: {
    title: "Vos préférences en matière de cookies",
    description:
      "Nous utilisons des cookies pour mémoriser votre région, analyser l'audience du site et attribuer les commissions d'affiliation. Vous pouvez choisir les catégories de cookies autorisées.",
    acceptAll: "Tout accepter",
    essentialOnly: "Essentiels uniquement",
    customize: "Personnaliser",
    savePreferences: "Enregistrer mes choix",
    privacyLink: "Politique de confidentialité",
    analytics: "Statistiques & audience",
    marketing: "Attribution d'affiliation",
    essential: "Indispensables (toujours actifs)",
  },
  es: {
    title: "Tus preferencias de privacidad",
    description:
      "Utilizamos cookies para recordar tu región, medir el rendimiento del sitio web y atribuir comisiones de afiliados. Puedes personalizar tus opciones en cualquier momento.",
    acceptAll: "Aceptar todo",
    essentialOnly: "Solo esenciales",
    customize: "Personalizar",
    savePreferences: "Guardar preferencias",
    privacyLink: "Política de privacidad",
    analytics: "Analítica y rendimiento",
    marketing: "Atribución de afiliados",
    essential: "Esenciales (siempre activos)",
  },
  it: {
    title: "Le tue preferenze sulla privacy",
    description:
      "Utilizziamo i cookie per ricordare la tua regione, analizzare l'utilizzo del sito e tracciare le transazioni di affiliazione. Puoi gestire le tue preferenze quando desideri.",
    acceptAll: "Accetta tutti",
    essentialOnly: "Solo essenziali",
    customize: "Personalizza",
    savePreferences: "Salva preferenze",
    privacyLink: "Informativa sulla privacy",
    analytics: "Statistiche e metriche",
    marketing: "Tracciamento affiliazione",
    essential: "Essenziali (sempre attivi)",
  },
  en: {
    title: "Your Privacy & Cookie Choices",
    description:
      "We use cookies to remember your country preferences, analyze site traffic, and attribute purchases so stores can reward Foxzil. You can choose whether to allow optional tracking or keep essential cookies only.",
    acceptAll: "Accept All",
    essentialOnly: "Essential Only",
    customize: "Customize Preferences",
    savePreferences: "Save Preferences",
    privacyLink: "Privacy Policy",
    analytics: "Analytics & Performance",
    marketing: "Affiliate Attribution & Tracking",
    essential: "Strictly Essential (Always Active)",
  },
};

export default function CookieConsentBanner({ country = "us" }: CookieConsentBannerProps) {
  const lc = country.toLowerCase();
  const lang = ["de", "fr", "es", "it"].includes(lc) ? lc : "en";
  const t = TEXTS[lang] || TEXTS.en;

  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(true);

  useEffect(() => {
    // Check if consent has already been given
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        // Small delay so layout doesn't jump abruptly on first paint
        const timer = setTimeout(() => setVisible(true), 600);
        return () => clearTimeout(timer);
      }
    } catch {
      // ignore storage access errors
    }
  }, []);

  const saveConsent = (prefs: { analytics: boolean; marketing: boolean }) => {
    const payload: ConsentPreferences = {
      essential: true,
      analytics: prefs.analytics,
      marketing: prefs.marketing,
      timestamp: new Date().toISOString(),
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      // First party cookie for 1 year
      const cookieValue = encodeURIComponent(
        `analytics=${prefs.analytics ? 1 : 0}&marketing=${prefs.marketing ? 1 : 0}`,
      );
      document.cookie = `${COOKIE_NAME}=${cookieValue}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
      // ignore
    }

    setVisible(false);
  };

  const handleAcceptAll = () => {
    saveConsent({ analytics: true, marketing: true });
  };

  const handleEssentialOnly = () => {
    saveConsent({ analytics: false, marketing: false });
  };

  const handleSaveCustom = () => {
    saveConsent({ analytics, marketing });
  };

  if (!visible) return null;

  return (
    <aside
      aria-label="Cookie consent"
      role="dialog"
      aria-modal="false"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-4xl rounded-card border border-line bg-white/95 p-5 shadow-2xl backdrop-blur-md transition-all sm:p-6"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-sm font-bold text-ink sm:text-base">{t.title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-ink-soft sm:text-sm">
            {t.description}{" "}
            <Link
              href={`/${lc}/privacy`}
              className="text-brand underline hover:text-brand-hover"
            >
              {t.privacyLink}
            </Link>
            .
          </p>
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={handleAcceptAll}
            className="rounded-[9px] bg-brand px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-brand-hover"
          >
            {t.acceptAll}
          </button>
          <button
            type="button"
            onClick={handleEssentialOnly}
            className="rounded-[9px] border border-line-strong bg-white px-4 py-2 text-xs font-semibold text-ink shadow-sm transition hover:bg-canvas"
          >
            {t.essentialOnly}
          </button>
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="text-xs font-semibold text-ink-muted underline hover:text-ink"
          >
            {showDetails ? "Hide options" : t.customize}
          </button>
        </div>
      </div>

      {/* Expanded granular settings */}
      {showDetails && (
        <div className="mt-4 border-t border-line pt-4 animate-in fade-in duration-200">
          <div className="grid gap-3 sm:grid-cols-3 text-xs">
            <label className="flex items-center gap-2 text-ink-muted cursor-not-allowed">
              <input type="checkbox" checked disabled className="rounded text-brand" />
              <span>{t.essential}</span>
            </label>

            <label className="flex items-center gap-2 text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
                className="rounded text-brand focus:ring-brand"
              />
              <span>{t.analytics}</span>
            </label>

            <label className="flex items-center gap-2 text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
                className="rounded text-brand focus:ring-brand"
              />
              <span>{t.marketing}</span>
            </label>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={handleSaveCustom}
              className="rounded-[7px] bg-ink px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-ink-soft"
            >
              {t.savePreferences}
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
