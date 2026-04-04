import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { z } from "zod";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileBadge2,
  GraduationCap,
  Loader2,
  Paperclip,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { AutoFillBadge } from "@/components/auth/AutoFillBadge";
import { ResponsiveDocumentViewer } from "@/components/documents/ResponsiveDocumentViewer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, type Course, type StudentEnrollmentListItem, type StudentProfile, isAuthError, setToken } from "@/lib/api";
import { buildRoutePath, redirectToStudentLogin } from "@/lib/auth-routing";
import { getOfficialCourseFieldValue } from "@/lib/official-courses";
import { toAbsoluteAssetUrl } from "@/lib/student-documents";
import { syncStudentProfileIfNeeded } from "@/lib/student-profile";

type EnrollmentFormState = {
  fullName: string;
  email: string;
  studentCourse: string;
  phoneDigits: string;
  paymentPhoneDigits: string;
  paymentProof: string;
  paymentProofName: string;
  notes: string;
};

type EnrollmentFieldKey = keyof EnrollmentFormState;

const emptyFormState: EnrollmentFormState = {
  fullName: "",
  email: "",
  studentCourse: "",
  phoneDigits: "",
  paymentPhoneDigits: "",
  paymentProof: "",
  paymentProofName: "",
  notes: "",
};

function normalizePhoneDigits(value?: string | null) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00244")) return digits.slice(5, 14);
  if (digits.startsWith("244")) return digits.slice(3, 12);
  if (digits.startsWith("0")) return digits.slice(1, 10);
  return digits.slice(0, 9);
}

function formatPhone(digits: string) {
  return `+244 ${digits}`;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Não foi possível ler o comprovativo selecionado."));
    reader.readAsDataURL(file);
  });
}

function normalizeText(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function hydrateFromStudent(student: StudentProfile | null) {
  if (!student) return emptyFormState;

  const phoneDigits = normalizePhoneDigits(student.phone);

  return {
    fullName: student.name || "",
    email: student.email || "",
    studentCourse: getOfficialCourseFieldValue(student.course),
    phoneDigits,
    paymentPhoneDigits: phoneDigits,
    paymentProof: "",
    paymentProofName: "",
    notes: "",
  };
}

function statusTone(status: string) {
  if (status === "CONFIRMED") return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
  if (status === "PENDING") return "bg-amber-500/10 text-amber-700 border-amber-500/20";
  return "bg-slate-500/10 text-slate-700 border-slate-500/20";
}

/** Returns Tailwind classes for an input based on its validation state */
function inputClsEnroll(
  errors: Record<string, string>,
  key: string,
  value: string | boolean,
  base = "h-11 rounded-xl px-4 text-base md:text-sm"
) {
  const hasError = Boolean(errors[key]);
  const hasValue = Boolean(value);
  if (hasError) return `${base} input-invalid`;
  if (hasValue) return `${base} input-valid`;
  return base;
}

function buildEnrollmentSchema(isPaid: boolean) {
  return z.object({
    fullName: z.string().trim().min(3, "Informa o teu nome completo."),
    email: z.union([z.literal(""), z.string().trim().email("Usa um email válido.")]),
    studentCourse: z.string().trim().min(2, "Informa o teu curso académico."),
    phoneDigits: z.string().regex(/^\d{9}$/, "Indica um contacto válido com 9 dígitos."),
    paymentPhoneDigits: z.string().trim(),
    paymentProof: z.string().trim(),
    paymentProofName: z.string().trim(),
    notes: z.string().max(180, "Máximo de 180 caracteres."),
  }).superRefine((value, ctx) => {
    if (!isPaid) return;

    if (!/^\d{9}$/.test(value.paymentPhoneDigits)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["paymentPhoneDigits"], message: "Indica o número usado no pagamento." });
    }

    if (!/^(data:|https?:\/\/)/.test(value.paymentProof)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["paymentProof"], message: "Anexa o comprovativo do pagamento." });
    }
  });
}

