import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Bell, CalendarClock, ChevronDown, LogOut, Menu, Search, User, X } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  api,
  getSessionStudent,
  getToken,
  isAuthError,
  setToken,
  type AgendaLiveState,
  type StudentEnrollmentListItem,
  type StudentOwnedSubmissionListItem,
} from "@/lib/api";
import { UserAvatar } from "@/components/social/UserAvatar";
import SearchDialog from "./SearchDialog";
import { getSaasShowcaseHref } from "@/lib/contest-lab";

const SUBMISSION_APPROVAL_SEEN_STORAGE_KEY = "uor-approved-submissions-seen";
const ENROLLMENT_APPROVAL_SEEN_STORAGE_KEY = "uor-approved-enrollments-seen";
const SUBMISSION_APPROVAL_ANNOUNCED_STORAGE_KEY = "uor-approved-submissions-announced";
const ENROLLMENT_APPROVAL_ANNOUNCED_STORAGE_KEY = "uor-approved-enrollments-announced";

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

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function agendaWindowLabel(item: AgendaLiveState["current"] | AgendaLiveState["next"]) {
  if (!item) return "Sem bloco definido";
  return `${item.startTime} - ${item.endTime}`;
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
  const [notificationCenterLoading, setNotificationCenterLoading] = useState(false);
  const [notificationCenterError, setNotificationCenterError] = useState<string | null>(null);
  const approvalToastSignatureRef = useRef<string | null>(null);

  const [approvedSubmissions, setApprovedSubmissions] = useState<StudentOwnedSubmissionListItem[]>([]);
  const [confirmedEnrollments, setConfirmedEnrollments] = useState<StudentEnrollmentListItem[]>([]);
  const [unreadApprovedSubmissions, setUnreadApprovedSubmissions] = useState<StudentOwnedSubmissionListItem[]>([]);
  const [unreadConfirmedEnrollments, setUnreadConfirmedEnrollments] = useState<StudentEnrollmentListItem[]>([]);
  const [hasUnreadApprovals, setHasUnreadApprovals] = useState(false);
  const token = getToken();

  const hasSubmissionApprovals = approvedSubmissions.length > 0;
  const hasEnrollmentApprovals = confirmedEnrollments.length > 0;
  const hasApprovalNotifications = hasSubmissionApprovals || hasEnrollmentApprovals;
  const unreadApprovalsCount = unreadApprovedSubmissions.length + unreadConfirmedEnrollments.length;

  useEffect(() => {
    let active = true;

    if (!token) {
      setApprovedSubmissions([]);
      setConfirmedEnrollments([]);
      setUnreadApprovedSubmissions([]);
      setUnreadConfirmedEnrollments([]);
      setHasUnreadApprovals(false);
      approvalToastSignatureRef.current = null;
      return () => {
        active = false;
      };
    }

    Promise.all([api.submissions.mine(), api.courses.enrollmentsMine()])
      .then(([submissionItems, enrollmentItems]) => {
        if (!active) return;

        const approved = submissionItems.filter((item) => item.status === "APPROVED");
        const confirmed = enrollmentItems.filter((item) => item.paymentStatus === "CONFIRMED" || item.paymentStatus === "APPROVED");

        setApprovedSubmissions(approved);
        setConfirmedEnrollments(confirmed);

        const seenSubmissions = readSeenIds(SUBMISSION_APPROVAL_SEEN_STORAGE_KEY);
        const seenEnrollments = readSeenIds(ENROLLMENT_APPROVAL_SEEN_STORAGE_KEY);
        const announcedSubmissions = readSeenIds(SUBMISSION_APPROVAL_ANNOUNCED_STORAGE_KEY);
        const announcedEnrollments = readSeenIds(ENROLLMENT_APPROVAL_ANNOUNCED_STORAGE_KEY);
        const unreadSubmissions = approved.filter((item) => !seenSubmissions.has(item.id));
        const unreadEnrollments = confirmed.filter((item) => !seenEnrollments.has(item.id));
        const announceableSubmissions = unreadSubmissions.filter((item) => !announcedSubmissions.has(item.id));
        const announceableEnrollments = unreadEnrollments.filter((item) => !announcedEnrollments.has(item.id));

        setUnreadApprovedSubmissions(unreadSubmissions);
        setUnreadConfirmedEnrollments(unreadEnrollments);
        setHasUnreadApprovals(unreadSubmissions.length + unreadEnrollments.length > 0);

        const announcementSignature = buildUnreadSignature(announceableSubmissions, announceableEnrollments);
        if (!announcementSignature || announcementSignature === approvalToastSignatureRef.current) {
          if (!announcementSignature) {
            approvalToastSignatureRef.current = null;
          }
          return;
        }

        approvalToastSignatureRef.current = announcementSignature;

        for (const submission of announceableSubmissions) {
          announcedSubmissions.add(submission.id);
        }

        for (const enrollment of announceableEnrollments) {
          announcedEnrollments.add(enrollment.id);
        }

        writeSeenIds(SUBMISSION_APPROVAL_ANNOUNCED_STORAGE_KEY, announcedSubmissions);
        writeSeenIds(ENROLLMENT_APPROVAL_ANNOUNCED_STORAGE_KEY, announcedEnrollments);

        if (announceableSubmissions.length === 1 && announceableEnrollments.length === 0) {
          const item = announceableSubmissions[0];
          toast.success(`Candidatura aprovada: ${item.name}`);
          return;
        }

        if (announceableSubmissions.length === 0 && announceableEnrollments.length === 1) {
          const item = announceableEnrollments[0];
          toast.success(`Inscrição confirmada: ${item.courseName}`);
          return;
        }

        if (announceableSubmissions.length + announceableEnrollments.length > 1) {
          toast.success(`${announceableSubmissions.length + announceableEnrollments.length} novas aprovações.`);
        }
      })
      .catch((error) => {
        if (!active) return;

        if (isAuthError(error)) {
          setToken(null);
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
    if (!notificationOpen) return;

    let active = true;
    setNotificationCenterLoading(true);
    setNotificationCenterError(null);

    api.agenda.live()
      .then((live) => {
        if (!active) return;
        setLiveState(live);
      })
      .catch((error) => {
        if (!active) return;
        setNotificationCenterError(
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar as notificações agora.",
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

  const student = getSessionStudent();
  const isAuthenticated = Boolean(token);
  const accountHref = isAuthenticated ? "/minha-area" : "/login";
  const accountLabel = isAuthenticated ? "Minha Área" : "Entrar";
  const accountName = student?.name?.split(" ")[0] || student?.studentNumber || "Minha Área";
  const accountAvatarName = student?.name || student?.studentNumber || "Conta UOR";

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

  return (
    <>
      <Sheet open={notificationOpen} onOpenChange={setNotificationOpen}>
        <SheetContent side="right" className="w-full border-l border-border/60 bg-white p-0 sm:max-w-md">
          <div className="flex h-full flex-col">
            <SheetHeader className="border-b border-border/60 px-5 py-5 text-left">
              <div className="flex items-start gap-3 pr-8">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Bell className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <SheetTitle className="text-left text-xl font-semibold text-slate-950">Notificações</SheetTitle>
                  <SheetDescription className="mt-1 text-left text-sm text-slate-600">Atualizações essenciais.</SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
              {notificationCenterLoading ? (
                <p className="text-xs font-medium text-slate-500">A atualizar...</p>
              ) : null}

              {notificationCenterError ? (
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-800">
                  {notificationCenterError}
                </div>
              ) : null}

              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-slate-950">Agenda</p>
                </div>

                {liveState?.current || liveState?.next ? (
                  <div className="space-y-2">
                    {liveState.current ? (
                      <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Agora</p>
                        <p className="mt-1 text-sm font-semibold text-slate-950">{liveState.current.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{liveState.current.local} · {agendaWindowLabel(liveState.current)}</p>
                      </div>
                    ) : null}

                    {liveState.next ? (
                      <div className="rounded-xl border border-border/60 bg-white p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Próximo</p>
                        <p className="mt-1 text-sm font-semibold text-slate-950">{liveState.next.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{liveState.next.local} · {agendaWindowLabel(liveState.next)}</p>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border/70 p-3 text-sm text-slate-500">
                    Sem agenda ativa.
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-950">Conta</p>
                  {isAuthenticated ? (
                    <Link
                      to={accountHref}
                      onClick={() => setNotificationOpen(false)}
                      className="text-xs font-semibold text-primary transition-colors hover:text-primary/80"
                    >
                      Abrir
                    </Link>
                  ) : null}
                </div>

                {isAuthenticated ? (
                  <div className="space-y-2">
                    {!hasApprovalNotifications ? (
                      <div className="rounded-xl border border-dashed border-border/70 p-3 text-sm text-slate-500">
                        Sem aprovações novas.
                      </div>
                    ) : null}

                    {approvedSubmissions.slice(0, 4).map((submission) => (
                      <Link
                        key={`sheet-submission-${submission.id}`}
                        to={submission.receiptPath || "/minha-area"}
                        onClick={() => setNotificationOpen(false)}
                        className="block rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-3 transition-colors hover:bg-emerald-500/[0.08]"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">Candidatura aprovada</p>
                        <p className="mt-1 text-sm font-semibold text-slate-950">{submission.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{submission.typeLabel} · {dateLabel(submission.createdAt)}</p>
                      </Link>
                    ))}

                    {confirmedEnrollments.slice(0, 4).map((enrollment) => (
                      <Link
                        key={`sheet-enrollment-${enrollment.id}`}
                        to={enrollment.receiptPath || "/minha-area"}
                        onClick={() => setNotificationOpen(false)}
                        className="block rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-3 transition-colors hover:bg-emerald-500/[0.08]"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">Inscrição confirmada</p>
                        <p className="mt-1 text-sm font-semibold text-slate-950">{enrollment.courseName}</p>
                        <p className="mt-1 text-xs text-slate-500">{enrollment.companyName} · {dateLabel(enrollment.enrolledAt)}</p>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border/70 p-3 text-sm text-slate-500">
                    Entra para ver aprovações.
                  </div>
                )}
              </section>
            </div>

            <div className="grid gap-2 border-t border-border/60 px-5 py-4 sm:grid-cols-2">
              <Link
                to="/agenda"
                onClick={() => setNotificationOpen(false)}
                className="inline-flex items-center justify-center rounded-xl border border-border/70 bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted/30"
              >
                Agenda
              </Link>
              <Link
                to={accountHref}
                onClick={() => setNotificationOpen(false)}
                className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {accountLabel}
              </Link>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <nav className="sticky top-0 z-50 border-b border-border/45 bg-white/68 shadow-sm backdrop-blur-2xl supports-[backdrop-filter]:bg-white/52">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <Link to="/" className="flex items-center gap-2.5">
              <img src="/uorconnect-logo-navbar.png" alt="UOR Connect" className="h-9 w-auto max-w-[112px] object-contain sm:h-10 sm:max-w-[150px] md:h-12 md:max-w-[180px]" />
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
              className="inline-flex shrink-0 items-center whitespace-nowrap rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:-translate-y-px hover:bg-primary/90"
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

            <Link
              to={accountHref}
              className={`inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold shadow-sm transition-colors sm:hidden ${
                location.pathname === "/minha-area"
                  ? "bg-primary text-primary-foreground"
                  : "border border-primary/20 bg-primary/10 text-primary hover:bg-primary/15"
              }`}
            >
              <User className="h-3.5 w-3.5" />
              <span>{accountLabel}</span>
            </Link>

            {/* User avatar / login */}
            {isAuthenticated ? (
              <div ref={userMenuRef} className="relative hidden sm:block">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-secondary"
                >
                  {student ? (
                    <UserAvatar name={accountAvatarName} size="sm" />
                  ) : (
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-primary">
                      <User className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <span className="hidden text-sm font-medium text-foreground lg:block">
                    {accountName}
                  </span>
                  <ChevronDown className={`hidden h-3.5 w-3.5 text-muted-foreground transition-transform lg:block ${userMenuOpen ? "rotate-180" : ""}`} />
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-52 rounded-xl border border-border/60 bg-white p-1.5 shadow-lg">
                    <div className="mb-1.5 border-b border-border/50 px-3 py-2">
                      <p className="text-sm font-semibold text-foreground">{student?.name || "Sessão ativa"}</p>
                      <p className="text-xs text-muted-foreground">{student?.studentNumber || "Conta autenticada"}</p>
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
            {isAuthenticated ? (
              <Link
                to={accountHref}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium ${
                  location.pathname === "/minha-area"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary"
                }`}
              >
                {student ? <UserAvatar name={accountAvatarName} size="sm" /> : <User className="h-4 w-4" />}
                {accountLabel}
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
