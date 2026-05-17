import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";
import { BarChart3, CheckCircle2, Cookie, Eye, Lock, Megaphone, Shield, Sparkles, X } from "lucide-react";
import { api, type AnalyticsConsentState, type AnalyticsTrackEvent, getToken } from "@/lib/api";
import { deleteCookie, getCookie, setCookie } from "@/lib/browser-cookies";
import { resolveAbsoluteApiUrl } from "@/lib/runtime-config";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

const CONSENT_COOKIE = "uor_consent_state";
const VISITOR_COOKIE = "uor_visitor_id";
const SESSION_COOKIE = "uor_analytics_session";
const FUNCTIONAL_COOKIE = "uor_functional_state";
const MARKETING_COOKIE = "uor_marketing_attribution";
const CONSENT_VERSION = "2026.03";
type FunctionalState = {
  theme: "light" | "dark";
  language: string;
  lastPage: string;
  onboardingCompleted: boolean;
  interestCart: Array<{ type: "course" | "panel"; id: string; label: string }>;
  viewState: Record<string, boolean>;
  filters: Record<string, string>;
};

type AnalyticsContextValue = {
  consent: AnalyticsConsentState | null;
  functionalState: FunctionalState;
  openPreferences: () => void;
  updateConsent: (next: Omit<AnalyticsConsentState, "version" | "essential">) => void;
  trackEvent: (event: AnalyticsTrackEvent) => void;
  rememberInterest: (item: { type: "course" | "panel"; id: string; label: string }) => void;
  markViewState: (key: string, value?: boolean) => void;
  saveFilterState: (key: string, value: string) => void;
};

const AnalyticsContext = createContext<AnalyticsContextValue | null>(null);

const defaultFunctionalState: FunctionalState = {
  theme: "light",
  language: "pt-AO",
  lastPage: "/",
  onboardingCompleted: false,
  interestCart: [],
  viewState: {},
  filters: {},
};

function createId(prefix: string) {
  const uuid = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return `${prefix}_${uuid}`;
}

