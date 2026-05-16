import { useEffect, useRef, useState } from "react";
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
} from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { ResponsiveDocumentViewer } from "@/components/documents/ResponsiveDocumentViewer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, type Course, type StudentEnrollmentListItem, type StudentProfile, type SubmissionConfig, isAuthError, setToken } from "@/lib/api";
import { buildRoutePath, redirectToStudentLogin } from "@/lib/auth-routing";
import { getOfficialCourseFieldValue } from "@/lib/official-courses";
import { toAbsoluteAssetUrl } from "@/lib/student-documents";
import { syncStudentProfileIfNeeded } from "@/lib/student-profile";

type EnrollmentFormState = {
  fullName: string;
  studentCourse: string;
  phoneDigits: string;
  paymentProof: string;
  paymentProofName: string;
  notes: string;
};

type EnrollmentFieldKey = keyof EnrollmentFormState;

const emptyFormState: EnrollmentFormState = {
  fullName: "",
  studentCourse: "",
  phoneDigits: "",
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

function hydrateFromStudent(student: StudentProfile | null) {
  if (!student) return emptyFormState;

  const phoneDigits = normalizePhoneDigits(student.phone);

  return {
    fullName: student.name || "",
    studentCourse: getOfficialCourseFieldValue(student.course),
    phoneDigits,
    paymentProof: "",
    paymentProofName: "",
    notes: "",
  };
}

function statusTone(status: string) {
  if (["CONFIRMED_BY_ADMIN", "CONFIRMED", "APPROVED"].includes(status)) return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
  if (["PENDING_REVIEW", "PENDING", "SUBMITTED_BY_USER"].includes(status)) return "bg-amber-500/10 text-amber-700 border-amber-500/20";
  return "bg-slate-500/10 text-slate-700 border-slate-500/20";
}

function buildEnrollmentSchema(isPaid: boolean) {
  return z.object({
    fullName: z.string().trim(),
    studentCourse: z.string().trim(),
    phoneDigits: z.string().trim(),
    paymentProof: z.string().trim(),
    paymentProofName: z.string().trim(),
    notes: z.string().max(180, "Máximo de 180 caracteres."),
  }).superRefine((value, ctx) => {
    if (!isPaid) return;

    if (!/^(data:|https?:\/\/|\/(?:api\/)?media\/files\/)/.test(value.paymentProof)) {
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
  const [paymentConfig, setPaymentConfig] = useState<SubmissionConfig | null>(null);
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [existingEnrollment, setExistingEnrollment] = useState<StudentEnrollmentListItem | null>(null);
  const [form, setForm] = useState<EnrollmentFormState>(emptyFormState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [, setTouchedFields] = useState<Partial<Record<EnrollmentFieldKey, boolean>>>({});
  const [proofReading, setProofReading] = useState(false);
  const [isDraggingProof, setIsDraggingProof] = useState(false);
  const latestPaymentProofRef = useRef("");
  const selectedPaymentProofFileRef = useRef<File | null>(null);

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
      api.submissions.config(),
    ])
      .then(([coursesPayload, currentStudent, enrollmentItems, submissionConfig]) => {
        if (!active) return;

        const selectedCourse = coursesPayload.courses.find((entry) => entry.id === courseId) ?? null;
        const currentEnrollment = enrollmentItems.find((entry) => entry.courseId === courseId) ?? null;

        setCourse(selectedCourse);
        setPaymentConfig(submissionConfig);
        setStudent(currentStudent);
        setExistingEnrollment(currentEnrollment);

        const nextForm = hydrateFromStudent(currentStudent);
        if (currentEnrollment?.paymentProofPath) {
          nextForm.paymentProof = toAbsoluteAssetUrl(currentEnrollment.paymentProofPath) ?? "";
          nextForm.paymentProofName = "Comprovativo atual";
        }
        latestPaymentProofRef.current = nextForm.paymentProof;
        selectedPaymentProofFileRef.current = null;
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

  const validateField = (key: EnrollmentFieldKey, nextForm: EnrollmentFormState) => {
    const parsed = buildEnrollmentSchema(Boolean(course?.isPaid)).safeParse(nextForm);
    if (parsed.success) return null;
    return parsed.error.issues.find((issue) => String(issue.path[0] ?? "form") === key)?.message ?? null;
  };

  const applyFieldPatch = (patch: Partial<EnrollmentFormState>, touchedKeys: EnrollmentFieldKey[]) => {
    if (Object.prototype.hasOwnProperty.call(patch, "paymentProof")) {
      latestPaymentProofRef.current = patch.paymentProof ?? "";
    }

    setTouchedFields((current) => {
      const next = { ...current };
      for (const key of touchedKeys) {
        next[key] = true;
      }
      return next;
    });

    setForm((currentForm) => {
      const nextForm = { ...currentForm, ...patch };

      setErrors((current) => {
        const next = { ...current };
        for (const key of touchedKeys) {
          const fieldError = validateField(key, nextForm);
          if (fieldError) {
            next[key] = fieldError;
          } else {
            delete next[key];
          }
        }
        return next;
      });

      return nextForm;
    });
  };

  const updateField = <K extends EnrollmentFieldKey>(key: K, value: EnrollmentFormState[K]) => {
    applyFieldPatch({ [key]: value }, [key]);
  };

  const validate = (nextForm: EnrollmentFormState = { ...form, paymentProof: form.paymentProof || latestPaymentProofRef.current }) => {
    const parsed = buildEnrollmentSchema(Boolean(course?.isPaid)).safeParse(nextForm);

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
      selectedPaymentProofFileRef.current = null;
      applyFieldPatch({ paymentProof: "", paymentProofName: "" }, ["paymentProof", "paymentProofName"]);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      selectedPaymentProofFileRef.current = null;
      toast.error("O comprovativo deve ter no máximo 5 MB.");
      return;
    }

    selectedPaymentProofFileRef.current = file;

    try {
      setProofReading(true);
      const dataUrl = await readFileAsDataUrl(file);
      if (!dataUrl.startsWith("data:")) {
        throw new Error("O ficheiro selecionado não gerou um comprovativo válido.");
      }
      const uploaded = await api.media.uploadDataUrl(dataUrl, "course-payment-proofs", { allowDocuments: true });
      applyFieldPatch({ paymentProof: uploaded.url, paymentProofName: file.name }, ["paymentProof", "paymentProofName"]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar o comprovativo.");
    } finally {
      setProofReading(false);
    }
  };

  const resolvePaymentProofForSubmit = async () => {
    const currentProof = form.paymentProof || latestPaymentProofRef.current;
    if (currentProof) return currentProof;

    const selectedFile = selectedPaymentProofFileRef.current;
    if (!selectedFile) return "";

    try {
      setProofReading(true);
      const dataUrl = await readFileAsDataUrl(selectedFile);
      if (!dataUrl.startsWith("data:")) {
        throw new Error("O ficheiro selecionado não gerou um comprovativo válido.");
      }
      const uploaded = await api.media.uploadDataUrl(dataUrl, "course-payment-proofs", { allowDocuments: true });
      applyFieldPatch(
        { paymentProof: uploaded.url, paymentProofName: selectedFile.name },
        ["paymentProof", "paymentProofName"],
      );
      return uploaded.url;
    } finally {
      setProofReading(false);
    }
  };

  const handleProofDrop: React.DragEventHandler<HTMLLabelElement> = async (event) => {
    event.preventDefault();
    setIsDraggingProof(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      await handleProofSelected(file);
    }
  };

  const handleProofDragOver: React.DragEventHandler<HTMLLabelElement> = (event) => {
    event.preventDefault();
    setIsDraggingProof(true);
  };

  const handleProofDragLeave: React.DragEventHandler<HTMLLabelElement> = () => setIsDraggingProof(false);

  const handleSubmit = async () => {
    if (proofReading) {
      toast.info("Aguarda o carregamento do comprovativo terminar.");
      return;
    }

    if (!course) return;

    let resolvedPaymentProof = form.paymentProof || latestPaymentProofRef.current;
    if (course.isPaid && !resolvedPaymentProof && selectedPaymentProofFileRef.current) {
      try {
        resolvedPaymentProof = await resolvePaymentProofForSubmit();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível carregar o comprovativo.");
        return;
      }
    }

    const submissionForm = { ...form, paymentProof: resolvedPaymentProof };
    if (!validate(submissionForm)) return;

    try {
      setSubmitting(true);
      const normalizedStudentCourse = getOfficialCourseFieldValue(submissionForm.studentCourse);

      const syncedStudent = await syncStudentProfileIfNeeded(student, {
        name: submissionForm.fullName || undefined,
        course: normalizedStudentCourse || undefined,
        phone: /^\d{9}$/.test(submissionForm.phoneDigits) ? formatPhone(submissionForm.phoneDigits) : undefined,
      });
      setStudent(syncedStudent ?? student);

      const result = await api.courses.enroll(
        course.id,
        course.isPaid
          ? {
              paymentConfirmed: true,
              paymentProof: submissionForm.paymentProof,
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
          className="surface-card border-border/70 bg-card p-6 sm:p-8"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <Link to="/cursos" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
                Voltar aos cursos
              </Link>
              <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                Inscrição protegida
              </div>
              <div>
                <h1 className="font-heading text-3xl font-bold sm:text-4xl">{course.name}</h1>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
                  Confirma os teus dados e conclui a inscrição para abrir o recibo oficial do curso.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/20 px-5 py-4">
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
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Detalhes de pagamento</p>
                <h2 className="mt-2 text-xl font-semibold">{course.isPaid ? "Transferência e comprovativo" : "Curso gratuito"}</h2>
              </div>

              {course.isPaid ? (
                <>
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                    <dl className="grid gap-3 text-sm sm:grid-cols-3">
                      <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">IBAN</dt>
                        <dd className="mt-1 break-words font-mono font-semibold">{paymentConfig?.iban || "IBAN por confirmar"}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Titular</dt>
                        <dd className="mt-1 font-semibold">{paymentConfig?.accountName || "Universidade Óscar Ribas"}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Montante</dt>
                        <dd className="mt-1 font-semibold">{paymentConfig?.paymentAmount || course.priceLabel || "Por confirmar"}</dd>
                      </div>
                    </dl>
                  </div>
                  {paymentConfig?.paymentInstructions ? (
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Instruções</p>
                      <p className="mt-2 text-sm leading-7 text-muted-foreground">{paymentConfig.paymentInstructions}</p>
                    </div>
                  ) : null}

                  <label
                    className={`grid cursor-pointer gap-4 rounded-xl border border-dashed p-5 transition-colors ${
                      isDraggingProof ? "border-primary bg-primary/5" : "border-border bg-white hover:border-primary/50"
                    }`}
                    onDragOver={handleProofDragOver}
                    onDragLeave={handleProofDragLeave}
                    onDrop={handleProofDrop}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{form.paymentProofName || "Selecionar PDF ou imagem do comprovativo"}</p>
                      <p className="mt-1 text-xs leading-6 text-muted-foreground">PDF, PNG, JPG ou WEBP até 5 MB.</p>
                    </div>
                    <div className="inline-flex h-10 w-fit items-center justify-center rounded-lg border border-border px-4 text-sm font-semibold">
                      <Paperclip className="mr-2 h-4 w-4" />
                      Escolher ficheiro
                    </div>
                    <input
                      type="file"
                      accept="application/pdf,image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(event) => {
                        const input = event.currentTarget;
                        const file = input.files?.[0] ?? null;
                        void handleProofSelected(file).finally(() => {
                          input.value = "";
                        });
                      }}
                    />
                  </label>
                  {errors.paymentProof ? <p className="text-xs font-medium text-destructive">{errors.paymentProof}</p> : null}
                  {proofReading ? (
                    <p className="text-xs font-medium text-primary">A carregar o comprovativo selecionado...</p>
                  ) : form.paymentProof ? (
                    <p className="text-xs font-medium text-emerald-600">Comprovativo carregado e pronto para envio.</p>
                  ) : null}

                  {form.paymentProof ? (
                    <div className="flex justify-end">
                      <Button type="button" variant="ghost" size="sm" onClick={() => void handleProofSelected(null)}>
                        Remover ficheiro
                      </Button>
                    </div>
                  ) : null}

                  <ResponsiveDocumentViewer
                    title="Comprovativo anexado"
                    source={proofSource}
                    fileName={form.paymentProofName || (existingEnrollment?.paymentProofPath ? "Comprovativo atual" : null)}
                  />
                </>
              ) : (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
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
                <Button onClick={() => void handleSubmit()} disabled={submitting || proofReading} className="h-11 rounded-xl">
                  {submitting || proofReading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  {proofReading ? "A carregar comprovativo" : existingEnrollment ? "Atualizar e abrir recibo" : "Confirmar e abrir recibo"}
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
                  {course.isPaid && !["CONFIRMED_BY_ADMIN", "CONFIRMED", "APPROVED"].includes(existingEnrollment?.paymentStatus ?? "")
                    ? "A comunidade fica disponível no recibo depois da validação do pagamento."
                    : "A comunidade deste curso ainda não foi configurada."}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
