import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, CalendarClock, ChevronDown, LogOut, Menu, Radio, Search, User, Wifi, WifiOff, X } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { NotificationInline } from "@/components/ui/notification";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  api,
  getSessionStudent,
  getToken,
  isAuthError,
  setToken,
  type ActivityFeedItem,
  type AgendaLiveState,
  type LiveChatMessage,
  type StudentEnrollmentListItem,
  type StudentOwnedSubmissionListItem,
} from "@/lib/api";
import { UserAvatar } from "@/components/social/UserAvatar";
import SearchDialog from "./SearchDialog";
import { getSaasShowcaseHref } from "@/lib/contest-lab";

const SUBMISSION_APPROVAL_SEEN_STORAGE_KEY = "uor-approved-submissions-seen";
const ENROLLMENT_APPROVAL_SEEN_STORAGE_KEY = "uor-approved-enrollments-seen";
const INTERNAL_BANNER_DISMISS_SIGNATURE_KEY = "uor-internal-approval-banner-dismissed-signature";

const primaryNavItems = [
  { label: "Início", path: "/" },
  { label: "Projetos", path: "/projetos" },
  { label: "Cursos", path: "/cursos" },
  { label: "Agenda", path: "/agenda" },
  { label: "Palestrantes", path: "/palestrantes" },
];

const secondaryNavItems = [
  { label: "Submeter", path: "/submeter" },
  { label: "FAQ", path: "/faq" },
  { label: "Guia", path: "/guia" },
  { label: "Sobre", path: "/sobre" },
  { label: "Regras", path: "/regras" },
];

const allNavItems = [...primaryNavItems, ...secondaryNavItems, { label: "Minha Área", path: "/minha-area" }];

function readSeenIds(storageKey: string) {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return new Set<number>();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set<number>();
    return new Set(parsed.filter((value) => typeof value === "number"));
  } catch {
    return new Set<number>();
  }
}

function writeSeenIds(storageKey: string, ids: Set<number>) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(Array.from(ids)));
  } catch {
    // noop
  }
}

function readDismissedBannerSignature() {
  try {
    return window.localStorage.getItem(INTERNAL_BANNER_DISMISS_SIGNATURE_KEY);
  } catch {
    return null;
  }
}

