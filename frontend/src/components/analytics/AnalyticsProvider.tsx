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
import { BarChart3, Cookie, ShieldCheck, Sparkles } from "lucide-react";
import { api, type AnalyticsConsentState, type AnalyticsTrackEvent, getToken } from "@/lib/api";
import { deleteCookie, getCookie, setCookie } from "@/lib/browser-cookies";
import { resolveAbsoluteApiUrl } from "@/lib/runtime-config";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

      <AnimatePresence>
        {!consent && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="fixed bottom-4 left-4 right-4 z-[80] mx-auto max-w-5xl rounded-[18px] border border-[#0A3D62]/20 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(240,255,250,0.96))] p-5 shadow-[0_18px_50px_rgba(10,61,98,0.16)] backdrop-blur"
          >
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#0A3D62]/15 bg-[#0A3D62]/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0A3D62]">
                  <Cookie className="h-3.5 w-3.5" />
                  Preferências de cookies UOR Connect
                </div>
                <div>
                  <h3 className="font-heading text-xl font-bold text-[#0A3D62]">Controla a tua privacidade e melhora a experiência no portal.</h3>
                  <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
                    Usamos cookies essenciais para segurança e sessão. Com a tua autorização, ativamos analytics, personalização e medição de campanhas para melhorar inscrições, tickets e experiência do evento.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                <Button variant="outline" className="rounded-xl border-[#0A3D62]/20 text-[#0A3D62]" onClick={() => updateConsent({ analytics: false, functional: false, marketing: false })}>
                  Recusar opcionais
                </Button>
                <Button variant="outline" className="rounded-xl border-[#0A3D62]/20 text-[#0A3D62]" onClick={() => setPreferencesOpen(true)}>
                  Gerir preferências
                </Button>
                <Button className="rounded-xl bg-[#00B894] text-white hover:bg-[#00a382]" onClick={() => updateConsent({ analytics: true, functional: true, marketing: true })}>
                  Aceitar tudo
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={preferencesOpen} onOpenChange={setPreferencesOpen}>
        <DialogContent className="w-[96vw] max-w-2xl rounded-[24px] border-border/70 p-0 overflow-hidden">
          <div className="max-h-[min(86vh,760px)] overflow-y-auto bg-[linear-gradient(180deg,rgba(10,61,98,0.06),rgba(0,184,148,0.04))] p-5 sm:p-6">
            <DialogHeader className="text-left">
              <DialogTitle className="flex items-center gap-2 font-heading text-2xl">
                <ShieldCheck className="h-5 w-5 text-[#0A3D62]" />
                Centro de Privacidade UOR Connect
              </DialogTitle>
              <DialogDescription className="text-sm leading-7 text-slate-600">
                Escolhe apenas o que faz sentido para ti. Os cookies essenciais mantêm o login e a segurança do portal.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 grid gap-4">
              {[
                {
                  key: "analytics" as const,
                  title: "Analytics",
                  subtitle: "Ajuda-nos a perceber visitas, interesse, conversões e pontos fortes do evento.",
                  icon: BarChart3,
                  enabled: draftConsent.analytics,
                },
                {
                  key: "functional" as const,
                  title: "Funcionalidade",
                  subtitle: "Guarda preferências úteis, filtros e estados da tua navegação para uma experiência mais fluida.",
                  icon: Sparkles,
                  enabled: draftConsent.functional,
                },
                {
                  key: "marketing" as const,
                  title: "Marketing",
                  subtitle: "Permite medir campanhas, origem das visitas e impacto das partilhas.",
                  icon: Cookie,
                  enabled: draftConsent.marketing,
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.key} className="rounded-2xl border border-border/70 bg-white/90 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0A3D62]/8 text-[#0A3D62]">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{item.title}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{item.subtitle}</p>
                        </div>
                      </div>
                      <Switch
                        checked={draftConsent[item.key]}
                        onCheckedChange={(checked) => setDraftConsent((current) => ({ ...current, [item.key]: checked }))}
                      />
                    </div>
                  </div>
                );
              })}

              <div className="rounded-2xl border border-[#00B894]/15 bg-[#00B894]/6 p-4 text-sm leading-7 text-slate-700">
                <p className="font-semibold text-[#0A3D62]">Resumo rápido</p>
                <p>Sem a tua autorização, só ficam ativos os cookies essenciais para segurança e sessão. As restantes categorias só entram se escolheres ativá-las.</p>
              </div>

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <Button variant="outline" className="rounded-xl" onClick={() => setPreferencesOpen(false)}>
                  Fechar
                </Button>
                <Button variant="outline" className="rounded-xl border-[#0A3D62]/20 text-[#0A3D62]" onClick={() => updateConsent({ analytics: false, functional: false, marketing: false })}>
                  Apenas essenciais
                </Button>
                <Button className="rounded-xl bg-[#0A3D62] text-white hover:bg-[#082f4b]" onClick={() => updateConsent(draftConsent)}>
                  Guardar preferências
                </Button>
              </div>
            </div>
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
