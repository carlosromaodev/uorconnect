import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ExternalLink,
  Facebook,
  Globe,
  Instagram,
  Linkedin,
  Loader2,
  Upload,
  User,
  Shield,
  BadgeCheck,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { ProfileConsentControls, type ProfileConsentValues } from "@/components/profile/ProfileConsentControls";
import {
  api,
  type CompleteProfileInput,
  getSessionStudent,
  getToken,
} from "@/lib/api";
import { readCompressedImageFileAsDataUrl } from "@/lib/project-media";
import { getSafeRedirectPath } from "@/lib/auth-routing";

type Step = 1 | 2 | 3;

const ease: [number, number, number, number] = [0.22, 1, 0.36, 1];

const slideVariants = {
  enter: (d: number) => ({ x: d > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: d > 0 ? -40 : 40, opacity: 0 }),
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.35, ease },
  }),
};

function normalizeSocialUrl(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/* ── Step indicator ── */
const stepConfig: Array<{ n: Step; label: string; description: string }> = [
  { n: 1, label: "Identidade", description: "Nome e foto opcional" },
  { n: 2, label: "Redes", description: "Links e bio" },
  { n: 3, label: "Confirmar", description: "Revisão final" },
];

function StepIndicator({ current }: { current: Step }) {
  return (
    <div className="flex items-center">
      {stepConfig.map((s, i) => {
        const done = current > s.n;
        const active = current === s.n;
        return (
          <div key={s.n} className="flex items-center">
            {i > 0 && (
              <div className={`mx-2 hidden h-px w-8 sm:mx-3 sm:block sm:w-12 ${done ? "bg-emerald-400" : "bg-slate-200"}`} />
            )}
            <div className="flex items-center gap-2">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 sm:h-8 sm:w-8 sm:text-sm ${
                  done
                    ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/25"
                    : active
                      ? "bg-slate-900 text-white shadow-sm shadow-slate-900/25"
                      : "bg-slate-100 text-slate-400"
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : s.n}
              </span>
              <div className="hidden sm:block">
                <p className={`text-xs font-semibold leading-none ${active || done ? "text-slate-900" : "text-slate-400"}`}>
                  {s.label}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400">{s.description}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Desktop sidebar preview ── */
function LivePreviewCard({
  name,
  photoUrl,
  bio,
  course,
  studentNumber,
  instagramUrl,
  linkedinUrl,
  githubUrl,
  facebookUrl,
  websiteUrl,
  step,
}: {
  name: string;
  photoUrl: string;
  bio: string;
  course?: string | null;
  studentNumber?: string | null;
  instagramUrl: string;
  linkedinUrl: string;
  githubUrl: string;
  facebookUrl: string;
  websiteUrl: string;
  step: Step;
}) {
  const initials = name
    ? name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
    : "?";

  const socials = [
    { label: "Instagram", url: instagramUrl, icon: Instagram },
    { label: "Facebook", url: facebookUrl, icon: Facebook },
    { label: "LinkedIn", url: linkedinUrl, icon: Linkedin },
    { label: "GitHub", url: githubUrl, icon: Globe },
    { label: "Site", url: websiteUrl, icon: ExternalLink },
  ].filter((s) => s.url.trim());

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Card header - mimics credential */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-800 to-slate-700 px-5 pb-12 pt-4">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5 blur-xl" />
        <div className="relative flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/70">UOR Connect</p>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-semibold text-white/60">
            Credencial
          </span>
        </div>
      </div>

      <div className="relative px-5 pb-5">
        {/* Photo overlapping header */}
        <div className="relative -mt-8 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border-[3px] border-white bg-slate-100 text-sm font-bold text-slate-400 shadow-lg">
            {photoUrl ? (
              <img src={photoUrl} alt={name} className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </div>
        </div>

        <div className="mt-3 text-center">
          <p className="text-sm font-bold text-slate-900">{name || "O teu nome"}</p>
          {course && <p className="mt-0.5 text-[11px] text-slate-500">{course}</p>}
          {studentNumber && (
            <span className="mt-1.5 inline-block rounded-md bg-slate-900 px-2 py-0.5 text-[9px] font-bold tracking-wider text-white">
              N.º {studentNumber}
            </span>
          )}
        </div>

        <AnimatePresence mode="popLayout">
          {bio && step >= 2 && (
            <motion.p
              key="bio"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto", marginTop: 10 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className="overflow-hidden text-center text-[11px] leading-[1.6] text-slate-500"
            >
              {bio}
            </motion.p>
          )}
        </AnimatePresence>

        <AnimatePresence mode="popLayout">
          {socials.length > 0 && step >= 2 && (
            <motion.div
              key="socials"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto", marginTop: 12 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className="flex flex-wrap items-center justify-center gap-1.5 overflow-hidden"
            >
              {socials.map((s) => {
                const SIcon = s.icon;
                return (
                  <span
                    key={s.label}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-150 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500"
                  >
                    <SIcon className="h-2.5 w-2.5" />
                    {s.label}
                  </span>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ═══════════════════════════ MAIN COMPONENT ═══════════════════════════ */

export default function CompletarPerfil() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = getSafeRedirectPath(searchParams.get("redirect"), "/minha-area");
  const student = getSessionStudent();

  const [step, setStep] = useState<Step>(1);
  const [direction, setDirection] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [compressingPhoto, setCompressingPhoto] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(Boolean(getToken()));
  const onboardingDoneRedirect = redirectTo === "/completar-perfil" ? "/minha-area" : redirectTo;

  const [name, setName] = useState(student?.name ?? "");
  const [photoUrl, setPhotoUrl] = useState(student?.avatarUrl ?? "");
  const [bio, setBio] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [consentPhotoCredential, setConsentPhotoCredential] = useState(false);
  const [consentPublicProfile, setConsentPublicProfile] = useState(false);
  const [consentSocialLinks, setConsentSocialLinks] = useState(false);
  const [consentSms, setConsentSms] = useState(false);
  const [consentWhatsapp, setConsentWhatsapp] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);

  /* auth guard */
  useEffect(() => {
    const loginRedirect = `/login?redirect=${encodeURIComponent("/completar-perfil?redirect=" + encodeURIComponent(redirectTo))}`;

    if (!getToken()) {
      navigate(loginRedirect, { replace: true });
      return;
    }

    // This route is only onboarding. Completed profiles continue to the intended area.
    if (student?.profileCompletedAt) {
      navigate(onboardingDoneRedirect, { replace: true });
      return;
    }

    // If we have cached session data with name/avatar, use it immediately (no need for /me)
    if (student) {
      setName((current) => current || student.name || "");
      setPhotoUrl((current) => current || student.avatarUrl || "");
      setCheckingProfile(false);
      return;
    }

    // Only call /me if we have no cached session at all (edge case: token exists but no cached student)
    let cancelled = false;
    setCheckingProfile(true);

    api.auth.me()
      .then((freshStudent) => {
        if (cancelled) return;
        if (freshStudent.profileCompletedAt) {
          navigate(onboardingDoneRedirect, { replace: true });
          return;
        }
        setName((current) => current || freshStudent.name || "");
        setPhotoUrl((current) => current || freshStudent.avatarUrl || "");
      })
      .catch(() => {
        if (!cancelled) navigate(loginRedirect, { replace: true });
      })
      .finally(() => {
        if (!cancelled) setCheckingProfile(false);
      });

    return () => {
      cancelled = true;
    };
  }, [navigate, onboardingDoneRedirect, redirectTo, student]);

  /* auto-focus name on step 1 */
  useEffect(() => {
    if (step === 1) {
      requestAnimationFrame(() => nameInputRef.current?.focus());
    }
  }, [step]);

  const handlePhoto = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Seleciona uma imagem válida.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5 MB.");
      return;
    }
    setCompressingPhoto(true);
    try {
      const result = await readCompressedImageFileAsDataUrl(file, {
        maxLength: 460_000,
        maxDimension: 512,
      });
      const uploaded = await api.media.uploadDataUrl(result, "avatars", { maxImageDimension: 900 });
      setPhotoUrl(uploaded.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar a fotografia.");
    } finally {
      setCompressingPhoto(false);
    }
  };

  const goTo = (target: Step) => {
    setDirection(target > step ? 1 : -1);
    setStep(target);
  };

  const canAdvanceStep1 = name.trim().length >= 2;

  const handleSubmit = async () => {
    if (!canAdvanceStep1) {
      toast.info("Preenche o teu nome completo.");
      return;
    }

    setSaving(true);
    try {
      const data: CompleteProfileInput = {
        name: name.trim(),
        avatarUrl: photoUrl.trim() || undefined,
        bio: bio.trim() || undefined,
        instagramUrl: normalizeSocialUrl(instagramUrl),
        facebookUrl: normalizeSocialUrl(facebookUrl),
        linkedinUrl: normalizeSocialUrl(linkedinUrl),
        githubUrl: normalizeSocialUrl(githubUrl),
        websiteUrl: normalizeSocialUrl(websiteUrl),
        consentPhotoCredential: Boolean(photoUrl.trim() && consentPhotoCredential),
        consentPublicProfile,
        consentSocialLinks: Boolean(filledSocials.length > 0 && consentSocialLinks),
        consentSms,
        consentWhatsapp,
      };

      await api.auth.completeProfile(data);
      setSaved(true);
      toast.success("Perfil completo! Bem-vindo.");

      setTimeout(() => navigate(onboardingDoneRedirect, { replace: true }), 1400);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível guardar o perfil.",
      );
    } finally {
      setSaving(false);
    }
  };

  const socialFields = [
    { key: "instagramUrl", label: "Instagram", icon: Instagram, value: instagramUrl, set: setInstagramUrl, placeholder: "instagram.com/utilizador" },
    { key: "facebookUrl", label: "Facebook", icon: Facebook, value: facebookUrl, set: setFacebookUrl, placeholder: "facebook.com/utilizador" },
    { key: "linkedinUrl", label: "LinkedIn", icon: Linkedin, value: linkedinUrl, set: setLinkedinUrl, placeholder: "linkedin.com/in/utilizador" },
    { key: "githubUrl", label: "GitHub", icon: Globe, value: githubUrl, set: setGithubUrl, placeholder: "github.com/utilizador" },
    { key: "websiteUrl", label: "Site / Portfolio", icon: ExternalLink, value: websiteUrl, set: setWebsiteUrl, placeholder: "meusite.com", fullWidth: true },
  ];

  const filledSocials = socialFields.filter((f) => f.value.trim());
  const consentValues: ProfileConsentValues = {
    consentPublicProfile,
    consentPhotoCredential,
    consentSocialLinks,
    consentSms,
    consentWhatsapp,
  };

  const updateConsentValue = (field: keyof ProfileConsentValues, value: boolean) => {
    if (field === "consentPublicProfile") setConsentPublicProfile(value);
    if (field === "consentPhotoCredential") setConsentPhotoCredential(value);
    if (field === "consentSocialLinks") setConsentSocialLinks(value);
    if (field === "consentSms") setConsentSms(value);
    if (field === "consentWhatsapp") setConsentWhatsapp(value);
  };

  /* ── Loading: checking profile state ── */
  if (checkingProfile) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900">
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-900">A validar sessão</p>
            <p className="mt-0.5 text-xs text-slate-400">A verificar o estado do teu perfil...</p>
          </div>
        </div>
      </div>
    );
  }

  /* ── Success overlay ── */
  if (saved) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease }}
          className="flex flex-col items-center gap-5 px-6 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 shadow-lg shadow-emerald-500/25">
              <CheckCircle2 className="h-8 w-8 text-white" />
            </div>
          </motion.div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Perfil completo!</h2>
            <p className="mt-1 text-sm text-slate-500">Os teus dados foram guardados com sucesso.</p>
          </div>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: 120 }}
            transition={{ delay: 0.4, duration: 1, ease: "linear" }}
            className="h-1 rounded-full bg-emerald-500"
          />
          <p className="text-xs text-slate-400">A redirecionar...</p>
        </motion.div>
      </div>
    );
  }

  /* ── Main form ── */
  return (
    <div className="flex min-h-[100dvh] flex-col bg-slate-50">
      {/* ── Header ── */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Completar perfil</p>
              <p className="text-[11px] text-slate-400">UOR Connect · Universidade Óscar Ribas</p>
            </div>
          </div>
          <StepIndicator current={step} />
        </div>
      </header>

      {/* ── Progress bar ── */}
      <div className="h-1 bg-slate-100">
        <motion.div
          className="h-full bg-slate-900"
          animate={{ width: step === 1 ? "33%" : step === 2 ? "66%" : "100%" }}
          transition={{ duration: 0.5, ease }}
        />
      </div>

      {/* ── Main ── */}
      <main className="flex flex-1 flex-col items-center px-4 py-6 sm:py-10">
        <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[1fr_280px]">
          {/* Main card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease }}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            {/* Card header */}
            <div className="border-b border-slate-100 px-5 py-5 sm:px-7">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-600">
                      {step}
                    </span>
                    <div>
                      <h1 className="text-base font-bold text-slate-900">
                        {step === 1 ? "Quem és tu?" : step === 2 ? "Onde te encontrar" : "Confirmar dados"}
                      </h1>
                      <p className="mt-0.5 text-sm text-slate-500">
                        {step === 1
                          ? "Adiciona o teu nome. A fotografia pode ficar para depois."
                          : step === 2
                            ? "Redes sociais opcionais — podes saltar este passo."
                            : "Revê os teus dados antes de confirmar."}
                      </p>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Steps content */}
            <div className="relative min-h-[340px] p-5 sm:min-h-[380px] sm:p-7">
              <AnimatePresence mode="wait" custom={direction}>
                {/* ════════ STEP 1 ════════ */}
                {step === 1 && (
                  <motion.div
                    key="s1"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.25, ease }}
                  >
                    <motion.div className="space-y-6" initial="hidden" animate="visible">
                      <motion.div custom={0} variants={fadeUp} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Finalidade dos dados</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Nome identifica a tua conta e documentos; fotografia só entra em credenciais se autorizares.
                        </p>
                      </motion.div>
                      {/* Photo upload */}
                      <motion.div custom={1} variants={fadeUp}>
                        <p className="mb-2.5 text-sm font-semibold text-slate-700">
                          Fotografia <span className="text-slate-400">(opcional)</span>
                        </p>
                        <label
                          className={`group relative flex cursor-pointer items-center gap-5 rounded-xl border-2 border-dashed p-5 transition-all ${
                            dragOver
                              ? "border-slate-900 bg-slate-50"
                              : photoUrl
                                ? "border-emerald-300 bg-emerald-50/30"
                                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                          }`}
                          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                          onDragLeave={() => setDragOver(false)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDragOver(false);
                            void handlePhoto(e.dataTransfer.files?.[0] ?? null);
                          }}
                        >
                          <div
                            className={`relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 transition-all ${
                              compressingPhoto
                                ? "border-slate-300 bg-slate-100"
                                : photoUrl
                                  ? "border-emerald-300 bg-white shadow-sm"
                                  : "border-slate-200 bg-slate-100 text-slate-400"
                            }`}
                          >
                            {compressingPhoto ? (
                              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                            ) : photoUrl ? (
                              <>
                                <img src={photoUrl} alt="" className="h-full w-full object-cover" />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
                                  <Camera className="h-5 w-5 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                                </div>
                              </>
                            ) : (
                              <Upload className="h-6 w-6" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800">
                              {compressingPhoto ? "A processar imagem..." : photoUrl ? "Foto carregada" : "Arrasta ou clica para carregar"}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {compressingPhoto
                                ? "A redimensionar e otimizar a fotografia."
                                : photoUrl
                                  ? "Clica para trocar a imagem. Max. 5 MB."
                                  : "Recomendada para credenciais visuais. JPG, PNG ou WebP. Max. 5 MB."}
                            </p>
                            {photoUrl && !compressingPhoto && (
                              <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                                <Check className="h-3 w-3" />
                                Pronta para utilizar
                              </span>
                            )}
                          </div>

                          <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={(e) => void handlePhoto(e.target.files?.[0] ?? null)}
                          />
                        </label>
                      </motion.div>

                      {/* Name */}
                      <motion.div custom={2} variants={fadeUp}>
                        <label className="block">
                          <span className="mb-2 block text-sm font-semibold text-slate-700">
                            Nome completo <span className="text-red-500">*</span>
                          </span>
                          <Input
                            ref={nameInputRef}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="O teu nome completo"
                            autoComplete="name"
                            className="h-11 rounded-xl border-slate-200 bg-slate-50 text-sm transition-colors focus:bg-white"
                          />
                          <p className="mt-1.5 text-[11px] text-slate-400">
                            Este nome aparecerá na tua credencial e certificados.
                          </p>
                        </label>
                      </motion.div>

                      {/* Student info (read-only) */}
                      {(student?.studentNumber || student?.course) && (
                        <motion.div custom={2} variants={fadeUp}>
                          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                            <p className="mb-2 text-xs font-semibold text-slate-400">Dados académicos (sistema)</p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {student?.studentNumber && (
                                <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2">
                                  <BadgeCheck className="h-3.5 w-3.5 text-slate-400" />
                                  <span className="text-xs text-slate-600">N.º {student.studentNumber}</span>
                                </div>
                              )}
                              {student?.course && (
                                <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2">
                                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                                  <span className="truncate text-xs text-slate-600">{student.course}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* Action */}
                      <motion.div custom={3} variants={fadeUp} className="flex justify-end pt-2">
                        <Button
                          className="h-11 rounded-xl bg-slate-900 px-6 font-semibold hover:bg-slate-800"
                          disabled={!canAdvanceStep1}
                          onClick={() => goTo(2)}
                        >
                          Continuar
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </motion.div>
                    </motion.div>
                  </motion.div>
                )}

                {/* ════════ STEP 2 ════════ */}
                {step === 2 && (
                  <motion.div
                    key="s2"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.25, ease }}
                  >
                    <motion.div className="space-y-6" initial="hidden" animate="visible">
                      <motion.div custom={0} variants={fadeUp} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Finalidade dos dados</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Bio e redes são opcionais e servem para perfil público/networking apenas com consentimento.
                        </p>
                      </motion.div>
                      {/* Bio */}
                      <motion.div custom={1} variants={fadeUp}>
                        <label className="block">
                          <span className="mb-2 block text-sm font-semibold text-slate-700">Sobre ti</span>
                          <Textarea
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            rows={3}
                            placeholder="Breve apresentação, curso ou área de interesse..."
                            className="resize-none rounded-xl border-slate-200 bg-slate-50 text-sm transition-colors focus:bg-white"
                          />
                          <p className="mt-1.5 text-[11px] text-slate-400">
                            Opcional. Aparecerá no teu perfil público.
                          </p>
                        </label>
                      </motion.div>

                      {/* Social fields */}
                      <motion.div custom={2} variants={fadeUp}>
                        <p className="mb-3 text-sm font-semibold text-slate-700">Redes sociais</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {socialFields.map((field) => {
                            const SIcon = field.icon;
                            return (
                              <label
                                key={field.key}
                                className={`block space-y-1.5 ${field.fullWidth ? "sm:col-span-2" : ""}`}
                              >
                                <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{field.label}</span>
                                <div className="relative">
                                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                                    <SIcon className="h-4 w-4" />
                                  </span>
                                  <Input
                                    value={field.value}
                                    onChange={(e) => field.set(e.target.value)}
                                    placeholder={field.placeholder}
                                    className="h-10 rounded-xl border-slate-200 bg-slate-50 pl-10 text-sm transition-colors focus:bg-white"
                                  />
                                </div>
                              </label>
                            );
                          })}
                        </div>
                        <p className="mt-2 text-[11px] text-slate-400">
                          Todos opcionais. Facilita o networking entre participantes.
                        </p>
                      </motion.div>

                      {/* Actions */}
                      <motion.div custom={3} variants={fadeUp} className="flex items-center justify-between pt-2">
                        <Button
                          variant="ghost"
                          className="h-10 rounded-xl text-slate-500"
                          onClick={() => goTo(1)}
                        >
                          <ChevronLeft className="mr-1 h-4 w-4" />
                          Voltar
                        </Button>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            className="h-10 rounded-xl border-slate-200"
                            onClick={() => goTo(3)}
                          >
                            Saltar
                          </Button>
                          <Button
                            className="h-10 rounded-xl bg-slate-900 px-5 font-semibold hover:bg-slate-800"
                            onClick={() => goTo(3)}
                          >
                            Continuar
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </div>
                      </motion.div>
                    </motion.div>
                  </motion.div>
                )}

                {/* ════════ STEP 3 ════════ */}
                {step === 3 && (
                  <motion.div
                    key="s3"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.25, ease }}
                  >
                    <motion.div className="space-y-6" initial="hidden" animate="visible">
                      {/* Review credential card */}
                      <motion.div custom={0} variants={fadeUp} className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                        <div className="relative overflow-hidden bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-4">
                          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/5 blur-xl" />
                          <div className="relative flex items-center justify-between">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/60">UOR Connect</p>
                              <p className="mt-0.5 text-xs font-semibold text-white/90">Credencial de estudante</p>
                            </div>
                            <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold text-white/70">
                              Pré-visualização
                            </span>
                          </div>
                        </div>

                        <div className="bg-white p-5">
                          <div className="flex items-center gap-4">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-slate-200 bg-slate-50">
                              {photoUrl ? (
                                <img src={photoUrl} alt={name} className="h-full w-full object-cover" />
                              ) : (
                                <User className="h-6 w-6 text-slate-400" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-base font-bold text-slate-900">{name}</p>
                              {student?.course && (
                                <p className="mt-0.5 text-xs text-slate-500">{student.course}</p>
                              )}
                              {student?.studentNumber && (
                                <span className="mt-1 inline-block rounded-md bg-slate-900 px-2 py-0.5 text-[9px] font-bold tracking-wider text-white">
                                  N.º {student.studentNumber}
                                </span>
                              )}
                            </div>
                          </div>

                          {bio && (
                            <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3">
                              <p className="text-xs leading-relaxed text-slate-600">{bio}</p>
                            </div>
                          )}

                          {filledSocials.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-1.5">
                              {filledSocials.map((s) => {
                                const SIcon = s.icon;
                                return (
                                  <span
                                    key={s.key}
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600"
                                  >
                                    <SIcon className="h-3 w-3" />
                                    {s.label}
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          {/* Data summary */}
                          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4">
                            <div className="rounded-lg bg-slate-50 px-3 py-2">
                              <p className="text-[10px] font-semibold text-slate-400">Fotografia</p>
                              <p className="mt-0.5 text-xs font-medium text-emerald-600">
                                {photoUrl ? "Carregada" : "Em falta"}
                              </p>
                            </div>
                            <div className="rounded-lg bg-slate-50 px-3 py-2">
                              <p className="text-[10px] font-semibold text-slate-400">Redes sociais</p>
                              <p className="mt-0.5 text-xs font-medium text-slate-700">
                                {filledSocials.length > 0 ? `${filledSocials.length} adicionadas` : "Nenhuma"}
                              </p>
                            </div>
                          </div>
                        </div>
                      </motion.div>

                      {/* Consent controls */}
                      <motion.div custom={1} variants={fadeUp}>
                        <ProfileConsentControls
                          values={consentValues}
                          onChange={updateConsentValue}
                          title="Privacidade"
                          description="Os dados ficam guardados, mas só aparecem publicamente quando autorizares."
                          publicProfileLabel="Autorizo mostrar a minha bio no perfil público UOR Connect."
                        />
                      </motion.div>

                      {/* Security notice */}
                      <motion.div custom={2} variants={fadeUp}>
                        <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                          <Shield className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                          <p className="text-xs leading-relaxed text-slate-500">
                            Os dados são guardados de forma segura e podes editá-los mais tarde na secção Minha Área.
                          </p>
                        </div>
                      </motion.div>

                      {/* Confirm buttons */}
                      <motion.div custom={3} variants={fadeUp} className="flex items-center justify-between pt-2">
                        <Button
                          variant="ghost"
                          className="h-10 rounded-xl text-slate-500"
                          onClick={() => goTo(2)}
                        >
                          <ChevronLeft className="mr-1 h-4 w-4" />
                          Editar
                        </Button>
                        <Button
                          className="h-11 rounded-xl bg-slate-900 px-7 font-semibold shadow-sm shadow-slate-900/20 hover:bg-slate-800"
                          disabled={saving}
                          onClick={() => void handleSubmit()}
                        >
                          {saving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="mr-2 h-4 w-4" />
                          )}
                          Confirmar e entrar
                        </Button>
                      </motion.div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* ── Desktop sidebar preview ── */}
          <aside className="hidden lg:block">
            <div className="sticky top-8 space-y-4">
              <LivePreviewCard
                name={name}
                photoUrl={photoUrl}
                bio={bio}
                course={student?.course}
                studentNumber={student?.studentNumber}
                instagramUrl={instagramUrl}
                linkedinUrl={linkedinUrl}
                githubUrl={githubUrl}
                facebookUrl={facebookUrl}
                websiteUrl={websiteUrl}
                step={step}
              />

              {/* Contextual tips */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Dica</p>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  {step === 1
                    ? "Uma boa foto de rosto ajuda outros participantes a reconhecer-te nos eventos e fica associada à tua credencial digital."
                    : step === 2
                      ? "As redes sociais são opcionais mas facilitam o networking entre participantes durante o evento."
                      : "Depois de confirmar, podes sempre editar os teus dados na secção Minha Área do portal."}
                </p>
              </div>

              {/* Progress summary */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Campos</p>
                <div className="mt-3 space-y-2">
                  {[
                    { label: "Nome", done: name.trim().length >= 2 },
                    { label: "Fotografia", done: photoUrl.length > 0 },
                    { label: "Bio", done: bio.trim().length > 0, optional: true },
                    { label: "Redes sociais", done: filledSocials.length > 0, optional: true },
                  ].map((f) => (
                    <div key={f.label} className="flex items-center justify-between">
                      <span className={`text-xs ${f.done ? "font-medium text-slate-700" : "text-slate-400"}`}>
                        {f.label}
                        {f.optional && <span className="ml-1 text-[10px] text-slate-300">(opcional)</span>}
                      </span>
                      {f.done ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <span className="h-3.5 w-3.5 rounded-full border border-slate-200" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