function getRouteName(pathname: string) {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/projeto/")) return "project_detail";
  if (pathname === "/projetos") return "projects";
  if (pathname === "/cursos") return "courses";
  if (pathname.startsWith("/cursos/")) return "course_registration";
  if (pathname === "/ao-vivo") return "live";
  if (pathname === "/login") return "login";
  if (pathname === "/admin") return "admin";
  return pathname.replace(/\//g, "_").replace(/^_+/, "") || "page";
}

function parseJsonCookie<T>(name: string) {
  const raw = getCookie(name);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJsonCookie(name: string, value: unknown, days: number) {
  setCookie(name, JSON.stringify(value), {
    days,
    sameSite: "Strict",
  });
}

function getAnalyticsEndpoint(path: string) {
  return resolveAbsoluteApiUrl(path);
}

function canUseAnalyticsApi() {
  return typeof api.analytics?.track === "function" && typeof api.analytics?.consent === "function";
}

function classifyClick(target: HTMLElement, pathname: string): AnalyticsTrackEvent | null {
  const anchor = target.closest("a");
  const button = target.closest("button");
  const label = (anchor?.textContent || button?.textContent || target.textContent || "").trim().replace(/\s+/g, " ").slice(0, 120);
  const href = anchor?.getAttribute("href") || "";
  const explicitType = target.closest<HTMLElement>("[data-analytics-event]")?.dataset.analyticsEvent;

  if (explicitType) {
    return {
      type: explicitType,
      category: (target.closest<HTMLElement>("[data-analytics-category]")?.dataset.analyticsCategory as AnalyticsTrackEvent["category"]) || "ENGAGEMENT",
      pageUrl: window.location.pathname,
      routeName: getRouteName(pathname),
      elementLabel: label || explicitType,
    };
  }

  if (/wa\.me|whatsapp/i.test(href) || /whatsapp/i.test(label)) {
    return { type: "whatsapp_open", category: "CONVERSION", pageUrl: pathname, routeName: getRouteName(pathname), elementLabel: label || "WhatsApp" };
  }

  if (/ao-vivo/i.test(href) || /ao vivo/i.test(label)) {
    return { type: "live_open_click", category: "LIVE", pageUrl: pathname, routeName: getRouteName(pathname), elementLabel: label || "Ao Vivo" };
  }

  if (/partilhar|share/i.test(label)) {
    return { type: pathname.startsWith("/projeto/") ? "project_share" : "ticket_share", category: "MARKETING", pageUrl: pathname, routeName: getRouteName(pathname), elementLabel: label };
  }

  if (/pdf|tal[aã]o|ticket|boarding/i.test(label) || /\.pdf$/i.test(href)) {
    return { type: pathname.startsWith("/cursos/") ? "course_ticket_download" : "submission_ticket_download", category: "CONVERSION", pageUrl: pathname, routeName: getRouteName(pathname), elementLabel: label || "PDF" };
  }

  if (/inscri/i.test(label) || /\/cursos\/\d+\/inscricao/.test(href)) {
    return { type: "course_interest_click", category: "CONVERSION", pageUrl: pathname, routeName: getRouteName(pathname), elementLabel: label || "Inscrição" };
  }

  return null;
}

const consentCategories = [
  {
    key: "essential" as const,
    title: "Essenciais",
    description: "Sessão, autenticação e segurança do portal. Sempre ativos.",
    icon: Lock,
    color: "text-slate-600 bg-slate-100 border-slate-200",
    alwaysOn: true,
  },
  {
    key: "analytics" as const,
    title: "Analytics",
    description: "Visitas, interesse em cursos, conversões e desempenho do evento.",
    icon: BarChart3,
    color: "text-blue-600 bg-blue-50 border-blue-200",
    alwaysOn: false,
  },
  {
    key: "functional" as const,
    title: "Funcionalidade",
    description: "Preferências, filtros e estado da navegação para uma experiência fluida.",
    icon: Sparkles,
    color: "text-violet-600 bg-violet-50 border-violet-200",
    alwaysOn: false,
  },
  {
    key: "marketing" as const,
    title: "Marketing",
    description: "Medir campanhas, origem das visitas e impacto das partilhas.",
    icon: Megaphone,
    color: "text-amber-600 bg-amber-50 border-amber-200",
    alwaysOn: false,
  },
];

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [consent, setConsentState] = useState<AnalyticsConsentState | null>(() => parseJsonCookie<AnalyticsConsentState>(CONSENT_COOKIE));
  const [functionalState, setFunctionalState] = useState<FunctionalState>(() => ({
    ...defaultFunctionalState,
    ...(parseJsonCookie<FunctionalState>(FUNCTIONAL_COOKIE) ?? {}),
  }));
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [draftConsent, setDraftConsent] = useState<Omit<AnalyticsConsentState, "version" | "essential">>(() => ({
    analytics: consent?.analytics ?? false,
    functional: consent?.functional ?? true,
    marketing: consent?.marketing ?? false,
  }));
  const lastPageStartedAt = useRef(Date.now());
  const lastScrollDepth = useRef(0);
  const emittedDepths = useRef<Set<number>>(new Set());
  const pendingMarketingRef = useRef<URLSearchParams | null>(null);
  const suppressConsentBanner = location.pathname === "/votacao-ao-vivo";

  const visitorId = useMemo(() => getCookie(VISITOR_COOKIE), [consent?.analytics]);
  const sessionId = useMemo(() => getCookie(SESSION_COOKIE), [consent?.analytics]);

  useEffect(() => {
    setDraftConsent({
      analytics: consent?.analytics ?? false,
      functional: consent?.functional ?? true,
      marketing: consent?.marketing ?? false,
    });
  }, [consent]);

  useEffect(() => {
    pendingMarketingRef.current = new URLSearchParams(location.search);
  }, [location.search]);

  useEffect(() => {
    if (consent?.functional) {
      setFunctionalState((current) => {
        const lastPage = `${location.pathname}${location.search}`;
        if (current.lastPage === lastPage) {
          return current;
        }

        const nextState = {
          ...current,
          lastPage,
        };
        writeJsonCookie(FUNCTIONAL_COOKIE, nextState, 30);
        return nextState;
      });
    }
  }, [consent?.functional, location.pathname, location.search]);

  const ensureAnalyticsIds = () => {
    const currentVisitor = getCookie(VISITOR_COOKIE) ?? createId("visitor");
    const currentSession = getCookie(SESSION_COOKIE) ?? createId("session");
    setCookie(VISITOR_COOKIE, currentVisitor, { days: 90, sameSite: "Strict" });
    setCookie(SESSION_COOKIE, currentSession, { days: 1, sameSite: "Strict" });
    return { visitorId: currentVisitor, sessionId: currentSession };
  };

  const updateConsent = (next: Omit<AnalyticsConsentState, "version" | "essential">) => {
    const fullState: AnalyticsConsentState = {
      essential: true,
      version: CONSENT_VERSION,
      ...next,
    };

    setConsentState(fullState);
    writeJsonCookie(CONSENT_COOKIE, fullState, 180);

    if (!fullState.analytics) {
      deleteCookie(VISITOR_COOKIE, { sameSite: "Strict" });
      deleteCookie(SESSION_COOKIE, { sameSite: "Strict" });
    }

    if (!fullState.marketing) {
      deleteCookie(MARKETING_COOKIE, { sameSite: "Strict" });
    }

    if (fullState.functional) {
      writeJsonCookie(FUNCTIONAL_COOKIE, functionalState, 30);
    }

    let ids: { visitorId?: string | null; sessionId?: string | null } = {};
    if (fullState.analytics) {
      ids = ensureAnalyticsIds();
    }

    if (fullState.marketing && pendingMarketingRef.current && Array.from(pendingMarketingRef.current.keys()).some((key) => key.toLowerCase().startsWith("utm_"))) {
      const marketingPayload = {
        utmSource: pendingMarketingRef.current.get("utm_source"),
        utmMedium: pendingMarketingRef.current.get("utm_medium"),
        utmCampaign: pendingMarketingRef.current.get("utm_campaign"),
        utmContent: pendingMarketingRef.current.get("utm_content"),
        utmTerm: pendingMarketingRef.current.get("utm_term"),
      };
      writeJsonCookie(MARKETING_COOKIE, marketingPayload, 30);
    }

    if (canUseAnalyticsApi()) {
      void api.analytics.consent({
        visitorId: ids.visitorId ?? visitorId,
        sessionId: ids.sessionId ?? sessionId,
        source: "preferences",
        lastVisitedPage: `${location.pathname}${location.search}`,
        lastCampaign: pendingMarketingRef.current?.get("utm_campaign"),
        consent: fullState,
      });
    }

    setPreferencesOpen(false);
  };

  const sendAnalyticsPayload = (payload: {
    visitorId: string;
    sessionId: string;
    consent: AnalyticsConsentState;
    events: AnalyticsTrackEvent[];
  }) => {
    const marketingCookie = parseJsonCookie<Record<string, string | null>>(MARKETING_COOKIE);
    const body = {
      ...payload,
      pageUrl: `${window.location.pathname}${window.location.search}`,
      referrer: document.referrer || null,
      utmSource: marketingCookie?.utmSource ?? null,
      utmMedium: marketingCookie?.utmMedium ?? null,
      utmCampaign: marketingCookie?.utmCampaign ?? null,
      utmContent: marketingCookie?.utmContent ?? null,
      utmTerm: marketingCookie?.utmTerm ?? null,
    };

    const endpoint = getAnalyticsEndpoint("/analytics/track");
    const canUseBeacon = typeof navigator !== "undefined"
      && "sendBeacon" in navigator
      && !getToken();

    if (canUseBeacon) {
      navigator.sendBeacon(endpoint, new Blob([JSON.stringify(body)], { type: "application/json" }));
      return;
    }

    if (canUseAnalyticsApi()) {
      void api.analytics.track(body);
    }
  };

  const trackEvent = (event: AnalyticsTrackEvent) => {
    if (!consent?.analytics && event.category !== "CONSENT" && event.category !== "SECURITY" && !(consent?.functional && event.category === "FUNCTIONAL") && !(consent?.marketing && event.category === "MARKETING")) {
      return;
    }

    const ids = consent?.analytics ? ensureAnalyticsIds() : { visitorId: createId("ephemeral"), sessionId: createId("ephemeral-session") };

    sendAnalyticsPayload({
      visitorId: ids.visitorId,
      sessionId: ids.sessionId,
      consent: consent ?? {
        essential: true,
        analytics: false,
        functional: true,
        marketing: false,
        version: CONSENT_VERSION,
      },
      events: [event],
    });
  };

  useEffect(() => {
    if (!consent?.analytics) return;

    lastPageStartedAt.current = Date.now();
    lastScrollDepth.current = 0;
    emittedDepths.current = new Set();

    trackEvent({
      type: location.pathname === "/ao-vivo" ? "live_page_view" : location.pathname.startsWith("/projeto/") ? "project_detail_view" : location.pathname.startsWith("/cursos/") ? "course_registration_view" : "page_view",
      category: location.pathname === "/ao-vivo" ? "LIVE" : "NAVIGATION",
      pageUrl: `${location.pathname}${location.search}`,
      routeName: getRouteName(location.pathname),
      referrer: document.referrer || null,
    });

    return () => {
      const duration = Date.now() - lastPageStartedAt.current;
      trackEvent({
        type: "page_leave",
        category: "NAVIGATION",
        pageUrl: `${location.pathname}${location.search}`,
        routeName: getRouteName(location.pathname),
        duration,
        metadata: { maxScrollDepth: lastScrollDepth.current },
      });
    };
  }, [consent?.analytics, location.pathname, location.search]);

  useEffect(() => {
    if (!consent?.analytics) return;

    const onScroll = () => {
      const maxScrollable = document.documentElement.scrollHeight - window.innerHeight;
      const depth = maxScrollable > 0 ? Math.round((window.scrollY / maxScrollable) * 100) : 100;
      lastScrollDepth.current = Math.max(lastScrollDepth.current, Math.min(depth, 100));

      [25, 50, 75, 100].forEach((threshold) => {
        if (lastScrollDepth.current >= threshold && !emittedDepths.current.has(threshold)) {
          emittedDepths.current.add(threshold);
          trackEvent({
            type: "scroll_depth_reached",
            category: "ENGAGEMENT",
            pageUrl: `${location.pathname}${location.search}`,
            routeName: getRouteName(location.pathname),
            scrollDepth: threshold,
          });
        }
      });
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const mapped = classifyClick(target, location.pathname);
      if (mapped) {
        trackEvent(mapped);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("click", onClick);
    };
  }, [consent?.analytics, location.pathname, location.search]);

  const rememberInterest = (item: { type: "course" | "panel"; id: string; label: string }) => {
    if (!consent?.functional) return;

    setFunctionalState((current) => {
      const nextState = {
        ...current,
        interestCart: [
          item,
          ...current.interestCart.filter((entry) => !(entry.type === item.type && entry.id === item.id))
        ].slice(0, 8)
      };
      writeJsonCookie(FUNCTIONAL_COOKIE, nextState, 30);
      return nextState;
    });
  };

  const markViewState = (key: string, value = true) => {
    if (!consent?.functional) return;

    setFunctionalState((current) => {
      const nextState = {
        ...current,
        viewState: {
          ...current.viewState,
          [key]: value,
        }
      };
      writeJsonCookie(FUNCTIONAL_COOKIE, nextState, 30);
      return nextState;
    });
  };

  const saveFilterState = (key: string, value: string) => {
    if (!consent?.functional) return;

    setFunctionalState((current) => {
      const nextState = {
        ...current,
        filters: {
          ...current.filters,
          [key]: value,
        }
      };
      writeJsonCookie(FUNCTIONAL_COOKIE, nextState, 30);
      return nextState;
    });
  };

  const contextValue = useMemo<AnalyticsContextValue>(() => ({
    consent,
    functionalState,
    openPreferences: () => setPreferencesOpen(true),
    updateConsent,
    trackEvent,
    rememberInterest,
    markViewState,
    saveFilterState,
  }), [consent, functionalState]);

  return (
    <AnalyticsContext.Provider value={contextValue}>
      {children}

      {/* ── Cookie Consent Banner ── */}
      <AnimatePresence>
        {!consent && !suppressConsentBanner && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: "spring", damping: 24, stiffness: 260 }}
            className="fixed bottom-0 left-0 right-0 z-[80] sm:bottom-4 sm:left-4 sm:right-4"
          >
            <div className="mx-auto max-w-4xl overflow-hidden rounded-t-2xl border border-border/60 bg-white shadow-[0_-8px_40px_rgba(0,0,0,0.12)] sm:rounded-2xl sm:shadow-[0_16px_48px_rgba(0,0,0,0.14)]">
              {/* Top accent bar */}
              <div className="h-1 bg-gradient-to-r from-primary via-emerald-500 to-violet-500" />

              <div className="p-5 sm:p-6">
                {/* Header */}
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 text-white shadow-sm">
                    <Shield className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-bold text-slate-900">Privacidade e Cookies</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                      Usamos cookies essenciais para segurança e sessão. Com a tua autorização, ativamos analytics, personalização e medição de campanhas para melhorar a experiência.
                    </p>
                  </div>
                </div>

                {/* Cookie types mini-grid */}
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {consentCategories.map((cat) => {
                    const Icon = cat.icon;
                    return (
                      <div key={cat.key} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${cat.color}`}>
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="text-xs font-medium">{cat.title}</span>
                        {cat.alwaysOn ? (
                          <CheckCircle2 className="ml-auto h-3 w-3 shrink-0" />
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                {/* Actions */}
                <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => setPreferencesOpen(true)}
                    className="text-sm font-medium text-slate-500 underline decoration-slate-300 underline-offset-2 transition-colors hover:text-slate-700"
                  >
                    Personalizar preferências
                  </button>
                  <div className="flex gap-2.5">
                    <Button
                      variant="outline"
                      className="flex-1 rounded-xl border-slate-200 text-slate-700 sm:flex-none"
                      onClick={() => updateConsent({ analytics: false, functional: false, marketing: false })}
                    >
                      Apenas essenciais
                    </Button>
                    <Button
                      className="flex-1 rounded-xl bg-slate-900 text-white shadow-sm hover:bg-slate-800 sm:flex-none"
                      onClick={() => updateConsent({ analytics: true, functional: true, marketing: true })}
                    >
                      Aceitar todos
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Preferences Dialog ── */}
      <Dialog open={preferencesOpen} onOpenChange={setPreferencesOpen}>
        <DialogContent className="w-[96vw] max-w-xl gap-0 overflow-hidden rounded-3xl border-0 p-0 shadow-2xl">
          {/* Header */}
          <div className="relative bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 px-6 py-6">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/15 blur-2xl" />
              <div className="absolute -bottom-4 -left-8 h-24 w-24 rounded-full bg-violet-500/10 blur-xl" />
            </div>
            <div className="relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm">
                    <Shield className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Centro de Privacidade</h2>
                    <p className="text-xs text-slate-400">UOR Connect v{CONSENT_VERSION}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPreferencesOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                Escolhe quais cookies queres ativar. Os essenciais mantêm o login e a segurança.
              </p>
            </div>
          </div>

          {/* Categories */}
          <div className="max-h-[min(60vh,480px)] overflow-y-auto bg-slate-50/50 p-4 sm:p-5">
            <div className="space-y-3">
              {consentCategories.map((cat) => {
                const Icon = cat.icon;
                const isOn = cat.alwaysOn || draftConsent[cat.key as keyof typeof draftConsent];
                return (
                  <div
                    key={cat.key}
                    className={`rounded-2xl border bg-white p-4 transition-shadow ${isOn ? "border-slate-200 shadow-sm" : "border-slate-100"}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${cat.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">{cat.title}</p>
                          {cat.alwaysOn ? (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Sempre ativo</span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{cat.description}</p>
                      </div>
                      {cat.alwaysOn ? (
                        <div className="flex h-6 w-10 items-center justify-end rounded-full bg-slate-200 px-0.5">
                          <div className="h-5 w-5 rounded-full bg-slate-400" />
                        </div>
                      ) : (
                        <Switch
                          checked={draftConsent[cat.key as keyof typeof draftConsent]}
                          onCheckedChange={(checked) => setDraftConsent((current) => ({ ...current, [cat.key]: checked }))}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Info box */}
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-200/60 bg-emerald-50/50 p-3.5">
              <Eye className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <p className="text-xs leading-relaxed text-emerald-800">
                Sem autorização, apenas os cookies essenciais ficam ativos para segurança e sessão. Podes alterar a qualquer momento no rodapé do site.
              </p>
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-white px-5 py-4 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              className="rounded-xl border-slate-200 text-slate-600"
              onClick={() => updateConsent({ analytics: false, functional: false, marketing: false })}
            >
              Apenas essenciais
            </Button>
            <Button
              className="rounded-xl bg-slate-900 text-white hover:bg-slate-800"
              onClick={() => updateConsent(draftConsent)}
            >
              Guardar preferências
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics() {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error("useAnalytics must be used within AnalyticsProvider");
  }
  return context;
}