function writeDismissedBannerSignature(signature: string | null) {
  try {
    if (!signature) {
      window.localStorage.removeItem(INTERNAL_BANNER_DISMISS_SIGNATURE_KEY);
      return;
    }

    window.localStorage.setItem(INTERNAL_BANNER_DISMISS_SIGNATURE_KEY, signature);
  } catch {
    // noop
  }
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function dateTimeLabel(value: string) {
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function agendaWindowLabel(item: AgendaLiveState["current"] | AgendaLiveState["next"]) {
  if (!item) return "Sem bloco definido";
  return `${item.startTime} - ${item.endTime}`;
}

function activityTypeLabel(type: ActivityFeedItem["type"]) {
  switch (type) {
    case "comment":
      return "Comentário";
    case "vote":
      return "Voto";
    case "submission":
      return "Projeto";
    default:
      return "Atualização";
  }
}

function submissionStatusInfo(status: string) {
  switch (status) {
    case "APPROVED":
      return { label: "Aprovado", color: "bg-green-500" };
    case "REJECTED":
      return { label: "Rejeitado", color: "bg-red-500" };
    case "PENDING":
      return { label: "Pendente", color: "bg-yellow-500" };
    default:
      return { label: status, color: "bg-gray-500" };
  }
}

function enrollmentStatusInfo(status: string) {
  switch (status) {
    case "CONFIRMED":
    case "APPROVED":
      return { label: "Confirmado", color: "bg-green-500" };
    case "REJECTED":
      return { label: "Rejeitado", color: "bg-red-500" };
    case "CANCELED":
      return { label: "Cancelado", color: "bg-gray-500" };
    case "PENDING":
      return { label: "Pendente", color: "bg-yellow-500" };
    default:
      return { label: status, color: "bg-gray-500" };
  }
}

function buildUnreadSignature(
  unreadSubmissions: StudentOwnedSubmissionListItem[],
  unreadEnrollments: StudentEnrollmentListItem[],
) {
  return [
    ...unreadSubmissions.map((item) => `s:${item.id}`),
    ...unreadEnrollments.map((item) => `e:${item.id}`),
  ].sort().join("|");
}

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [liveState, setLiveState] = useState<AgendaLiveState | null>(null);
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([]);
  const [liveChatPreview, setLiveChatPreview] = useState<LiveChatMessage[]>([]);
  const [notificationCenterLoading, setNotificationCenterLoading] = useState(false);
  const [notificationCenterError, setNotificationCenterError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const approvalToastSignatureRef = useRef<string | null>(null);

  const [approvedSubmissions, setApprovedSubmissions] = useState<StudentOwnedSubmissionListItem[]>([]);
  const [confirmedEnrollments, setConfirmedEnrollments] = useState<StudentEnrollmentListItem[]>([]);
  const [allSubmissions, setAllSubmissions] = useState<StudentOwnedSubmissionListItem[]>([]);
  const [allEnrollments, setAllEnrollments] = useState<StudentEnrollmentListItem[]>([]);
  const [unreadApprovedSubmissions, setUnreadApprovedSubmissions] = useState<StudentOwnedSubmissionListItem[]>([]);
  const [unreadConfirmedEnrollments, setUnreadConfirmedEnrollments] = useState<StudentEnrollmentListItem[]>([]);
  const [hasUnreadApprovals, setHasUnreadApprovals] = useState(false);
  const [dismissedBannerSignature, setDismissedBannerSignature] = useState<string | null>(() => readDismissedBannerSignature());
  const token = getToken();

  const hasSubmissionApprovals = approvedSubmissions.length > 0;
  const hasEnrollmentApprovals = confirmedEnrollments.length > 0;
  const hasApprovalNotifications = hasSubmissionApprovals || hasEnrollmentApprovals;
  const unreadApprovalsCount = unreadApprovedSubmissions.length + unreadConfirmedEnrollments.length;

  useEffect(() => {
    let active = true;

    if (!token) {
      setAllSubmissions([]);
      setAllEnrollments([]);
      setApprovedSubmissions([]);
      setConfirmedEnrollments([]);
      setUnreadApprovedSubmissions([]);
      setUnreadConfirmedEnrollments([]);
      setHasUnreadApprovals(false);
      setDismissedBannerSignature(readDismissedBannerSignature());
      approvalToastSignatureRef.current = null;
      return () => {
        active = false;
      };
    }

    Promise.all([api.submissions.mine(), api.courses.enrollmentsMine()])
      .then(([submissionItems, enrollmentItems]) => {
        if (!active) return;

        setAllSubmissions(submissionItems);
        setAllEnrollments(enrollmentItems);

        const approved = submissionItems.filter((item) => item.status === "APPROVED");
        const confirmed = enrollmentItems.filter((item) => item.paymentStatus === "CONFIRMED" || item.paymentStatus === "APPROVED");

        setApprovedSubmissions(approved);
        setConfirmedEnrollments(confirmed);

        const seenSubmissions = readSeenIds(SUBMISSION_APPROVAL_SEEN_STORAGE_KEY);
        const seenEnrollments = readSeenIds(ENROLLMENT_APPROVAL_SEEN_STORAGE_KEY);
        const unreadSubmissions = approved.filter((item) => !seenSubmissions.has(item.id));
        const unreadEnrollments = confirmed.filter((item) => !seenEnrollments.has(item.id));

        setUnreadApprovedSubmissions(unreadSubmissions);
        setUnreadConfirmedEnrollments(unreadEnrollments);
        setHasUnreadApprovals(unreadSubmissions.length + unreadEnrollments.length > 0);
        setDismissedBannerSignature(readDismissedBannerSignature());

        const unreadSignature = buildUnreadSignature(unreadSubmissions, unreadEnrollments);
        if (!unreadSignature || unreadSignature === approvalToastSignatureRef.current) {
          if (!unreadSignature) {
            approvalToastSignatureRef.current = null;
          }
          return;
        }

        approvalToastSignatureRef.current = unreadSignature;

        if (unreadSubmissions.length === 1 && unreadEnrollments.length === 0) {
          const item = unreadSubmissions[0];
          toast.success(`A tua candidatura "${item.name}" foi aprovada. Já podes gerir alterações na Minha Área.`);
          return;
        }

        if (unreadSubmissions.length === 0 && unreadEnrollments.length === 1) {
          const item = unreadEnrollments[0];
          toast.success(`A tua inscrição no curso "${item.courseName}" foi confirmada. Abre a Minha Área para continuar.`);
          return;
        }

        if (unreadSubmissions.length + unreadEnrollments.length > 1) {
          toast.success(
            `Tens ${unreadSubmissions.length + unreadEnrollments.length} novas aprovações. Acede à Minha Área para gerir submissões e inscrições.`,
          );
        }
      })
      .catch((error) => {
        if (!active) return;

        if (isAuthError(error)) {
          setToken(null);
          setAllSubmissions([]);
          setAllEnrollments([]);
          setApprovedSubmissions([]);
          setConfirmedEnrollments([]);
          setUnreadApprovedSubmissions([]);
          setUnreadConfirmedEnrollments([]);
          setHasUnreadApprovals(false);
          approvalToastSignatureRef.current = null;
        }
      });

    return () => {
      active = false;
    };
  }, [location.hash, location.pathname, location.search, token]);

  useEffect(() => {
    const syncNetworkState = () => {
      setIsOnline(window.navigator.onLine);
    };

    window.addEventListener("online", syncNetworkState);
    window.addEventListener("offline", syncNetworkState);

    return () => {
      window.removeEventListener("online", syncNetworkState);
      window.removeEventListener("offline", syncNetworkState);
    };
  }, []);

  useEffect(() => {
    if (!notificationOpen) return;

    let active = true;
    setNotificationCenterLoading(true);
    setNotificationCenterError(null);

    Promise.all([
      api.agenda.live(),
      api.interactions.activityFeed(),
      api.interactions.liveChat(),
    ])
      .then(([live, activityItems, liveChatItems]) => {
        if (!active) return;
        setLiveState(live);
        setActivityFeed(activityItems.slice(0, 6));
        setLiveChatPreview(liveChatItems.slice(0, 5));
      })
      .catch((error) => {
        if (!active) return;
        setNotificationCenterError(
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar a agenda ao vivo e as interações agora.",
        );
      })
      .finally(() => {
        if (!active) return;
        setNotificationCenterLoading(false);
      });

    return () => {
      active = false;
    };
  }, [notificationOpen]);

  const student = useMemo(() => getSessionStudent(), [token]);

  useEffect(() => {
    setOpen(false);
    setNotificationOpen(false);
    setMoreOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname, location.search, location.hash]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadSignature = useMemo(
    () => buildUnreadSignature(unreadApprovedSubmissions, unreadConfirmedEnrollments),
    [unreadApprovedSubmissions, unreadConfirmedEnrollments],
  );

  const showInternalApprovalBanner = unreadSignature.length > 0 && dismissedBannerSignature !== unreadSignature;

  const markApprovalNotificationsAsRead = () => {
    if (!approvedSubmissions.length && !confirmedEnrollments.length) return;

    const seenSubmissions = readSeenIds(SUBMISSION_APPROVAL_SEEN_STORAGE_KEY);
    const seenEnrollments = readSeenIds(ENROLLMENT_APPROVAL_SEEN_STORAGE_KEY);

    for (const submission of approvedSubmissions) {
      seenSubmissions.add(submission.id);
    }

    for (const enrollment of confirmedEnrollments) {
      seenEnrollments.add(enrollment.id);
    }

    writeSeenIds(SUBMISSION_APPROVAL_SEEN_STORAGE_KEY, seenSubmissions);
    writeSeenIds(ENROLLMENT_APPROVAL_SEEN_STORAGE_KEY, seenEnrollments);
    writeDismissedBannerSignature(null);
    setDismissedBannerSignature(null);
    setUnreadApprovedSubmissions([]);
    setUnreadConfirmedEnrollments([]);
    setHasUnreadApprovals(false);
  };

  const handleToggleNotifications = () => {
    setNotificationOpen((current) => {
      const next = !current;
      if (next && unreadApprovalsCount > 0) {
        markApprovalNotificationsAsRead();
      }
      return next;
    });
  };

  const handleDismissInternalBanner = () => {
    if (!unreadSignature) return;
    writeDismissedBannerSignature(unreadSignature);
    setDismissedBannerSignature(unreadSignature);
  };

  const internalBannerMessage = useMemo(() => {
    const submissionsCount = unreadApprovedSubmissions.length;
    const enrollmentsCount = unreadConfirmedEnrollments.length;

    if (submissionsCount && !enrollmentsCount) {
      return submissionsCount === 1
        ? "Uma candidatura tua foi aprovada. Já podes atualizar os elementos permitidos na tua área."
        : `${submissionsCount} candidaturas tuas foram aprovadas. Já podes gerir alterações permitidas na tua área.`;
    }

    if (!submissionsCount && enrollmentsCount) {
      return enrollmentsCount === 1
        ? "Uma inscrição de curso foi confirmada. Já podes continuar a gestão na tua área."
        : `${enrollmentsCount} inscrições de curso foram confirmadas. Já podes continuar a gestão na tua área.`;
    }

	    return `Tens ${submissionsCount + enrollmentsCount} aprovações novas entre candidaturas e cursos.`;
	  }, [unreadApprovedSubmissions.length, unreadConfirmedEnrollments.length]);

  return (
    <>
      <Sheet open={notificationOpen} onOpenChange={setNotificationOpen}>
        <SheetContent side="right" className="w-full border-l border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] p-0 sm:max-w-xl">
          <div className="flex h-full flex-col">
            <SheetHeader className="border-b border-border/60 bg-white/90 px-6 py-5 text-left">
              <div className="flex items-start gap-3 pr-8">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Bell className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <SheetTitle className="text-left text-xl font-semibold text-slate-950">Centro de notificações</SheetTitle>
                  <SheetDescription className="mt-1 text-left text-sm text-slate-600">
                    Estado ao vivo do evento, movimento da comunidade e os teus fluxos académicos.
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              {!isOnline ? (
                <NotificationInline
                  tone="warning"
                  title="Ligação instável ou indisponível"
                  message="O centro continua acessível, mas a atualização de agenda, chat e atividade pode ficar atrasada até a rede estabilizar."
                />
              ) : null}

              {unreadApprovalsCount > 0 ? (
                <NotificationInline
                  tone="success"
                  title={unreadApprovalsCount === 1 ? "Tens 1 aprovação nova" : `Tens ${unreadApprovalsCount} aprovações novas`}
                  message="As candidaturas aprovadas e as confirmações de curso já podem ser geridas na tua área pessoal."
                />
              ) : null}

              {liveState?.current ? (
                <NotificationInline
                  tone="info"
                  title={`Ao vivo agora: ${liveState.current.title}`}
                  message={`${liveState.current.local} • ${agendaWindowLabel(liveState.current)}`}
                />
              ) : null}

              {notificationCenterError ? (
                <NotificationInline
                  tone="warning"
                  title="Nem todas as notificações puderam ser atualizadas"
                  message={notificationCenterError}
                />
              ) : null}

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Resumo rápido</p>
                    <p className="text-xs text-slate-500">O que está a acontecer agora no ecossistema.</p>
                  </div>
                  {notificationCenterLoading ? (
                    <span className="text-xs font-medium text-slate-500">A atualizar...</span>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-border/60 bg-white/90 p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {isOnline ? <Wifi className="h-4 w-4 text-emerald-600" /> : <WifiOff className="h-4 w-4 text-amber-600" />}
                      Ligação
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-900">{isOnline ? "Online e sincronizado" : "Offline ou intermitente"}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {isOnline
                        ? "Os dados do backend podem ser atualizados sem recarregar a aplicação."
                        : "A interface mantém-se, mas algumas ações podem aguardar reconexão."}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-white/90 p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      <Radio className="h-4 w-4 text-rose-600" />
                      Agora
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-900">
                      {liveState?.current ? liveState.current.title : "Sem sessão ao vivo neste instante"}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {liveState?.current
                        ? `${liveState.current.local} • ${agendaWindowLabel(liveState.current)}`
                        : "Abre a área Ao Vivo para acompanhar assim que o próximo bloco arrancar."}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-white/90 p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      <CalendarClock className="h-4 w-4 text-sky-600" />
                      Próximo
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-900">
                      {liveState?.next ? liveState.next.title : "Sem próximo bloco definido"}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {liveState?.next
                        ? `${liveState.next.local} • ${agendaWindowLabel(liveState.next)}`
                        : "A agenda ao vivo volta a preencher este espaço quando houver nova programação."}
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Atividade da comunidade</p>
                    <p className="text-xs text-slate-500">Comentários, votos e projetos aprovados recentemente.</p>
                  </div>
                  <Link
                    to="/projetos"
                    onClick={() => setNotificationOpen(false)}
                    className="text-xs font-semibold text-primary transition-colors hover:text-primary/80"
                  >
                    Ver projetos
                  </Link>
                </div>

                {activityFeed.length > 0 ? (
                  <div className="space-y-3">
                    {activityFeed.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-border/60 bg-white/90 p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900">{item.actorName}</p>
                            <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                              {activityTypeLabel(item.type)} • {dateTimeLabel(item.createdAt)}
                            </p>
                          </div>
                          <span className="rounded-full border border-border/70 bg-muted/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                            {item.subject}
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-700">{item.message}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-white/80 p-4 text-sm text-slate-500">
                    Ainda não existem interações recentes para mostrar nesta sessão.
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Chat ao vivo</p>
                    <p className="text-xs text-slate-500">Mensagens recentes da comunidade enquanto o evento decorre.</p>
                  </div>
                  <Link
                    to="/ao-vivo"
                    onClick={() => setNotificationOpen(false)}
                    className="text-xs font-semibold text-primary transition-colors hover:text-primary/80"
                  >
                    Abrir ao vivo
                  </Link>
                </div>

                {liveChatPreview.length > 0 ? (
                  <div className="space-y-3">
                    {liveChatPreview.map((message) => (
                      <div key={message.id} className="rounded-2xl border border-border/60 bg-white/90 p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900">{message.studentName}</p>
                            <p className="mt-1 text-xs text-slate-500">{dateTimeLabel(message.createdAt)}</p>
                          </div>
                          {message.course ? (
                            <span className="rounded-full border border-border/70 bg-muted/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                              {message.course}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-700">{message.content}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-white/80 p-4 text-sm text-slate-500">
                    Ainda não há mensagens recentes do chat ao vivo para mostrar.
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Minha área</p>
                    <p className="text-xs text-slate-500">Candidaturas e cursos ligados à tua conta.</p>
                  </div>
                  {token ? (
                    <Link
                      to="/minha-area"
                      onClick={() => setNotificationOpen(false)}
                      className="text-xs font-semibold text-primary transition-colors hover:text-primary/80"
                    >
                      Abrir Minha Área
                    </Link>
                  ) : null}
                </div>

                {token ? (
                  <div className="space-y-3">
                    {allSubmissions.length === 0 && allEnrollments.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border/70 bg-white/80 p-4 text-sm text-slate-500">
                        Ainda não tens candidaturas ou inscrições registadas para mostrar aqui.
                      </div>
                    ) : null}

                    {allSubmissions.slice(0, 4).map((submission) => {
                      const status = submissionStatusInfo(submission.status);
                      return (
                        <div key={`sheet-submission-${submission.id}`} className="rounded-2xl border border-border/60 bg-white/90 p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900">{submission.name}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {submission.typeLabel} • {dateLabel(submission.createdAt)}
                              </p>
                            </div>
                            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${status.color}`} />
                          </div>
                          <p className="mt-3 text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Estado: {status.label}</p>
                        </div>
                      );
                    })}

                    {allEnrollments.slice(0, 4).map((enrollment) => {
                      const status = enrollmentStatusInfo(enrollment.paymentStatus);
                      return (
                        <div key={`sheet-enrollment-${enrollment.id}`} className="rounded-2xl border border-border/60 bg-white/90 p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900">{enrollment.courseName}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {enrollment.companyName} • {dateLabel(enrollment.enrolledAt)}
                              </p>
                            </div>
                            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${status.color}`} />
                          </div>
                          <p className="mt-3 text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Estado: {status.label}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-white/80 p-4 text-sm text-slate-500">
                    Inicia sessão para receber aqui aprovações de cursos, candidaturas e permissões de edição na tua conta.
                  </div>
                )}
              </section>
            </div>

            <div className="grid gap-2 border-t border-border/60 bg-white/90 px-6 py-4 sm:grid-cols-3">
              <Link
                to="/ao-vivo"
                onClick={() => setNotificationOpen(false)}
                className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Ao vivo
              </Link>
              <Link
                to="/agenda"
                onClick={() => setNotificationOpen(false)}
                className="inline-flex items-center justify-center rounded-xl border border-border/70 bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted/30"
              >
                Agenda
              </Link>
              <Link
                to={token ? "/minha-area" : "/login"}
                onClick={() => setNotificationOpen(false)}
                className="inline-flex items-center justify-center rounded-xl border border-border/70 bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted/30"
              >
                {token ? "Minha Área" : "Entrar"}
              </Link>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <nav className="sticky top-0 z-50 border-b border-border/45 bg-white/68 shadow-sm backdrop-blur-2xl supports-[backdrop-filter]:bg-white/52">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <Link to="/" className="flex items-center gap-2.5">
              <img src="/logoworconnect.png" alt="UOR Connect" className="h-9 md:h-10" />
            </Link>
          </div>

          <div className="hidden xl:flex items-center gap-1">
            {primaryNavItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-200 ${
                  location.pathname === item.path
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                {item.label}
              </Link>
            ))}

            {/* Mais dropdown */}
            <div ref={moreRef} className="relative">
              <button
                onClick={() => setMoreOpen(!moreOpen)}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-200 ${
                  secondaryNavItems.some((i) => location.pathname === i.path)
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                Mais
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${moreOpen ? "rotate-180" : ""}`} />
              </button>
              {moreOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-48 rounded-xl border border-border/60 bg-white p-1.5 shadow-lg">
                  {secondaryNavItems.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMoreOpen(false)}
                      className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        location.pathname === item.path
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <a
              href={getSaasShowcaseHref("/")}
              className="ml-1 inline-flex shrink-0 items-center whitespace-nowrap rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:-translate-y-px hover:bg-primary/90"
            >
              Marcar evento
            </a>
          </div>

          <div className="relative flex items-center gap-1">
            <button
              onClick={() => setSearchOpen(true)}
              className="rounded-lg p-2 transition-colors hover:bg-secondary"
              aria-label="Pesquisar"
            >
              <Search className="h-[18px] w-[18px] text-muted-foreground" />
            </button>

            <button
              onClick={handleToggleNotifications}
              className="relative rounded-lg p-2 transition-colors hover:bg-secondary"
              aria-label="Centro de notificações"
            >
              <Bell className="h-[18px] w-[18px] text-muted-foreground" />
              {hasUnreadApprovals ? (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[hsl(var(--success))] ring-2 ring-white" />
              ) : null}
            </button>

            {/* User avatar / login */}
            {token && student ? (
              <div ref={userMenuRef} className="relative hidden sm:block">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-secondary"
                >
                  <UserAvatar name={student.name || student.studentNumber} size="sm" />
                  <span className="hidden text-sm font-medium text-foreground lg:block">
                    {student.name?.split(" ")[0] || student.studentNumber}
                  </span>
                  <ChevronDown className={`hidden h-3.5 w-3.5 text-muted-foreground transition-transform lg:block ${userMenuOpen ? "rotate-180" : ""}`} />
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-52 rounded-xl border border-border/60 bg-white p-1.5 shadow-lg">
                    <div className="mb-1.5 border-b border-border/50 px-3 py-2">
                      <p className="text-sm font-semibold text-foreground">{student.name || "Estudante"}</p>
                      <p className="text-xs text-muted-foreground">{student.studentNumber}</p>
                    </div>
                    <Link
                      to="/minha-area"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      <User className="h-4 w-4" />
                      Minha Área
                    </Link>
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        setToken(null);
                        navigate("/");
                        toast.success("Sessão terminada com sucesso.");
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <LogOut className="h-4 w-4" />
                      Sair
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                className="hidden items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:inline-flex"
              >
                Entrar
              </Link>
            )}

            <button onClick={() => setOpen(!open)} className="xl:hidden rounded-lg p-2 hover:bg-secondary" aria-label="Menu">
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {showInternalApprovalBanner ? (
          <div className="border-t border-primary/20 bg-[linear-gradient(90deg,rgba(253,131,5,0.14),rgba(0,184,148,0.12))] px-4 py-2.5">
            <div className="container mx-auto flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-medium text-slate-800 sm:text-sm">{internalBannerMessage}</p>
              <div className="flex items-center gap-2">
                <Link
                  to="/minha-area"
                  className="inline-flex items-center rounded-lg border border-primary/25 bg-white/70 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-white"
                >
                  Abrir Minha Área
                </Link>
                <button
                  type="button"
                  onClick={handleDismissInternalBanner}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-black/5 hover:text-slate-900"
                  aria-label="Dispensar aviso interno"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {open ? (
          <div className="xl:hidden border-t border-border/60 bg-white/90 px-4 pb-3 pt-2 backdrop-blur-2xl">
            {primaryNavItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setOpen(false)}
                className={`block rounded-lg px-3 py-2.5 text-sm font-medium ${
                  location.pathname === item.path
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <div className="my-1.5 h-px bg-border/50" />
            <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Mais</p>
            {secondaryNavItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setOpen(false)}
                className={`block rounded-lg px-3 py-2.5 text-sm font-medium ${
                  location.pathname === item.path
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <div className="my-1.5 h-px bg-border/50" />
            {token ? (
              <Link
                to="/minha-area"
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium ${
                  location.pathname === "/minha-area"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary"
                }`}
              >
                {student ? <UserAvatar name={student.name || student.studentNumber} size="sm" /> : <User className="h-4 w-4" />}
                Minha Área
              </Link>
            ) : (
              <Link
                to="/login"
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary"
              >
                Entrar
              </Link>
            )}
            <a
              href={getSaasShowcaseHref("/")}
              onClick={() => setOpen(false)}
              className="mt-2 block rounded-lg bg-primary px-3 py-2.5 text-center text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Marcar evento
            </a>
          </div>
        ) : null}
      </nav>

      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
