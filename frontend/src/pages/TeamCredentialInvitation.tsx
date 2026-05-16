import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  BadgeCheck,
  BriefcaseBusiness,
  Camera,
  CheckCircle2,
  Download,
  ExternalLink,
  FileBadge2,
  Globe2,
  GraduationCap,
  Github,
  Home,
  Instagram,
  Linkedin,
  Loader2,
  Lock,
  Mail,
  Phone,
  QrCode,
  Rocket,
  Shield,
  ShieldAlert,
  ShieldCheck,
  IdCard,
  UserRound,
  Users,
  Fingerprint,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { StudentLoginForm } from "@/components/auth/StudentLoginForm";
import { ApiError, api, getToken, setToken, type ExpositorContextResponse, type ExpositorSubmissionItem, type TeamCredentialMember, type TeamCredentialNucleusContext, type TeamCredentialPublicSubmission, type TeamMembershipClaim } from "@/lib/api";
import { readCompressedImageFileAsDataUrl } from "@/lib/project-media";
import { downloadBlobFile } from "@/lib/student-documents";

const readyTeamCredentialStatuses = new Set(["PROFILE_READY", "ACTIVE", "ISSUED"]);

function isTeamCredentialReadyStatus(status?: string | null) {
  return Boolean(status && readyTeamCredentialStatuses.has(status));
}

type CredentialForm = TeamCredentialPublicSubmission;

const emptyForm: CredentialForm = {
  name: "",
  email: "",
  phone: "",
  course: "",
  organization: "",
  bio: "",
  photoUrl: "",
  address: "",
  instagramUrl: "",
  facebookUrl: "",
  linkedinUrl: "",
  githubUrl: "",
  websiteUrl: "",
  consentPhotoCredential: false,
  consentPublicProfile: false,
  consentSocialLinks: false,
  consentSms: false,
  consentWhatsapp: false,
};

const profileSteps = [
  { label: "Identidade", fields: ["name", "photoUrl"] },
  { label: "Contexto", fields: ["course", "organization"] },
] as const;

function profileCompletion(form: CredentialForm) {
  const filled = profileSteps.filter((step) =>
    step.fields.some((field) => {
      const value = form[field as keyof CredentialForm];
      return typeof value === "string" && value.trim().length > 0;
    }),
  ).length;
  return Math.round((filled / profileSteps.length) * 100);
}

