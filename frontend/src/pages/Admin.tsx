import { Suspense, lazy, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Camera,
  Check,
  ChevronRight,
  Loader2,
  Lock,
  Shield,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { api, getToken, isAuthError, isForbiddenError, setToken, type AdminAccessProfile, type TeamCredentialAdminSessionProfile, type TeamCredentialPublicSubmission, type TeamCredentialRequirement } from "@/lib/api";
import { readCompressedImageFileAsDataUrl } from "@/lib/project-media";

const AdminWorkspace = lazy(() => import("@/features/admin/AdminWorkspace"));

type AdminProfileForm = TeamCredentialPublicSubmission;

function normalizeSocialUrl(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function buildInitialProfileForm(profile: TeamCredentialAdminSessionProfile): AdminProfileForm {
  return {
    name: profile.student?.name ?? profile.member?.name ?? "",
    email: profile.student?.email ?? profile.member?.email ?? "",
    phone: profile.student?.phone ?? profile.member?.phone ?? "",
    course: profile.student?.course ?? profile.member?.course ?? "",
    organization: profile.member?.organization ?? "Universidade Oscar Ribas",
    bio: profile.student?.bio ?? profile.member?.bio ?? "",
    photoUrl: profile.student?.avatarUrl ?? profile.member?.photoUrl ?? "",
    address: profile.student?.address ?? "",
    instagramUrl: profile.student?.instagramUrl ?? "",
    facebookUrl: profile.student?.facebookUrl ?? "",
    linkedinUrl: profile.student?.linkedinUrl ?? "",
    githubUrl: profile.student?.githubUrl ?? "",
    websiteUrl: profile.student?.websiteUrl ?? "",
    consentPhotoCredential: false,
    consentPublicProfile: false,
    consentSocialLinks: false,
    consentSms: false,
    consentWhatsapp: false,
  };
}

function buildAdminProfileMissingFields(form: AdminProfileForm, profile: TeamCredentialAdminSessionProfile): TeamCredentialRequirement[] {
  return [
    { key: "name", label: "Nome completo", required: true, ready: Boolean(form.name.trim()) },
    { key: "photoUrl", label: "Fotografia", required: true, ready: Boolean(form.photoUrl?.trim()) },
    { key: "consentPhotoCredential", label: "Consentimento da fotografia", required: true, ready: form.consentPhotoCredential === true },
    { key: "team", label: "Equipa ou área", required: true, ready: Boolean(profile.member?.team?.trim()) },
    { key: "role", label: "Cargo", required: true, ready: Boolean(profile.member?.role?.trim()) },
    { key: "accessLevel", label: "Nível de acesso", required: true, ready: Boolean(profile.member?.accessLevel?.trim()) },
    { key: "phone", label: "Telefone", required: false, ready: Boolean(form.phone?.trim()) },
    { key: "email", label: "Email", required: false, ready: Boolean(form.email?.trim()) },
  ]
    .filter((item) => !item.ready)
    .map(({ key, label, required }) => ({ key, label, required }));
}

function getAdminProfileCompletionScore(missingFields: TeamCredentialRequirement[]) {
  const requiredTotal = 6;
  const missingRequired = missingFields.filter((item) => item.required).length;
  return Math.max(0, Math.round(((requiredTotal - missingRequired) / requiredTotal) * 100));
}

function AdminAccessFallback({ message = "A preparar painel administrativo..." }: { message?: string }) {
  return (
    <div className="min-h-screen bg-slate-50 px-4 pt-6">
      <div className="mx-auto w-full max-w-5xl">
        <div className="site-loading-bar" role="status" aria-label={message}>
          <span className="site-loading-bar__track">
            <span className="site-loading-bar__progress" />
          </span>
          <span className="site-loading-bar__label">{message}</span>
        </div>
      </div>
    </div>
  );
}

function AdminAccessDenied({ forbidden }: { forbidden: boolean }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="h-1 bg-gradient-to-r from-red-500 via-red-400 to-red-300" />
          <div className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600">
              {forbidden ? <AlertTriangle className="h-6 w-6" /> : <Lock className="h-6 w-6" />}
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Acesso restrito</h1>
              <p className="mt-1.5 text-sm text-slate-500">
                {forbidden
                  ? "A tua conta não tem permissões para aceder a esta área administrativa."
                  : "Inicia sessão com uma conta autorizada do núcleo."}
              </p>
            </div>
            <Button asChild className="h-10 rounded-lg bg-slate-900 hover:bg-slate-800">
              <Link to="/admin/login" onClick={() => setToken(null)}>
                <Shield className="mr-2 h-4 w-4" />
                Entrar com conta autorizada
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminProfileCompletionGate({
  profile,
  onCompleted,
}: {
  profile: TeamCredentialAdminSessionProfile;
  onCompleted: () => void;
}) {
  const [form, setForm] = useState<AdminProfileForm>(() => buildInitialProfileForm(profile));
  const [saving, setSaving] = useState(false);

  const updateForm = <Key extends keyof AdminProfileForm>(key: Key, value: AdminProfileForm[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

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

    try {
      updateForm("photoUrl", await readCompressedImageFileAsDataUrl(file, { maxLength: 460_000, maxDimension: 512 }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar a fotografia.");
    }
  };

  const missingFields = buildAdminProfileMissingFields(form, profile);
  const missingRequiredFields = missingFields.filter((item) => item.required);
  const completionScore = getAdminProfileCompletionScore(missingFields);
  const allRequiredDone = missingRequiredFields.length === 0;

  const handleSubmit = async () => {
    if (!allRequiredDone) {
      toast.info(`Completa: ${missingRequiredFields.map((field) => field.label).join(", ")}.`);
      return;
    }

    setSaving(true);
    try {
      const normalizedForm = {
        ...form,
        name: form.name.trim(),
        instagramUrl: normalizeSocialUrl(form.instagramUrl),
        facebookUrl: normalizeSocialUrl(form.facebookUrl),
        linkedinUrl: normalizeSocialUrl(form.linkedinUrl),
        githubUrl: normalizeSocialUrl(form.githubUrl),
        websiteUrl: normalizeSocialUrl(form.websiteUrl),
      };

      if (!profile.student?.profileCompletedAt) {
        await api.auth.completeProfile({
          name: normalizedForm.name,
          avatarUrl: normalizedForm.photoUrl ?? "",
          bio: normalizedForm.bio ?? "",
          address: normalizedForm.address ?? "",
          instagramUrl: normalizedForm.instagramUrl,
          facebookUrl: normalizedForm.facebookUrl,
          linkedinUrl: normalizedForm.linkedinUrl,
          githubUrl: normalizedForm.githubUrl,
          websiteUrl: normalizedForm.websiteUrl,
          consentPhotoCredential: normalizedForm.consentPhotoCredential,
          consentPublicProfile: normalizedForm.consentPublicProfile,
          consentSocialLinks: normalizedForm.consentSocialLinks,
          consentSms: normalizedForm.consentSms,
          consentWhatsapp: normalizedForm.consentWhatsapp,
        });
      }

      await api.auth.updateMe({
        name: normalizedForm.name,
        email: normalizedForm.email ?? undefined,
        phone: normalizedForm.phone ?? undefined,
        course: normalizedForm.course ?? undefined,
        avatarUrl: normalizedForm.photoUrl ?? null,
        bio: normalizedForm.bio ?? null,
        address: normalizedForm.address ?? null,
        instagramUrl: normalizedForm.instagramUrl,
        facebookUrl: normalizedForm.facebookUrl,
        linkedinUrl: normalizedForm.linkedinUrl,
        githubUrl: normalizedForm.githubUrl,
        websiteUrl: normalizedForm.websiteUrl,
        consentPhotoCredential: normalizedForm.consentPhotoCredential,
        consentPublicProfile: normalizedForm.consentPublicProfile,
        consentSocialLinks: normalizedForm.consentSocialLinks,
        consentSms: normalizedForm.consentSms,
        consentWhatsapp: normalizedForm.consentWhatsapp,
      });

      await api.teamCredentials.adminSessionProfile();
      toast.success("Perfil UOR Connect atualizado e sincronizado com as credenciais.");
      onCompleted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o perfil.");
    } finally {
      setSaving(false);
    }
  };

  const fieldGroups = [
    {
      title: "Identificação",
      fields: [
        { key: "name" as const, label: "Nome completo", required: true, type: "text", span: 2, autoComplete: "name" },
        { key: "email" as const, label: "Email", required: false, type: "email", span: 1, autoComplete: "email" },
        { key: "phone" as const, label: "Telefone recomendado", required: false, type: "tel", span: 1, autoComplete: "tel" },
      ],
    },
    {
      title: "Informação adicional",
      fields: [
        { key: "course" as const, label: "Área ou curso", required: false, type: "text", span: 1, autoComplete: undefined },
        { key: "address" as const, label: "Morada reduzida opcional", required: false, type: "text", span: 1, autoComplete: undefined, placeholder: "Município, bairro ou referência" },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Completar perfil administrativo</h1>
              <p className="text-sm text-slate-500">Confirma os teus dados antes de aceder à consola.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          {/* Main form */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {/* Progress bar */}
            <div className="border-b border-slate-100 px-6 py-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">Progresso do perfil</span>
                <span className="font-semibold text-slate-900">{completionScore}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    completionScore === 100 ? "bg-emerald-500" : "bg-slate-900"
                  }`}
                  style={{ width: `${completionScore}%` }}
                />
              </div>
            </div>

            <div className="p-6">
              <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs text-slate-500">
                <p className="font-semibold text-slate-700">Finalidade dos dados</p>
                <p className="mt-1 leading-5">
                  A fotografia e o nome confirmam o acesso administrativo e a credencial da equipa. Os contactos apoiam
                  a operação interna; bio e redes só aparecem publicamente quando houver consentimento.
                </p>
              </div>

              {/* Photo upload */}
              <div className="mb-6">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Fotografia <span className="text-red-500">*</span>
                  </span>
                  <div className="flex cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed border-slate-200 p-4 transition-colors hover:border-slate-300 hover:bg-slate-50">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-slate-200 bg-slate-100">
                      {form.photoUrl ? (
                        <img src={form.photoUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Camera className="h-5 w-5 text-slate-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">
                        {form.photoUrl ? "Fotografia selecionada" : "Selecionar fotografia"}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Usada no passe e na validação do perfil. Máx. 5 MB.
                      </p>
                      {form.photoUrl && (
                        <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                          <Check className="h-3 w-3" />
                          Carregada
                        </span>
                      )}
                    </div>
                    <input type="file" accept="image/*" className="sr-only" onChange={(event) => void handlePhoto(event.target.files?.[0] ?? null)} />
                  </div>
                </label>
              </div>

              {/* Field groups */}
              {fieldGroups.map((group) => (
                <div key={group.title} className="mb-6">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{group.title}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {group.fields.map((field) => (
                      <label key={field.key} className={`block space-y-1.5 ${field.span === 2 ? "sm:col-span-2" : ""}`}>
                        <span className="text-sm font-medium text-slate-700">
                          {field.label}
                          {field.required && <span className="text-red-500"> *</span>}
                        </span>
                        <Input
                          type={field.type}
                          value={(form[field.key] as string) ?? ""}
                          onChange={(event) => updateForm(field.key, event.target.value)}
                          autoComplete={field.autoComplete}
                          placeholder={("placeholder" in field ? (field as { placeholder?: string }).placeholder : undefined) ?? ""}
                          className="h-10 rounded-lg border-slate-200 bg-slate-50 text-sm transition-colors focus:bg-white"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              {/* Bio */}
              <div className="mb-6">
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">Resumo do perfil</span>
                  <Textarea
                    value={form.bio ?? ""}
                    onChange={(event) => updateForm("bio", event.target.value)}
                    rows={3}
                    placeholder="Função, área de atuação ou breve apresentação."
                    className="resize-none rounded-lg border-slate-200 bg-slate-50 text-sm transition-colors focus:bg-white"
                  />
                </label>
              </div>

              {/* Social links */}
              <div className="mb-6">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Redes sociais (opcional)</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-slate-700">Instagram</span>
                    <Input value={form.instagramUrl ?? ""} onChange={(event) => updateForm("instagramUrl", event.target.value)} placeholder="instagram.com/utilizador" className="h-9 rounded-lg border-slate-200 bg-slate-50 text-sm" />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-slate-700">LinkedIn</span>
                    <Input value={form.linkedinUrl ?? ""} onChange={(event) => updateForm("linkedinUrl", event.target.value)} placeholder="linkedin.com/in/utilizador" className="h-9 rounded-lg border-slate-200 bg-slate-50 text-sm" />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-slate-700">GitHub</span>
                    <Input value={form.githubUrl ?? ""} onChange={(event) => updateForm("githubUrl", event.target.value)} placeholder="github.com/utilizador" className="h-9 rounded-lg border-slate-200 bg-slate-50 text-sm" />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-slate-700">Site / Portfólio</span>
                    <Input value={form.websiteUrl ?? ""} onChange={(event) => updateForm("websiteUrl", event.target.value)} placeholder="meusite.com" className="h-9 rounded-lg border-slate-200 bg-slate-50 text-sm" />
                  </label>
                </div>
              </div>

              <div className="mb-6 space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Consentimento</p>
                <label className="flex items-start gap-3 rounded-lg bg-white p-3">
                  <Checkbox
                    checked={form.consentPhotoCredential === true}
                    onCheckedChange={(value) => updateForm("consentPhotoCredential", Boolean(value))}
                    className="mt-0.5"
                  />
                  <span className="text-sm leading-snug text-slate-700">Autorizo usar a minha fotografia na credencial administrativa.</span>
                </label>
                <label className="flex items-start gap-3 rounded-lg bg-white p-3">
                  <Checkbox
                    checked={form.consentPublicProfile === true}
                    onCheckedChange={(value) => updateForm("consentPublicProfile", Boolean(value))}
                    className="mt-0.5"
                  />
                  <span className="text-sm leading-snug text-slate-700">Autorizo mostrar bio/foto no perfil público da equipa.</span>
                </label>
                <label className="flex items-start gap-3 rounded-lg bg-white p-3">
                  <Checkbox
                    checked={form.consentSocialLinks === true}
                    onCheckedChange={(value) => updateForm("consentSocialLinks", Boolean(value))}
                    className="mt-0.5"
                  />
                  <span className="text-sm leading-snug text-slate-700">Autorizo mostrar redes sociais no perfil público.</span>
                </label>
              </div>

              {/* Submit */}
              <Button
                className="h-10 w-full rounded-lg bg-slate-900 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
                disabled={saving || !allRequiredDone}
                onClick={() => void handleSubmit()}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    A guardar...
                  </>
                ) : (
                  <>
                    Guardar e entrar na consola
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="space-y-4">
            {/* Preview card */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-3">
                <p className="text-xs font-semibold tracking-wide text-white/90">Pré-visualização</p>
              </div>
              <div className="p-4">
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-slate-200 bg-slate-100 text-lg font-bold text-slate-400">
                    {form.photoUrl ? (
                      <img src={form.photoUrl} alt={form.name} className="h-full w-full object-cover" />
                    ) : (
                      "U"
                    )}
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-900">{form.name || "Nome do membro"}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{profile.member?.team ?? "Equipa"}</p>
                  {profile.member?.role && (
                    <span className="mt-2 inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-medium text-slate-600">
                      {profile.member.role}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Estado do cadastro</p>
                <div className="mt-3 space-y-2">
                  {/* Access info */}
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <span className="text-[11px] text-slate-500">Acesso</span>
                    <p className="text-sm font-medium text-slate-900">{profile.member?.accessLevel ?? "Admin"}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <span className="text-[11px] text-slate-500">N.º estudante</span>
                    <p className="text-sm font-medium text-slate-900">{profile.student?.studentNumber ?? "-"}</p>
                  </div>

                  {/* Missing fields */}
                  {missingFields.length > 0 ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                      <p className="text-[11px] font-semibold text-amber-700">Campos em falta</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {missingFields.map((field) => (
                          <span key={field.key} className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-amber-800 shadow-sm">
                            {field.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                      <p className="text-xs font-medium text-emerald-700">Tudo pronto para validação.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default function Admin() {
  const [state, setState] = useState<"checking" | "allowed" | "profile-incomplete" | "unauthenticated" | "forbidden">("checking");
  const [adminAccess, setAdminAccess] = useState<AdminAccessProfile | null>(null);
  const [adminProfileGate, setAdminProfileGate] = useState<TeamCredentialAdminSessionProfile | null>(null);

  useEffect(() => {
    let active = true;

    if (!getToken()) {
      setState("unauthenticated");
      return;
    }

    Promise.all([
      api.students.adminAccess(),
      api.teamCredentials.adminSessionProfile(),
    ])
      .then(([profile, sessionProfile]) => {
        if (active) {
          setAdminAccess(profile);
          setAdminProfileGate(sessionProfile);
          setState(sessionProfile.requiresCompletion ? "profile-incomplete" : "allowed");
        }
      })
      .catch((error) => {
        if (!active) return;
        if (isAuthError(error)) {
          setToken(null);
          setAdminAccess(null);
          setAdminProfileGate(null);
          setState("unauthenticated");
          return;
        }
        if (isForbiddenError(error)) {
          setAdminAccess(null);
          setAdminProfileGate(null);
          setState("forbidden");
          return;
        }
        setAdminAccess(null);
        setAdminProfileGate(null);
        setState("forbidden");
      });

    return () => {
      active = false;
    };
  }, []);

  if (state === "checking") return <AdminAccessFallback />;
  if (state === "profile-incomplete" && adminProfileGate) {
    return <AdminProfileCompletionGate profile={adminProfileGate} onCompleted={() => setState("allowed")} />;
  }
  if (state === "unauthenticated" || state === "forbidden") {
    return <AdminAccessDenied forbidden={state === "forbidden"} />;
  }

  return (
    <Suspense fallback={<AdminAccessFallback message="A carregar módulos administrativos..." />}>
      <AdminWorkspace adminAccess={adminAccess} />
    </Suspense>
  );
}