export default function CursoInscricao() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const courseId = Number(params.id);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [course, setCourse] = useState<Course | null>(null);
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [existingEnrollment, setExistingEnrollment] = useState<StudentEnrollmentListItem | null>(null);
  const [form, setForm] = useState<EnrollmentFormState>(emptyFormState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [, setTouchedFields] = useState<Partial<Record<EnrollmentFieldKey, boolean>>>({});

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "UOR Connect | Inscrição no Curso";
    return () => {
      document.title = previousTitle;
    };
  }, []);

  useEffect(() => {
    if (!Number.isFinite(courseId) || courseId <= 0) {
      setLoading(false);
      return;
    }

    let active = true;

    Promise.all([
      api.courses.list(),
      api.auth.me(),
      api.courses.enrollmentsMine(),
    ])
      .then(([coursesPayload, currentStudent, enrollmentItems]) => {
        if (!active) return;

        const selectedCourse = coursesPayload.courses.find((entry) => entry.id === courseId) ?? null;
        const currentEnrollment = enrollmentItems.find((entry) => entry.courseId === courseId) ?? null;

        setCourse(selectedCourse);
        setStudent(currentStudent);
        setExistingEnrollment(currentEnrollment);

        const nextForm = hydrateFromStudent(currentStudent);
        if (currentEnrollment?.paymentProofPath) {
          nextForm.paymentProof = toAbsoluteAssetUrl(currentEnrollment.paymentProofPath) ?? "";
          nextForm.paymentProofName = "Comprovativo atual";
        }
        setForm(nextForm);
        setTouchedFields({});
        setErrors({});
      })
      .catch((error) => {
        if (!active) return;

        if (isAuthError(error)) {
          setToken(null);
          redirectToStudentLogin(
            navigate,
            buildRoutePath(location.pathname, location.search, location.hash),
            { replace: true, state: { from: location } }
          );
          return;
        }

        toast.error(error instanceof Error ? error.message : "Não foi possível preparar a inscrição.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [courseId, location, navigate]);

  const proofSource = form.paymentProof || toAbsoluteAssetUrl(existingEnrollment?.paymentProofPath);

  const matchesStudentField = (field: "fullName" | "email" | "studentCourse" | "phoneDigits") => {
    if (!student) return false;

    if (field === "phoneDigits") {
      return normalizePhoneDigits(student.phone) === form.phoneDigits && Boolean(form.phoneDigits);
    }

    if (field === "fullName") return normalizeText(student.name) === normalizeText(form.fullName) && Boolean(form.fullName);
    if (field === "email") return normalizeText(student.email) === normalizeText(form.email) && Boolean(form.email);
    return normalizeText(getOfficialCourseFieldValue(student.course)) === normalizeText(getOfficialCourseFieldValue(form.studentCourse)) && Boolean(form.studentCourse);
  };

  const validateField = (key: EnrollmentFieldKey, nextForm: EnrollmentFormState) => {
    const parsed = buildEnrollmentSchema(Boolean(course?.isPaid)).safeParse(nextForm);
    if (parsed.success) return null;
    return parsed.error.issues.find((issue) => String(issue.path[0] ?? "form") === key)?.message ?? null;
  };

  const updateField = <K extends EnrollmentFieldKey>(key: K, value: EnrollmentFormState[K]) => {
    const nextForm = { ...form, [key]: value };
    setForm(nextForm);
    setTouchedFields((current) => ({ ...current, [key]: true }));

    const fieldError = validateField(key, nextForm);
    setErrors((current) => {
      if (!fieldError) {
        if (!current[key]) return current;
        const next = { ...current };
        delete next[key];
        return next;
      }

      return { ...current, [key]: fieldError };
    });
  };

  const validate = () => {
    const parsed = buildEnrollmentSchema(Boolean(course?.isPaid)).safeParse(form);

    if (parsed.success) {
      setErrors({});
      return true;
    }

    const nextErrors = parsed.error.issues.reduce<Record<string, string>>((acc, issue) => {
      const key = String(issue.path[0] ?? "form");
      if (!acc[key]) acc[key] = issue.message;
      return acc;
    }, {});

    setErrors(nextErrors);
    return false;
  };

  const handleProofSelected = async (file?: File | null) => {
    if (!file) {
      updateField("paymentProof", "");
      updateField("paymentProofName", "");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("O comprovativo deve ter no máximo 5 MB.");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      updateField("paymentProof", dataUrl);
      updateField("paymentProofName", file.name);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar o comprovativo.");
    }
  };

  const handleSubmit = async () => {
    if (!course || !validate()) return;

    try {
      setSubmitting(true);
      const normalizedStudentCourse = getOfficialCourseFieldValue(form.studentCourse);

      const syncedStudent = await syncStudentProfileIfNeeded(student, {
        name: form.fullName,
        email: form.email || undefined,
        course: normalizedStudentCourse || undefined,
        phone: formatPhone(form.phoneDigits),
      });
      setStudent(syncedStudent ?? student);

      const result = await api.courses.enroll(
        course.id,
        course.isPaid
          ? {
              paymentConfirmed: true,
              paymentPhone: formatPhone(form.paymentPhoneDigits),
              paymentProof: form.paymentProof,
            }
          : undefined
      );

      const receiptPath = result.receiptPath || (result.enrollmentId ? `/cursos/inscricoes/${result.enrollmentId}` : existingEnrollment?.receiptPath);
      if (!receiptPath) {
        throw new Error("A inscrição foi criada, mas o recibo não ficou disponível.");
      }

      toast.success(course.isPaid
        ? "Inscrição atualizada. Vais agora para o recibo da inscrição."
        : "Inscrição confirmada. Vais agora para o recibo oficial.");
      navigate(receiptPath);
    } catch (error) {
      if (isAuthError(error)) {
        setToken(null);
        redirectToStudentLogin(
          navigate,
          buildRoutePath(location.pathname, location.search, location.hash),
          { replace: true, state: { from: location } }
        );
        return;
      }

      toast.error(error instanceof Error ? error.message : "Falha ao submeter a inscrição do curso.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="page-section">
        <div className="page-shell flex min-h-[60vh] items-center justify-center">
          <div className="surface-card flex items-center gap-3 px-6 py-5">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-sm font-medium text-muted-foreground">A preparar a tua inscrição no curso...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="page-section">
        <div className="page-shell">
          <div className="surface-card p-6 sm:p-8">
            <h1 className="text-2xl font-bold">Curso indisponível</h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">Não encontrámos um curso válido com este identificador.</p>
            <Button asChild className="mt-6 rounded-xl">
              <Link to="/cursos">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar aos cursos
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-section">
      <div className="page-shell space-y-8">
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="surface-card border-border/70 bg-[linear-gradient(145deg,rgba(253,131,5,0.12),rgba(255,255,255,0.98),rgba(34,61,66,0.08))] p-6 sm:p-8"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <Link to="/cursos" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
                Voltar aos cursos
              </Link>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary shadow-sm">
                <Sparkles className="h-3.5 w-3.5" />
                Inscrição protegida
              </div>
              <div>
                <h1 className="font-heading text-3xl font-bold sm:text-4xl">{course.name}</h1>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
                  O formulário usa auto-preenchimento da conta autenticada, preview controlado do comprovativo e redireciona sempre para o recibo canónico da inscrição.
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-white/70 bg-white/85 px-5 py-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Parceiro</p>
              <p className="mt-2 text-base font-semibold">{course.companyName}</p>
              <p className="text-sm text-muted-foreground">{course.companyCategory}</p>
            </div>
          </div>
        </motion.section>

        {existingEnrollment ? (
          <div className="surface-card flex flex-col gap-4 border-primary/20 bg-primary/[0.05] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-primary">Já tens uma inscrição neste curso.</p>
              <p className="mt-1 text-sm leading-7 text-muted-foreground">
                Podes atualizar o comprovativo aqui ou abrir diretamente o recibo atual com estado <span className="font-semibold">{existingEnrollment.statusLabel}</span>.
              </p>
            </div>
            <Button asChild variant="outline" className="rounded-xl">
              <Link to={existingEnrollment.receiptPath}>
                Abrir recibo atual
                <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        ) : null}

        <div className="responsive-two-col items-start">
          <section className="space-y-6">
            <div className="surface-card space-y-5 p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Dados sincronizados</p>
                <h2 className="mt-2 text-xl font-semibold">Perfil do estudante</h2>
              </div>

              <div className="responsive-two-col">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome completo</Label>
                  <Input id="fullName" value={form.fullName} onChange={(event) => updateField("fullName", event.target.value)} className={inputClsEnroll(errors, "fullName", form.fullName)} />
                  <AutoFillBadge visible={matchesStudentField("fullName")} />
                  {errors.fullName ? <p className="field-error-msg"><span className="inline-block h-3 w-3 rounded-full bg-destructive/20">·</span>{errors.fullName}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} className={inputClsEnroll(errors, "email", form.email)} />
                  <AutoFillBadge visible={matchesStudentField("email")} />
                  {errors.email ? <p className="field-error-msg"><span className="inline-block h-3 w-3 rounded-full bg-destructive/20">·</span>{errors.email}</p> : null}
                </div>
              </div>

              <div className="responsive-two-col">
                <div className="space-y-2">
                  <Label htmlFor="studentCourse">Curso académico</Label>
                  <Input id="studentCourse" value={form.studentCourse} onChange={(event) => updateField("studentCourse", event.target.value)} className={inputClsEnroll(errors, "studentCourse", form.studentCourse)} />
                  <AutoFillBadge visible={matchesStudentField("studentCourse")} />
                  {errors.studentCourse ? <p className="field-error-msg"><span className="inline-block h-3 w-3 rounded-full bg-destructive/20">·</span>{errors.studentCourse}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phoneDigits">Telefone principal</Label>
                  <Input id="phoneDigits" value={formatPhone(form.phoneDigits)} onChange={(event) => updateField("phoneDigits", normalizePhoneDigits(event.target.value))} className={inputClsEnroll(errors, "phoneDigits", form.phoneDigits)} />
                  <AutoFillBadge visible={matchesStudentField("phoneDigits")} />
                  {errors.phoneDigits ? <p className="field-error-msg"><span className="inline-block h-3 w-3 rounded-full bg-destructive/20">·</span>{errors.phoneDigits}</p> : null}
                </div>
              </div>

              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Número de estudante</p>
                <p className="mt-2 text-sm font-semibold">{student?.studentNumber || "Não disponível"}</p>
              </div>
            </div>

            <div className="surface-card space-y-5 p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Comprovativo e contacto de validação</p>
                <h2 className="mt-2 text-xl font-semibold">PDFs e imagens em viewport controlado</h2>
              </div>

              {course.isPaid ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="paymentPhoneDigits">Telefone usado no pagamento</Label>
                    <Input id="paymentPhoneDigits" value={formatPhone(form.paymentPhoneDigits)} onChange={(event) => updateField("paymentPhoneDigits", normalizePhoneDigits(event.target.value))} className={inputClsEnroll(errors, "paymentPhoneDigits", form.paymentPhoneDigits)} />
                    {errors.paymentPhoneDigits ? <p className="field-error-msg"><span className="inline-block h-3 w-3 rounded-full bg-destructive/20">·</span>{errors.paymentPhoneDigits}</p> : null}
                  </div>

                  <label className="grid cursor-pointer gap-4 rounded-3xl border border-dashed border-primary/30 bg-primary/[0.03] p-5 transition-colors hover:border-primary/50">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{form.paymentProofName || "Selecionar PDF ou imagem do comprovativo"}</p>
                      <p className="mt-1 text-xs leading-6 text-muted-foreground">O preview é contido e não deixa o texto do PDF quebrar o layout da página.</p>
                    </div>
                    <div className="inline-flex h-11 w-fit items-center justify-center rounded-xl bg-primary/10 px-4 text-sm font-semibold text-primary">
                      <Paperclip className="mr-2 h-4 w-4" />
                      Escolher ficheiro
                    </div>
                    <input
                      type="file"
                      accept="application/pdf,image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(event) => void handleProofSelected(event.target.files?.[0])}
                    />
                  </label>
                  {errors.paymentProof ? <p className="text-xs font-medium text-destructive">{errors.paymentProof}</p> : null}

                  <ResponsiveDocumentViewer
                    title="Comprovativo anexado"
                    description="Preview com altura máxima e scroll interno para manter a composição estável em telas pequenas."
                    source={proofSource}
                    fileName={form.paymentProofName || (existingEnrollment?.paymentProofPath ? "Comprovativo atual" : null)}
                  />
                </>
              ) : (
                <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/[0.05] p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                      <GraduationCap className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Curso gratuito</p>
                      <p className="mt-1 text-sm leading-7 text-muted-foreground">Não precisas anexar comprovativo. Depois de confirmar, vais diretamente para o recibo da inscrição.</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">Notas rápidas</Label>
                <Textarea id="notes" value={form.notes} onChange={(event) => updateField("notes", event.target.value.slice(0, 180))} className={`min-h-[120px] rounded-xl px-4 py-3 text-base md:text-sm ${errors.notes ? 'input-invalid' : ''}`} placeholder="Contexto opcional para a tua organização pessoal." />
                {errors.notes ? <p className="field-error-msg"><span className="inline-block h-3 w-3 rounded-full bg-destructive/20">·</span>{errors.notes}</p> : null}
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="surface-card space-y-4 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <FileBadge2 className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Resumo da inscrição</p>
                  <p className="text-lg font-semibold">{course.isPaid ? course.priceLabel || "Curso pago" : "Curso gratuito"}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Curso</p>
                  <p className="mt-2 text-sm font-semibold">{course.name}</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Parceiro</p>
                  <p className="mt-2 text-sm font-semibold">{course.companyName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{course.companyCategory}</p>
                </div>
                {existingEnrollment ? (
                  <div className={`rounded-2xl border p-4 ${statusTone(existingEnrollment.paymentStatus)}`}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">Estado atual</p>
                    <p className="mt-2 text-sm font-semibold">{existingEnrollment.statusLabel}</p>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="surface-card space-y-4 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Fluxo</p>
              <div className="space-y-3">
                {[
                  "Os teus dados são atualizados primeiro na conta do estudante.",
                  "O botão final redireciona sempre para o recibo canónico da inscrição.",
                  "O histórico fica acessível mais tarde em Minha Área.",
                ].map((item, index) => (
                  <div key={item} className="flex gap-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{index + 1}</div>
                    <p className="text-sm leading-6 text-muted-foreground">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="surface-card p-6">
              <div className="flex flex-col gap-3">
                <Button onClick={() => void handleSubmit()} disabled={submitting} className="h-11 rounded-xl">
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  {existingEnrollment ? "Atualizar e abrir recibo" : "Confirmar e abrir recibo"}
                </Button>
                {existingEnrollment ? (
                  <Button asChild variant="outline" className="h-11 rounded-xl">
                    <Link to={existingEnrollment.receiptPath}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Ver recibo atual
                    </Link>
                  </Button>
                ) : null}
                <Button asChild variant="outline" className="h-11 rounded-xl">
                  <Link to="/minha-area">Minha Área</Link>
                </Button>
              </div>
            </div>

            <div className="surface-card space-y-4 p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Comunidade e PDF sob controlo</p>
                  <p className="mt-1 text-sm leading-7 text-muted-foreground">O download do PDF fica no recibo, e a comunidade abre a partir do estado real da inscrição.</p>
                </div>
              </div>
              {course.communityUrl ? (
                <Button asChild variant="outline" className="w-full justify-start rounded-xl">
                  <a href={course.communityUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Comunidade do curso
                  </a>
                </Button>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                  A comunidade deste curso ainda não foi configurada.
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