function normalizeSocialUrl(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function initials(value?: string | null) {
  const parts = value?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return "UC";
  return `${parts[0]?.[0] ?? "U"}${parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : ""}`.toUpperCase();
}

function fileNameFromMember(member: TeamCredentialMember) {
  return `Passe_${(member.name || member.publicSlug).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_")}.pdf`;
}

function currentProfileUrl(member: TeamCredentialMember) {
  if (typeof window === "undefined") return member.profileUrl;
  return new URL(`/equipa/perfil/${encodeURIComponent(member.publicSlug)}`, window.location.origin).toString();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-AO", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

const ease: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function TeamCredentialInvitation() {
  const { token = "" } = useParams();
  const [member, setMember] = useState<TeamCredentialMember | null>(null);
  const [form, setForm] = useState<CredentialForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [hasStudentSession, setHasStudentSession] = useState(Boolean(getToken()));
  const [studentSessionNotice, setStudentSessionNotice] = useState<string | null>(null);
  const [nucleusContext, setNucleusContext] = useState<TeamCredentialNucleusContext | null>(null);
  const [nucleusContextLoading, setNucleusContextLoading] = useState(false);
  const [nucleusContextError, setNucleusContextError] = useState<string | null>(null);
  const [selectedNucleusAreaKey, setSelectedNucleusAreaKey] = useState("");
  const [selectedNucleusFunctionKey, setSelectedNucleusFunctionKey] = useState("");
  const [nucleusClaim, setNucleusClaim] = useState<TeamMembershipClaim | null>(null);
  const [expositorContext, setExpositorContext] = useState<ExpositorContextResponse | null>(null);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<number | null>(null);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Credencial do Nucleo | UOR Connect";
    return () => {
      document.title = previousTitle;
    };
  }, []);

  // Load the invitation metadata (no auth required for this)
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    api.teamCredentials.invitation(token)
      .then((payload) => {
        if (!active) return;
        setMember(payload);
        setForm({
          name: payload.name ?? "",
          email: payload.email ?? "",
          phone: payload.phone ?? "",
          course: payload.course ?? "",
          organization: payload.organization ?? "",
          bio: payload.bio ?? "",
          photoUrl: payload.photoUrl ?? "",
          address: payload.address ?? "",
          instagramUrl: payload.instagramUrl ?? "",
          facebookUrl: payload.facebookUrl ?? "",
          linkedinUrl: payload.linkedinUrl ?? "",
          githubUrl: payload.githubUrl ?? "",
          websiteUrl: payload.websiteUrl ?? "",
          consentPhotoCredential: payload.consentPhotoCredential ?? false,
          consentPublicProfile: payload.consentPublicProfile ?? false,
          consentSocialLinks: payload.consentSocialLinks ?? false,
          consentSms: payload.consentSms ?? false,
          consentWhatsapp: payload.consentWhatsapp ?? false,
        });
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Convite nao encontrado.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  const isExpositor = member?.category === "EXPOSITOR";
  // Once logged in, fetch the operational context for Nucleus possession or exhibitor credential.
  useEffect(() => {
    if (!member || !hasStudentSession) return;

    let active = true;
    setNucleusContextLoading(true);
    setNucleusContextError(null);

    const contextPromise = isExpositor
      ? api.teamCredentials.expositorContext(token).then((ctx) => {
          if (!active) return;
          setExpositorContext(ctx);
          setSelectedSubmissionId(ctx.suggestedSubmissionId);
          setForm((current) => ({
            ...current,
            name: ctx.student.name ?? current.name,
            email: ctx.student.email ?? current.email,
            phone: ctx.student.phone ?? current.phone,
            course: ctx.student.course ?? current.course,
            organization: "Universidade Oscar Ribas",
            photoUrl: ctx.student.avatarUrl ?? current.photoUrl,
          }));
        })
        : api.teamCredentials.nucleusContext(token).then((context) => {
          if (!active) return;
          setNucleusContext(context);
          setNucleusClaim(context.pendingClaim ?? null);
          setSelectedNucleusAreaKey((current) => current || context.claimOptions.areas[0]?.key || "");
          setSelectedNucleusFunctionKey((current) => current || context.claimOptions.areas[0]?.functions[0]?.key || "");
          setForm((current) => ({
            ...current,
            name: context.student.name ?? current.name,
            email: context.student.email ?? current.email,
            phone: current.phone && current.phone !== context.student.phone ? current.phone : "",
            course: context.student.course ?? current.course,
            organization: "Universidade Oscar Ribas",
            photoUrl: context.student.avatarUrl ?? current.photoUrl,
          }));
        });

    contextPromise
      .catch((err) => {
        if (!active) return;
        if (!isExpositor && err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          const message = "A tua sessão atual não é uma sessão académica UOR. Entra com o número de estudante e senha da Secretaria para solicitar a tomada de posse.";
          setToken(null);
          setHasStudentSession(false);
          setNucleusContext(null);
          setNucleusClaim(null);
          setNucleusContextError(null);
          setStudentSessionNotice(message);
          toast.info(message);
          return;
        }
        const message = err instanceof Error ? err.message : isExpositor
          ? "Nao foi possivel validar o acesso de expositor."
          : "Nao foi possivel validar o acesso do Nucleo.";
        setNucleusContextError(message);
        toast.error(message);
      })
      .finally(() => {
        if (active) setNucleusContextLoading(false);
      });

    return () => {
      active = false;
    };
  }, [hasStudentSession, member, token, isExpositor]);

  const alreadyClaimed = (nucleusContext?.alreadyClaimed ?? expositorContext?.alreadyClaimed) === true;
  const claimedCredential = nucleusContext?.claimedCredential ?? expositorContext?.claimedCredential ?? null;
  const activeMember = alreadyClaimed && claimedCredential ? claimedCredential : member;
  const ready = isTeamCredentialReadyStatus(activeMember?.status);
  const previewName = form.name || activeMember?.name || "Membro UOR Connect";
  const completion = profileCompletion(form);
  const passUrl = useMemo(() => activeMember ? api.teamCredentials.passPdfUrl(activeMember.publicSlug) : null, [activeMember]);
  const selectedNucleusArea = useMemo(
    () => nucleusContext?.claimOptions.areas.find((item) => item.key === selectedNucleusAreaKey) ?? null,
    [nucleusContext?.claimOptions.areas, selectedNucleusAreaKey],
  );
  const selectedNucleusAreaFunctions = useMemo(
    () => selectedNucleusArea?.functions ?? nucleusContext?.claimOptions.functions.filter((item) => item.areaKey === selectedNucleusAreaKey) ?? [],
    [nucleusContext?.claimOptions.functions, selectedNucleusArea, selectedNucleusAreaKey],
  );
  const selectedNucleusFunction = useMemo(
    () => selectedNucleusAreaFunctions.find((item) => item.key === selectedNucleusFunctionKey) ?? null,
    [selectedNucleusAreaFunctions, selectedNucleusFunctionKey],
  );
  const sessionStudent = nucleusContext?.student ?? expositorContext?.student ?? null;
  const officialNucleusPhone = !isExpositor ? sessionStudent?.phone?.trim() : "";

  useEffect(() => {
    if (isExpositor || !selectedNucleusAreaKey || selectedNucleusAreaFunctions.length === 0) return;
    if (selectedNucleusAreaFunctions.some((item) => item.key === selectedNucleusFunctionKey)) return;
    setSelectedNucleusFunctionKey(selectedNucleusAreaFunctions[0].key);
  }, [isExpositor, selectedNucleusAreaFunctions, selectedNucleusAreaKey, selectedNucleusFunctionKey]);

  const updateForm = <Key extends keyof CredentialForm>(key: Key, value: CredentialForm[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handlePhoto = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Seleciona uma imagem valida.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no maximo 5 MB.");
      return;
    }

    try {
      const dataUrl = await readCompressedImageFileAsDataUrl(file, {
        maxLength: 460_000,
        maxDimension: 512,
      });
      const uploaded = await api.media.uploadDataUrl(dataUrl, "credential-photos", { maxImageDimension: 900 });
      updateForm("photoUrl", uploaded.url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nao foi possivel carregar a fotografia.");
    }
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.info("Indica o teu nome para preparar o passe.");
      return;
    }

    if (isExpositor && !selectedSubmissionId) {
      toast.info("Escolhe o projeto para emitir a credencial de expositor.");
      return;
    }

    if (!isExpositor && (!selectedNucleusAreaKey || !selectedNucleusFunctionKey)) {
      toast.info("Escolhe a categoria e a função pretendida no Núcleo.");
      return;
    }

    if (!form.photoUrl?.trim()) {
      toast.info("A fotografia é obrigatória para preparar esta credencial.");
      return;
    }

    if (form.consentPhotoCredential !== true) {
      toast.info("Autoriza o uso da fotografia para preparar esta credencial.");
      return;
    }

    setSaving(true);
    try {
      const formData = {
        ...form,
        name: form.name.trim(),
        instagramUrl: normalizeSocialUrl(form.instagramUrl),
        facebookUrl: normalizeSocialUrl(form.facebookUrl),
        linkedinUrl: normalizeSocialUrl(form.linkedinUrl),
        githubUrl: normalizeSocialUrl(form.githubUrl),
        websiteUrl: normalizeSocialUrl(form.websiteUrl),
      };

      let payload: TeamCredentialMember;
      if (isExpositor) {
        payload = await api.teamCredentials.claimExpositor(token, { ...formData, submissionId: selectedSubmissionId! });
        toast.success("Credencial de expositor emitida com sucesso.");
      } else {
        const claim = await api.teamCredentials.requestNucleusClaim(token, {
          ...formData,
          areaKey: selectedNucleusAreaKey,
          functionKey: selectedNucleusFunctionKey,
        });
        setNucleusClaim(claim);
        toast.success("Solicitação de tomada de posse enviada para validação.");
        return;
      }
      setMember(payload);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nao foi possivel guardar a credencial.");
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    const target = activeMember;
    if (!target) return;
    setDownloading(true);
    try {
      const blob = await api.teamCredentials.downloadPass(target.publicSlug);
      downloadBlobFile(blob, fileNameFromMember(target));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nao foi possivel baixar o passe.");
    } finally {
      setDownloading(false);
    }
  };

  const filledSocials = [
    { label: "Instagram", url: form.instagramUrl, icon: Instagram, color: "text-pink-500 bg-pink-50 border-pink-100" },
    { label: "Facebook", url: form.facebookUrl, icon: Globe2, color: "text-blue-600 bg-blue-50 border-blue-100" },
    { label: "LinkedIn", url: form.linkedinUrl, icon: Linkedin, color: "text-sky-600 bg-sky-50 border-sky-100" },
    { label: "GitHub", url: form.githubUrl, icon: Github, color: "text-slate-700 bg-slate-50 border-slate-100" },
    { label: "Website", url: form.websiteUrl, icon: Globe2, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
  ].filter((s) => s.url?.trim());

  // ── Loading state ──
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-slate-50 to-white">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 shadow-lg">
            <Loader2 className="h-6 w-6 animate-spin text-white" />
          </div>
          <p className="text-sm font-medium text-slate-500">A verificar convite...</p>
        </motion.div>
      </div>
    );
  }

  // ── Error state ──
  if (error || !member) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-slate-50 to-white px-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease }}
          className="w-full max-w-md"
        >
          <div className="overflow-hidden rounded-2xl border border-rose-200 bg-white shadow-xl shadow-rose-100/50">
            <div className="h-1 bg-gradient-to-r from-rose-500 to-rose-400" />
            <div className="p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100">
                <ShieldAlert className="h-7 w-7 text-rose-600" />
              </div>
              <h1 className="mt-5 text-xl font-bold text-slate-900">Convite indisponivel</h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{error ?? "Este link ja nao esta disponivel ou foi revogado."}</p>
              <Button asChild className="mt-6 h-11 rounded-xl bg-slate-900 px-6 shadow-md hover:bg-slate-800">
                <Link to="/">Voltar ao UOR Connect</Link>
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Step 1: Login obrigatorio ──
  if (!hasStudentSession) {
    return (
      <div className="relative flex min-h-dvh items-center justify-center bg-gradient-to-b from-slate-50 via-white to-slate-50/50 px-4 py-8">
        {/* Background pattern */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(15,23,42,0.05),transparent_60%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(15,23,42,0.02),transparent_40%)]" />

        <div className="relative z-10 mx-auto grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[1fr_440px]">
          {/* Left - Hero */}
          <motion.section
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55, ease }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 shadow-sm">
              <Lock className="h-3.5 w-3.5 text-slate-900" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Acesso restrito</span>
            </div>

            <h1 className="mt-6 max-w-lg text-3xl font-extrabold leading-[1.15] tracking-tight text-slate-900 sm:text-4xl lg:text-[2.75rem]">
              Credencial oficial do{" "}
              <span className="bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
                Nucleo UOR Connect
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-base leading-7 text-slate-500">
              Este link abre a <strong className="font-semibold text-slate-700">tomada de posse digital do Núcleo</strong>.
              Para garantir identidade forte, inicia sessão com as tuas credenciais académicas da UOR.
            </p>
            {member.invitationExpiresAt && (
              <p className="mt-3 inline-flex rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
                Convite valido ate {formatDate(member.invitationExpiresAt)}
              </p>
            )}

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                {
                  icon: Fingerprint,
                  step: "01",
                  label: "Autenticacao",
                  desc: "Login academico UOR",
                },
	                {
	                  icon: ShieldCheck,
	                  step: "02",
	                  label: "Tomada de posse",
	                  desc: "Área, função e perfil",
	                },
	                {
	                  icon: FileBadge2,
	                  step: "03",
	                  label: "Aprovação",
	                  desc: "Validação pela admin",
	                },
              ].map((step, i) => (
                <motion.div
                  key={step.label}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.2 + i * 0.1, ease }}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
                >
                  <div className="absolute -right-2 -top-2 text-[3rem] font-black leading-none text-slate-100 transition-colors group-hover:text-slate-200">
                    {step.step}
                  </div>
                  <div className="relative">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
                      <step.icon className="h-4.5 w-4.5" />
                    </div>
                    <p className="mt-3.5 text-sm font-bold text-slate-900">{step.label}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{step.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Security notice */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200/60 bg-amber-50/50 px-4 py-3"
            >
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-xs leading-5 text-amber-800">
	                <strong className="font-semibold">Acesso exclusivo.</strong>{" "}
	                Apenas estudantes autenticados pela Secretaria podem solicitar tomada de posse. A credencial só é emitida depois da aprovação administrativa.
              </p>
            </motion.div>
          </motion.section>

          {/* Right - Login form */}
          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12, ease }}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50"
          >
            <div className="h-1.5 bg-gradient-to-r from-slate-900 via-slate-700 to-slate-500" />

            <div className="p-6 sm:p-7">
              {/* Login header */}
              <div className="mb-6 flex items-center gap-4 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Entrar como estudante UOR</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                    Usa o teu numero de estudante e senha da secretaria.
                  </p>
                </div>
              </div>

              {studentSessionNotice && (
                <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <p className="text-xs leading-5 text-amber-800">{studentSessionNotice}</p>
                </div>
              )}

              <StudentLoginForm
                submitLabel="Verificar identidade"
                allowConventional={false}
                onSuccess={() => {
                  setStudentSessionNotice(null);
                  setHasStudentSession(true);
                }}
              />

              <div className="mt-5 rounded-xl bg-slate-50 px-4 py-3">
                <p className="text-center text-[11px] leading-5 text-slate-400">
	                  Ao prosseguir, confirmas que as informações fornecidas são verdadeiras e serão revistas pela administração do Núcleo.
                </p>
              </div>
            </div>
          </motion.section>
        </div>
      </div>
    );
  }

  // ── Step 2: Loading nucleus context (after login) ──
  if (nucleusContextLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-slate-50 to-white">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-5 text-center"
        >
          <div className="relative">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 shadow-lg">
              <Loader2 className="h-7 w-7 animate-spin text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-emerald-500 shadow">
              <ShieldCheck className="h-3.5 w-3.5 text-white" />
            </div>
          </div>
	          <div>
	            <p className="text-sm font-bold text-slate-900">A validar a tua identidade</p>
	            <p className="mt-1 text-xs text-slate-500">A preparar a tomada de posse do Núcleo...</p>
	          </div>
        </motion.div>
      </div>
    );
  }

  // ── Step 2b: Failed to load context (not authorized) ──
  const hasContext = isExpositor ? Boolean(expositorContext) : Boolean(nucleusContext);
  if (nucleusContextError || !hasContext) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-slate-50 to-white px-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease }}
          className="w-full max-w-lg"
        >
          <div className="overflow-hidden rounded-2xl border border-rose-200 bg-white shadow-xl shadow-rose-100/50">
            <div className="h-1.5 bg-gradient-to-r from-rose-500 to-rose-400" />
            <div className="p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100">
                <ShieldAlert className="h-8 w-8 text-rose-600" />
              </div>
              <h1 className="mt-5 text-xl font-bold text-slate-900">Sessão não validada</h1>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-slate-500">
	                {nucleusContextError ?? (isExpositor
	                  ? "Nao foi possivel validar o teu acesso. Este link e exclusivo para expositores com projetos aprovados."
	                  : "Nao foi possivel preparar a tomada de posse. Confirma que entraste com as credenciais académicas corretas.")}
              </p>

              <div className="mx-auto mt-6 max-w-xs rounded-xl border border-rose-100 bg-rose-50 px-4 py-3">
                <p className="text-xs leading-5 text-rose-700">
	                  {isExpositor
	                    ? "Verifica que o teu projeto foi aprovado e que estas associado como membro ou lider."
	                    : "O pedido não depende de lista prévia: depois do login, escolhe a área e função e aguarda a validação da administração."}
                </p>
              </div>

              <div className="mt-6 flex items-center justify-center gap-3">
                <Button asChild variant="outline" className="h-11 rounded-xl">
                  <Link to="/">Voltar ao inicio</Link>
                </Button>
                <Button
                  className="h-11 rounded-xl bg-slate-900 px-6 shadow-md hover:bg-slate-800"
                  onClick={() => {
                    setToken(null);
                    setHasStudentSession(false);
                    setNucleusContextError(null);
                  }}
                >
                  Tentar outra conta
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!isExpositor && nucleusClaim && nucleusClaim.status !== "CANCELED") {
    const approved = nucleusClaim.status === "APPROVED";
    const rejected = nucleusClaim.status === "REJECTED";

    return (
      <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-slate-50 to-white px-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease }}
          className="w-full max-w-lg"
        >
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
            <div className={`h-1.5 ${rejected ? "bg-rose-600" : approved ? "bg-emerald-600" : "bg-slate-900"}`} />
            <div className="p-8 text-center">
              <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${
                rejected ? "bg-rose-50 text-rose-700" : approved ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"
              }`}>
                {rejected ? <ShieldAlert className="h-8 w-8" /> : approved ? <ShieldCheck className="h-8 w-8" /> : <Loader2 className="h-8 w-8 animate-spin" />}
              </div>
              <h1 className="mt-5 text-xl font-bold text-slate-900">
                {rejected ? "Tomada de posse recusada" : approved ? "Tomada de posse aprovada" : "Solicitação enviada para validação"}
              </h1>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-500">
                {rejected
                  ? nucleusClaim.reviewNote ?? "A administração recusou esta solicitação. Confirma os dados com o Núcleo."
                  : approved
                    ? "A administração aprovou a tua tomada de posse. Já podes entrar na admin com esta sessão ou consultar o passe na tua área."
                    : "A tua categoria e função foram enviadas para a administração do Núcleo. O passe só fica disponível depois da aprovação."}
              </p>
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Pedido</p>
                <p className="mt-2 text-sm font-bold text-slate-900">{nucleusClaim.requestedTeam}</p>
                <p className="mt-0.5 text-xs text-slate-500">{nucleusClaim.requestedRole} · {nucleusClaim.requestedAccessLevel}</p>
                <p className="mt-3 text-xs text-slate-500">{nucleusClaim.officialName ?? nucleusClaim.studentNumber}</p>
              </div>
              <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
                {rejected && (
                  <Button variant="outline" className="h-11 rounded-xl" onClick={() => setNucleusClaim(null)}>
                    Rever e reenviar
                  </Button>
                )}
                {approved && (
                  <Button asChild className="h-11 rounded-xl bg-slate-900 px-6 shadow-md hover:bg-slate-800">
                    <Link to="/admin">
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Entrar na admin
                    </Link>
                  </Button>
                )}
                <Button asChild variant={approved ? "outline" : "default"} className={`h-11 rounded-xl ${approved ? "" : "bg-slate-900 px-6 shadow-md hover:bg-slate-800"}`}>
                  <Link to="/minha-area">Ir para Minha Área</Link>
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Step 2c: Already claimed (bulk flow) ──
  if (alreadyClaimed && claimedCredential) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-slate-50 to-white px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease }}
          className="w-full max-w-md"
        >
          <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-xl shadow-emerald-100/50">
            <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-emerald-400" />
            <div className="p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <h1 className="mt-5 text-xl font-bold text-slate-900">Credencial ja emitida</h1>
              <p className="mt-2 text-sm text-slate-500">
                A tua credencial oficial do Nucleo ja foi confirmada.
              </p>

              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  {claimedCredential.photoUrl ? (
                    <img src={claimedCredential.photoUrl} alt="" className="h-12 w-12 rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-200 text-sm font-bold text-slate-600">
                      {initials(claimedCredential.name)}
                    </div>
                  )}
                  <div className="text-left">
                    <p className="text-sm font-bold text-slate-900">{claimedCredential.name}</p>
                    <p className="text-xs text-slate-500">{claimedCredential.team} · {claimedCredential.role}</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-2.5">
                <Button
                  className="h-11 w-full rounded-xl bg-slate-900 shadow-md hover:bg-slate-800"
                  disabled={downloading}
                  onClick={async () => {
                    setDownloading(true);
                    try {
                      const blob = await api.teamCredentials.downloadPass(claimedCredential.publicSlug);
                      downloadBlobFile(blob, fileNameFromMember(claimedCredential));
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Falha ao descarregar.");
                    } finally {
                      setDownloading(false);
                    }
                  }}
                >
                  {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  Descarregar passe
                </Button>
                {!isExpositor && (
                  <Button asChild variant="outline" className="h-11 rounded-xl">
                    <Link to="/admin">
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Entrar na admin
                    </Link>
                  </Button>
                )}
                <Button asChild variant="outline" className="h-11 rounded-xl">
                  <Link to="/minha-area">
                    <Home className="mr-2 h-4 w-4" />
                    Ir para a minha area
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Step 3: Nucleus verified, show profile form ──
  return (
    <div className="min-h-dvh bg-gradient-to-b from-slate-50 via-white to-slate-50/30">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {/* Hero header */}
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease }}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/30"
          >
            <div className="h-1.5 bg-gradient-to-r from-slate-900 via-slate-700 to-slate-500" />

            <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="flex items-center gap-2.5">
                  <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700">
                    <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                    Identidade verificada
                  </Badge>
                  <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-700">
                    <FileBadge2 className="mr-1.5 h-3.5 w-3.5" />
                    {member.categoryLabel}
                  </Badge>
	                </div>
	                <h1 className="mt-3 max-w-2xl text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">
	                  {isExpositor ? member.team : "Tomada de posse do Núcleo"}
	                </h1>
	                <p className="mt-1.5 flex items-center gap-2 text-sm text-slate-500">
	                  <span>{isExpositor ? `${member.role} · ${member.accessLevel}` : "Escolhe a tua área e função para validação administrativa"}</span>
	                  {sessionStudent?.studentNumber && (
	                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
	                      <Fingerprint className="h-3 w-3" />
	                      {sessionStudent.studentNumber}
	                    </span>
	                  )}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-5 py-3.5">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${ready ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-600"}`}>
                    {ready ? <CheckCircle2 className="h-5 w-5" /> : <QrCode className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{ready ? "Passe pronto" : "A completar perfil"}</p>
                    <p className="text-[11px] text-slate-400">Perfil {completion}% completo</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            {/* Form section */}
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              {/* Expositor submission selector */}
              {isExpositor && expositorContext && (
                <div className="border-b border-amber-100 bg-gradient-to-r from-amber-50 to-amber-50/30 px-6 py-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                      <Rocket className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-amber-900">
                        {expositorContext.submissions.length > 0 ? "Seleciona o teu projeto" : "Nenhum projeto encontrado"}
                      </p>
                      <p className="mt-0.5 text-xs text-amber-700">
                        {expositorContext.submissions.length > 0
                          ? "Escolhe o projeto aprovado para o qual queres emitir a credencial de expositor."
                          : "Nao encontramos projetos aprovados associados a tua conta."}
                      </p>
                    </div>
                  </div>
                  {expositorContext.submissions.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {expositorContext.submissions.map((sub) => (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => {
                            setSelectedSubmissionId(sub.id);
                            setForm((current) => ({
                              ...current,
                              organization: `${sub.name} (${sub.referenceCode})`,
                            }));
                          }}
                          className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                            selectedSubmissionId === sub.id
                              ? "border-emerald-300 bg-emerald-50 shadow-sm"
                              : "border-slate-200 bg-white hover:border-amber-300"
                          }`}
                        >
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                            selectedSubmissionId === sub.id ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                          }`}>
                            {sub.type === "PROJECT" ? <GraduationCap className="h-4 w-4" /> : <BriefcaseBusiness className="h-4 w-4" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`truncate text-sm font-bold ${selectedSubmissionId === sub.id ? "text-emerald-900" : "text-slate-900"}`}>
                              {sub.name}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-slate-500">
                              {sub.referenceCode} · {sub.area} · {sub.type === "PROJECT" ? "Projeto" : sub.type === "BUSINESS" ? "Negocio" : "Produto"}
                            </p>
                          </div>
                          {selectedSubmissionId === sub.id && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Nucleus possession request */}
              {!isExpositor && <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-emerald-50/40 px-6 py-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
                      <Fingerprint className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        Tomada de posse do Núcleo
                      </p>
                      <p className="mt-0.5 text-xs leading-5 text-slate-600">
                        Nome, número de estudante, curso e telefone da Secretaria são a base oficial. Podes indicar um contacto adicional sem substituir o registo académico.
                      </p>
                    </div>
                  </div>
	                  {sessionStudent && (
	                    <Badge variant="outline" className="w-fit shrink-0 border-slate-200 bg-white text-slate-700">
	                      <UserRound className="mr-1 h-3 w-3" />
	                      {sessionStudent.name ?? sessionStudent.studentNumber}
	                    </Badge>
	                  )}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Categoria / área</span>
                    <select
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20"
                      value={selectedNucleusAreaKey}
                      onChange={(event) => {
                        const nextAreaKey = event.target.value;
                        const nextArea = nucleusContext.claimOptions.areas.find((area) => area.key === nextAreaKey);
                        setSelectedNucleusAreaKey(nextAreaKey);
                        setSelectedNucleusFunctionKey(nextArea?.functions[0]?.key ?? "");
                      }}
                    >
                      {nucleusContext.claimOptions.areas.map((area) => (
                        <option key={area.key} value={area.key}>{area.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Função pretendida</span>
                    <select
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20"
                      value={selectedNucleusFunctionKey}
                      onChange={(event) => setSelectedNucleusFunctionKey(event.target.value)}
                    >
                      {selectedNucleusAreaFunctions.map((item) => (
                        <option key={item.key} value={item.key}>{item.label}</option>
                      ))}
                    </select>
                  </label>
                  <AnimatePresence>
                    {(selectedNucleusArea || selectedNucleusFunction) && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden md:col-span-2"
                      >
                        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-white px-4 py-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                            <BadgeCheck className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-emerald-900">
                              {selectedNucleusArea?.label ?? "Área do Núcleo"} · {selectedNucleusFunction?.label ?? "Função"}
                            </p>
                            <p className="mt-0.5 text-xs leading-5 text-emerald-700">
                              {selectedNucleusArea?.description ?? selectedNucleusFunction?.description}
                            </p>
                          </div>
                          <Sparkles className="h-4 w-4 shrink-0 text-emerald-400" />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>}

              {/* Section header */}
              <div className="border-b border-slate-100 bg-slate-50/60 px-6 py-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                      <IdCard className="h-4 w-4 text-slate-700" />
                      Completar perfil
                    </p>
                    <h2 className="mt-2 text-xl font-bold leading-tight text-slate-900">Prepara a tua credencial</h2>
                    <p className="mt-1 max-w-xl text-sm text-slate-500">
                      A fotografia e obrigatoria para credenciais operacionais; redes sociais sao opcionais.
                    </p>
                  </div>
                  {/* Progress */}
                  <div className="shrink-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="flex items-center justify-between gap-4 text-xs font-semibold text-slate-500">
                      <span>Progresso</span>
                      <span className="text-slate-900">{completion}%</span>
                    </div>
                    <div className="mt-2 h-1.5 w-32 overflow-hidden rounded-full bg-slate-100">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-slate-700 to-slate-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${completion}%` }}
                        transition={{ duration: 0.5, ease }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-8">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Finalidade dos dados</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Identidade, foto e função geram a credencial. No Núcleo, o contacto da Secretaria é o principal para SMS; o número adicional fica preservado apenas como apoio operacional.
                  </p>
                </div>
                {/* Identity section */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                      <UserRound className="h-3.5 w-3.5" />
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">Identidade</h3>
                  </div>
                  <div className="space-y-4">
                    <label className="block space-y-1.5">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Nome no passe</span>
                      <Input
                        value={form.name}
                        onChange={(event) => updateForm("name", event.target.value)}
                        placeholder="O teu nome completo"
                        autoComplete="name"
                        disabled
                        className="h-11 rounded-xl border-border/60 bg-slate-50 font-semibold text-slate-900 transition-colors"
                      />
	                      <p className="text-[11px] text-slate-400">Preenchido automaticamente com os dados da Secretaria.</p>
                    </label>

                    {/* Photo upload */}
                    <label
                      className={`flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed p-5 transition-all ${
                        dragOver
                          ? "border-primary bg-primary/5"
                          : form.photoUrl
                            ? "border-emerald-300 bg-emerald-50/30"
                            : "border-border/60 bg-muted/10 hover:border-primary/40 hover:bg-muted/20"
                      }`}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOver(false);
                        void handlePhoto(e.dataTransfer.files?.[0] ?? null);
                      }}
                    >
                      <div className={`flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 shadow-md ${
                        form.photoUrl ? "border-emerald-300 bg-white" : "border-primary/20 bg-primary/5 text-primary"
                      }`}>
                        {form.photoUrl ? (
                          <img src={form.photoUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Camera className="h-6 w-6" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{form.photoUrl ? "Foto carregada" : "Selecionar fotografia"}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Obrigatoria. Imagem nitida para o passe ficar profissional.</p>
                        {form.photoUrl && (
                          <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                            <CheckCircle2 className="h-3 w-3" />
                            Pronta
                          </span>
                        )}
                      </div>
                      <input type="file" accept="image/*" className="sr-only" onChange={(event) => void handlePhoto(event.target.files?.[0] ?? null)} />
                    </label>
                  </div>
                </div>

                {/* Contact section */}
                <div className="border-t border-border/40 pt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                      <Mail className="h-3.5 w-3.5" />
                    </span>
                    <h3 className="text-sm font-bold">Contacto</h3>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {!isExpositor && officialNucleusPhone && (
                      <label className="space-y-1.5 sm:col-span-2">
                        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          <Phone className="h-3 w-3" /> Telefone principal da Secretaria
                        </span>
                        <Input
                          type="tel"
                          value={officialNucleusPhone}
                          disabled
                          className="h-10 rounded-xl border-emerald-200 bg-emerald-50/70 text-sm font-semibold text-emerald-950"
                        />
                        <p className="text-[11px] leading-5 text-emerald-700">Este é o contacto principal usado pela organização para SMS e validação.</p>
                      </label>
                    )}
                    <label className="space-y-1.5">
                      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"><Mail className="h-3 w-3" /> Email</span>
                      <Input type="email" value={form.email ?? ""} onChange={(event) => updateForm("email", event.target.value)} placeholder="email@exemplo.com" autoComplete="email" className="h-10 rounded-xl border-border/60 bg-muted/10 text-sm focus:bg-white" />
                    </label>
                    <label className="space-y-1.5">
                      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        <Phone className="h-3 w-3" /> {isExpositor ? "Telefone recomendado" : "Telefone adicional opcional"}
                      </span>
                      <Input type="tel" value={form.phone ?? ""} onChange={(event) => updateForm("phone", event.target.value)} placeholder={isExpositor ? "+244..." : "Outro número para apoio operacional"} autoComplete="tel" className="h-10 rounded-xl border-border/60 bg-muted/10 text-sm focus:bg-white" />
                    </label>
                    <label className="space-y-1.5">
                      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"><GraduationCap className="h-3 w-3" /> Curso ou area</span>
                      <Input value={form.course ?? ""} onChange={(event) => updateForm("course", event.target.value)} placeholder="Informatica, organizacao..." className="h-10 rounded-xl border-border/60 bg-muted/10 text-sm focus:bg-white" />
                    </label>
                    <label className="space-y-1.5">
                      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"><BriefcaseBusiness className="h-3 w-3" /> Instituicao</span>
                      <Input value={form.organization ?? ""} onChange={(event) => updateForm("organization", event.target.value)} placeholder="Universidade Oscar Ribas" autoComplete="organization" className="h-10 rounded-xl border-border/60 bg-muted/10 text-sm focus:bg-white" />
                    </label>
                    <label className="space-y-1.5 sm:col-span-2">
                      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"><Home className="h-3 w-3" /> Morada opcional</span>
                      <Input value={form.address ?? ""} onChange={(event) => updateForm("address", event.target.value)} placeholder="Municipio, bairro ou referencia" autoComplete="street-address" className="h-10 rounded-xl border-border/60 bg-muted/10 text-sm focus:bg-white" />
                    </label>
                  </div>
                </div>

                {/* Public profile section */}
                <div className="border-t border-border/40 pt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600">
                      <Globe2 className="h-3.5 w-3.5" />
                    </span>
                    <h3 className="text-sm font-bold">Perfil publico</h3>
                  </div>
                  <div className="space-y-3">
                    <label className="block space-y-1.5">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Resumo do perfil</span>
                      <Textarea value={form.bio ?? ""} onChange={(event) => updateForm("bio", event.target.value)} rows={3} placeholder="Funcao no evento, area de atuacao..." className="resize-none rounded-xl border-border/60 bg-muted/10 focus:bg-white" />
                    </label>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="space-y-1.5">
                        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"><Instagram className="h-3 w-3 text-pink-500" /> Instagram</span>
                        <Input value={form.instagramUrl ?? ""} onChange={(event) => updateForm("instagramUrl", event.target.value)} placeholder="instagram.com/usuario" className="h-10 rounded-xl border-border/60 bg-muted/10 text-sm focus:bg-white" />
                      </label>
                      <label className="space-y-1.5">
                        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Facebook</span>
                        <Input value={form.facebookUrl ?? ""} onChange={(event) => updateForm("facebookUrl", event.target.value)} placeholder="facebook.com/usuario" className="h-10 rounded-xl border-border/60 bg-muted/10 text-sm focus:bg-white" />
                      </label>
                      <label className="space-y-1.5">
                        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"><Linkedin className="h-3 w-3 text-sky-600" /> LinkedIn</span>
                        <Input value={form.linkedinUrl ?? ""} onChange={(event) => updateForm("linkedinUrl", event.target.value)} placeholder="linkedin.com/in/usuario" className="h-10 rounded-xl border-border/60 bg-muted/10 text-sm focus:bg-white" />
                      </label>
                      <label className="space-y-1.5">
                        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"><Github className="h-3 w-3" /> GitHub</span>
                        <Input value={form.githubUrl ?? ""} onChange={(event) => updateForm("githubUrl", event.target.value)} placeholder="github.com/usuario" className="h-10 rounded-xl border-border/60 bg-muted/10 text-sm focus:bg-white" />
                      </label>
                      <label className="space-y-1.5 sm:col-span-2">
                        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"><Globe2 className="h-3 w-3 text-emerald-600" /> Site ou portfolio</span>
                        <Input value={form.websiteUrl ?? ""} onChange={(event) => updateForm("websiteUrl", event.target.value)} placeholder="teusite.com" className="h-10 rounded-xl border-border/60 bg-muted/10 text-sm focus:bg-white" />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border/40 pt-6">
                  <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/10 p-4">
                    <div>
                      <h3 className="text-sm font-bold">Consentimento</h3>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">A credencial é operacional; contactos e morada não aparecem no perfil público por padrão.</p>
                    </div>
                    <label className="flex items-start gap-3 rounded-xl bg-white p-3">
                      <Checkbox
                        checked={form.consentPhotoCredential === true}
                        onCheckedChange={(value) => updateForm("consentPhotoCredential", Boolean(value))}
                        className="mt-0.5"
                      />
                      <span className="text-sm leading-snug text-slate-700">Autorizo usar a minha fotografia nesta credencial digital/impressa.</span>
                    </label>
                    <label className="flex items-start gap-3 rounded-xl bg-white p-3">
                      <Checkbox
                        checked={form.consentPublicProfile === true}
                        onCheckedChange={(value) => updateForm("consentPublicProfile", Boolean(value))}
                        className="mt-0.5"
                      />
                      <span className="text-sm leading-snug text-slate-700">Autorizo mostrar bio e fotografia no perfil público da equipa.</span>
                    </label>
                    <label className="flex items-start gap-3 rounded-xl bg-white p-3">
                      <Checkbox
                        checked={form.consentSocialLinks === true}
                        onCheckedChange={(value) => updateForm("consentSocialLinks", Boolean(value))}
                        className="mt-0.5"
                      />
                      <span className="text-sm leading-snug text-slate-700">Autorizo mostrar as minhas redes sociais no perfil público.</span>
                    </label>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-3 border-t border-border/40 pt-5">
                  <Button
                    className="h-11 rounded-xl bg-slate-900 px-6 text-white shadow-md hover:bg-slate-800"
                    disabled={saving || (!isExpositor && (!selectedNucleusAreaKey || !selectedNucleusFunctionKey)) || (isExpositor && !selectedSubmissionId)}
                    onClick={() => void handleSubmit()}
                  >
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BadgeCheck className="mr-2 h-4 w-4" />}
                    {isExpositor ? "Guardar e preparar passe" : "Enviar para validação"}
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 rounded-xl"
                    disabled={!ready || downloading}
                    onClick={() => void handleDownload()}
                  >
                    {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    Baixar PDF
                  </Button>
                  {ready && passUrl ? (
                    <Button asChild variant="ghost" className="h-11 rounded-xl">
                      <a href={passUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Abrir PDF
                      </a>
                    </Button>
                  ) : null}
                </div>
              </div>
            </motion.section>

            {/* Sidebar - Credential preview card */}
            <aside className="space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.15 }}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/30"
              >
                {/* Card header - mimics the real pass */}
                <div className="relative overflow-hidden bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-4">
                  <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-white/5" />
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/90">UOR Connect</p>
                    <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[10px] font-bold text-white/80">
                      {member.categoryLabel}
                    </span>
                  </div>
                </div>

                {/* Photo & Name */}
                <div className="relative px-5 pb-5">
                  <div className="relative -mt-7 flex justify-center">
                    <div className="flex h-[5.5rem] w-[5.5rem] items-center justify-center overflow-hidden rounded-2xl border-[3px] border-white bg-muted text-xl font-bold text-muted-foreground shadow-lg">
                      {form.photoUrl ? (
                        <img src={form.photoUrl} alt={previewName} className="h-full w-full object-cover" />
                      ) : (
                        initials(previewName)
                      )}
                    </div>
                  </div>

                  <div className="mt-3 text-center">
                    <p className="text-base font-bold leading-tight">{previewName}</p>
	                    <p className="mt-0.5 text-xs text-muted-foreground">{selectedNucleusFunction?.label ?? member.role}</p>
                  </div>

                  {/* Info cells */}
                  <div className="mt-4 grid gap-2">
                    <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5">
                      <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">Equipa</span>
	                      <p className="mt-0.5 text-xs font-semibold">{selectedNucleusArea?.team ?? member.team}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5">
                        <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">Acesso</span>
	                        <p className="mt-0.5 text-xs font-semibold">{selectedNucleusFunction?.accessLevel ?? member.accessLevel}</p>
                      </div>
                      <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5">
                        <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">Status</span>
                        <p className={`mt-0.5 text-xs font-semibold ${ready ? "text-emerald-600" : "text-amber-600"}`}>
                          {ready ? "Pronto" : "Pendente"}
                        </p>
                      </div>
                    </div>
                    {form.course && (
                      <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5">
                        <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">Area</span>
                        <p className="mt-0.5 text-xs font-semibold">{form.course}</p>
                      </div>
                    )}
                  </div>

                  {/* Social tags */}
                  <AnimatePresence>
                    {filledSocials.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 flex flex-wrap justify-center gap-1.5"
                      >
                        {filledSocials.map((s) => {
                          const SIcon = s.icon;
                          return (
                            <span key={s.label} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${s.color}`}>
                              <SIcon className="h-2.5 w-2.5" />
                              {s.label}
                            </span>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Preview badge */}
                  <div className="mt-4 flex items-center justify-center">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      <Shield className="h-3 w-3" />
                      Preview da credencial
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* Status card */}
              {ready ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                  className="overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                      <BadgeCheck className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-emerald-800">Perfil publicado</p>
                      <Link
                        className="mt-1 block break-all text-xs text-emerald-700 underline transition hover:text-emerald-900"
                        to={`/equipa/perfil/${member.publicSlug}`}
                      >
                        {currentProfileUrl(member)}
                      </Link>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-start gap-3">
                    <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                    <p className="text-xs leading-5 text-slate-500">
	                      Escolhe a área, confirma a função, completa o perfil e envia para validação da administração.
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Verified identity card */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.25 }}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
                    <Fingerprint className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900">Sessao verificada</p>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">
	                      {sessionStudent?.name ?? "Estudante"} · {sessionStudent?.studentNumber}
                    </p>
                  </div>
                </div>
              </motion.div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
