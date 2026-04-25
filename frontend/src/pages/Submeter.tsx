import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileBadge2,
  Lightbulb,
  Loader2,
  Package,
  Paperclip,
  Plus,
  ShieldX,
  ShieldCheck,
  Store,
  Trash2,
  Upload,
  X,
  Info,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AutoFillBadge } from "@/components/auth/AutoFillBadge";
import { ResponsiveDocumentViewer } from "@/components/documents/ResponsiveDocumentViewer";
import {
  api,
  type CreateSubmissionInput,
  type StudentProfile,
  type StudentSubmissionReceipt,
  type SubmissionConfig,
  isAuthError,
  setToken,
} from "@/lib/api";
import { buildSubmeterSchema } from "./submeter.schema";
import { buildRoutePath, redirectToStudentLogin } from "@/lib/auth-routing";
import {
  getOfficialCourseFieldValue,
  getOfficialCourseSelectOptions,
  normalizeOfficialCourse,
} from "@/lib/official-courses";
import { syncStudentProfileIfNeeded } from "@/lib/student-profile";
import { toAbsoluteAssetUrl } from "@/lib/student-documents";

type SubmissionKind = "projeto" | "negocio" | "produto";

type SubmissionFormState = {
  leaderName: string;
  phoneDigits: string;
  academicCourse: string;
  name: string;
  description: string;
  area: string;
  advisor: string;
  organizationName: string;
  stage: string;
  category: string;
  productType: string;
  priceAverage: string;
  repoUrl: string;
  websiteUrl: string;
  observations: string;
  agreeRules: boolean;
  paymentConfirmed: boolean;
  paymentProof: string;
  paymentProofName: string;
  members: string[];
  needs: string[];
};

type SubmissionFieldKey = keyof SubmissionFormState;

const submissionKinds: Array<{
  id: SubmissionKind;
  label: string;
  description: string;
  icon: typeof Lightbulb;
  gradient: string;
}> = [
  {
    id: "projeto",
    label: "Expor Projeto",
    description: "Projeto académico ou tecnológico com acesso a votação pública e prémio.",
    icon: Lightbulb,
    gradient: "from-[hsl(var(--area-iot))]/20 to-primary/10",
  },
  {
    id: "negocio",
    label: "Expor Negócio",
    description: "Startup, empresa ou ideia de negócio em categoria de exposição.",
    icon: Store,
    gradient: "from-[hsl(var(--area-negocio))]/20 to-[hsl(var(--area-negocio))]/10",
  },
  {
    id: "produto",
    label: "Expor Produto",
    description: "Produto físico ou digital em categoria de exposição.",
    icon: Package,
    gradient: "from-[hsl(var(--area-produto))]/20 to-[hsl(var(--area-produto))]/10",
  },
];

const projectAreas = ["Engenharia", "Tecnologia", "Sustentabilidade", "Inovação", "Ciências Aplicadas", "Outra"];
const businessAreas = ["Tecnologia", "Comércio", "Serviços", "Alimentação", "Educação", "Saúde", "Outra"];
const productAreas = ["Hardware", "Software", "Alimentar", "Artesanato", "Vestuário", "Outro"];
const businessStages = ["Ideia", "Protótipo", "MVP", "Funcionando", "Já no Mercado"];
const productTypes = ["Físico", "Digital", "Híbrido"];
const needsOptions = ["Tomada elétrica", "Projetor multimédia", "Ligação à internet", "Mesa de exposição", "Espaço extra"];


const defaultConfig: SubmissionConfig = {
  key: "default",
  isOpen: true,
  iban: "AO006 0055 0000 3295 0561 10379",
  accountName: "Universidade Óscar Ribas",
  paymentAmount: "15.000 Kz",
  paymentInstructions: "Confirma a transferência antes de finalizar a candidatura.",
  projectCommunityUrl: null,
  businessCommunityUrl: null,
  productCommunityUrl: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const emptyFormState: SubmissionFormState = {
  leaderName: "",
  phoneDigits: "",
  academicCourse: "",
  name: "",
  description: "",
  area: "",
  advisor: "",
  organizationName: "",
  stage: "",
  category: "",
  productType: "",
  priceAverage: "",
  repoUrl: "",
  websiteUrl: "",
  observations: "",
  agreeRules: false,
  paymentConfirmed: false,
  paymentProof: "",
  paymentProofName: "",
  members: [],
  needs: [],
};



function normalizeSubmissionPhoneDigits(value?: string | null) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("2449")) return digits.slice(4, 12);
  if (digits.startsWith("9")) return digits.slice(1, 9);
  return digits.slice(-8);
}

function extractSubmissionPhoneDigits(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("2449")) return digits.slice(4, 12);
  if (digits.startsWith("244")) return digits.slice(3, 11);
  if (digits.startsWith("9")) return digits.slice(1, 9);
  return digits.slice(0, 8);
}

function formatSubmissionPhone(digits: string) {
  return `+244 9${digits}`;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Não foi possível ler o ficheiro selecionado."));
    reader.readAsDataURL(file);
  });
}

function normalizeText(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

/**
 * Renders an animated error message for a form field.
 * Uses AnimatePresence for smooth mount/unmount. Accessible via role+aria-live.
 */
function errorId(key: SubmissionFieldKey) {
  return `${String(key)}-error`;
}

function fieldError(
  errors: Record<string, string>,
  key: SubmissionFieldKey,
  touched = true,
  id?: string
) {
  const message = errors[key];
  const shouldShow = Boolean(touched && message);
  if (!shouldShow) return null;

  const text = message.startsWith("⚠") ? message : `⚠ ${message}`;
  return (
    <AnimatePresence>
      {shouldShow ? (
        <motion.p
          key={`err-${key}`}
          id={id}
          role="alert"
          aria-live="polite"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
          className="mt-1.5 flex items-center gap-1 font-mono text-xs text-red-400"
        >
          {text}
        </motion.p>
      ) : null}
    </AnimatePresence>
  );
}

/** Returns Tailwind classes for an input based on its validation state */
function inputCls(
  errors: Record<string, string>,
  key: SubmissionFieldKey,
  value: string | boolean | string[],
  base = "h-11 rounded-xl px-4 text-base md:text-sm",
  touched = false
) {
  const hasError = Boolean(errors[key]);
  const hasValue = Array.isArray(value) ? value.length > 0 : Boolean(value);
  if (touched && hasError) return `${base} input-invalid`;
  if (touched && hasValue) return `${base} input-valid`;
  return base;
}

function studentFieldCardClassName(autoFilled: boolean) {
  return autoFilled ? "field-shell field-shell--auto space-y-2" : "field-shell space-y-2";
}

function extractObservationValue(observations: string | null, prefix: string) {
  if (!observations) return "";
  const line = observations.split("\n").find((entry) => entry.startsWith(prefix));
  return line ? line.slice(prefix.length).trim() : "";
}

function cleanEditableObservations(observations: string | null) {
  if (!observations) return "";

  return observations
    .split("\n")
    .filter((line) => ![
      "Docente orientador:",
      "Entidade:",
      "Média de preço estimado:",
    ].some((prefix) => line.startsWith(prefix)))
    .join("\n")
    .trim();
}

function typeFromReceipt(receiptType: string): SubmissionKind {
  if (receiptType === "BUSINESS") return "negocio";
  if (receiptType === "PRODUCT") return "produto";
  return "projeto";
}

function mapReceiptToForm(receipt: StudentSubmissionReceipt): SubmissionFormState {
  return {
    leaderName: receipt.leaderName ?? "",
    phoneDigits: normalizeSubmissionPhoneDigits(receipt.leaderPhone),
    academicCourse: getOfficialCourseFieldValue(receipt.course),
    name: receipt.name,
    description: receipt.description,
    area: receipt.area,
    advisor: extractObservationValue(receipt.observations, "Docente orientador: "),
    organizationName: extractObservationValue(receipt.observations, "Entidade: "),
    stage: receipt.stage ?? "",
    category: receipt.category ?? "",
    productType: receipt.productType ?? "",
    priceAverage: extractObservationValue(receipt.observations, "Média de preço estimado: "),
    repoUrl: receipt.repoUrl ?? "",
    websiteUrl: receipt.websiteUrl ?? "",
    observations: cleanEditableObservations(receipt.observations),
    agreeRules: true,
    paymentConfirmed: true,
    paymentProof: toAbsoluteAssetUrl(receipt.paymentProofPath) ?? "",
    paymentProofName: receipt.paymentProofPath ? "Comprovativo atual" : "",
    members: receipt.membersList,
    needs: receipt.needs,
  };
}

function hydrateFromStudent(form: SubmissionFormState, student: StudentProfile | null) {
  if (!student) return form;

  return {
    ...form,
    leaderName: form.leaderName || student.name || "",
    academicCourse: form.academicCourse || getOfficialCourseFieldValue(student.course),
    phoneDigits: form.phoneDigits || normalizeSubmissionPhoneDigits(student.phone),
  };
}

function withCurrentOption(options: readonly string[], value?: string | null) {
  const trimmedValue = value?.trim();

  if (!trimmedValue || options.includes(trimmedValue)) {
    return [...options];
  }

  return [trimmedValue, ...options];
}

function submissionTypeToApi(kind: SubmissionKind): CreateSubmissionInput["type"] {
  if (kind === "negocio") return "BUSINESS";
  if (kind === "produto") return "PRODUCT";
  return "PROJECT";
}

export default function Submeter() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const editId = Number(searchParams.get("editar"));
  const isEditMode = Number.isFinite(editId) && editId > 0;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<SubmissionConfig>(defaultConfig);
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [editingReceipt, setEditingReceipt] = useState<StudentSubmissionReceipt | null>(null);
  const [kind, setKind] = useState<SubmissionKind | null>(null);
  const [form, setForm] = useState<SubmissionFormState>(emptyFormState);
  const [memberInput, setMemberInput] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Partial<Record<SubmissionFieldKey, boolean>>>({});
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = isEditMode ? "UOR Connect | Editar Submissão" : "UOR Connect | Submeter Exposição";
    return () => {
      document.title = previousTitle;
    };
  }, [isEditMode]);

  useEffect(() => {
    let active = true;

    Promise.all([
      api.submissions.config().catch(() => defaultConfig),
      api.auth.me(),
      isEditMode ? api.submissions.receipt(editId) : Promise.resolve(null),
    ])
      .then(([submissionConfig, currentStudent, receipt]) => {
        if (!active) return;

        setConfig(submissionConfig);
        setStudent(currentStudent);
        setEditingReceipt(receipt);

        if (receipt) {
          const nextKind = typeFromReceipt(receipt.type);
          setKind(nextKind);
          setForm(hydrateFromStudent(mapReceiptToForm(receipt), currentStudent));
          setTouchedFields({});
          setErrors({});
          return;
        }

        setForm((current) => hydrateFromStudent(current, currentStudent));
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

        toast.error(error instanceof Error ? error.message : "Não foi possível preparar a submissão.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [editId, isEditMode, location, navigate]);

  const selectedKind = useMemo(() => submissionKinds.find((entry) => entry.id === kind) ?? null, [kind]);
  const previewDocumentSource = form.paymentProof || toAbsoluteAssetUrl(editingReceipt?.paymentProofPath);
  const editingLocked = Boolean(isEditMode && editingReceipt && !editingReceipt.canEdit);
  const academicCourseOptions = useMemo(
    () => getOfficialCourseSelectOptions(form.academicCourse),
    [form.academicCourse]
  );
  const availableAreas = useMemo(
    () => withCurrentOption(kind === "projeto" ? projectAreas : kind === "negocio" ? businessAreas : productAreas, form.area),
    [form.area, kind]
  );
  const availableBusinessStages = useMemo(() => withCurrentOption(businessStages, form.stage), [form.stage]);
  const availableProductAreas = useMemo(() => withCurrentOption(productAreas, form.category), [form.category]);
  const availableProductTypes = useMemo(() => withCurrentOption(productTypes, form.productType), [form.productType]);

  const matchesStudentField = (field: "leaderName" | "academicCourse" | "phoneDigits") => {
    if (!student) return false;

    if (field === "phoneDigits") {
      return normalizeSubmissionPhoneDigits(student.phone) === form.phoneDigits && Boolean(form.phoneDigits);
    }

    if (field === "leaderName") return normalizeText(student.name) === normalizeText(form.leaderName) && Boolean(form.leaderName);

    const studentCourse = getOfficialCourseFieldValue(student.course);
    const formCourse = getOfficialCourseFieldValue(form.academicCourse);
    return normalizeText(studentCourse) === normalizeText(formCourse) && Boolean(formCourse);
  };

  const autofilledFieldsCount = [
    matchesStudentField("leaderName"),
    matchesStudentField("phoneDigits"),
    matchesStudentField("academicCourse"),
  ].filter(Boolean).length;

  const validateField = (key: SubmissionFieldKey, nextForm: SubmissionFormState, nextKind: SubmissionKind | null = kind) => {
    if (!nextKind) return null;

    const parsed = buildSubmeterSchema(nextKind).safeParse(nextForm);
    if (parsed.success) return null;
    return parsed.error.issues.find((issue) => String(issue.path[0] ?? "form") === key)?.message ?? null;
  };

  const updateField = <K extends SubmissionFieldKey>(key: K, value: SubmissionFormState[K]) => {
    setForm((current) => {
      const nextForm = { ...current, [key]: value };
      const fieldError = validateField(key, nextForm);

      setTouchedFields((touched) => ({ ...touched, [key]: true }));
      setErrors((errs) => {
        if (!fieldError) {
          if (!errs[key]) return errs;
          const next = { ...errs };
          delete next[key];
          return next;
        }
        return { ...errs, [key]: fieldError };
      });

      return nextForm;
    });
  };

  const isTouched = (key: SubmissionFieldKey) => Boolean(touchedFields[key]);

  const toggleNeed = (value: string) => {
    updateField(
      "needs",
      form.needs.includes(value)
        ? form.needs.filter((entry) => entry !== value)
        : [...form.needs, value]
    );
  };

  const handlePickKind = (nextKind: SubmissionKind) => {
    setKind(nextKind);
    setTouchedFields({});
    setErrors({});
    setForm((current) => hydrateFromStudent(current, student));
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
      toast.error(error instanceof Error ? error.message : "Falha ao ler o comprovativo.");
    }
  };

  const handleProofDrop: React.DragEventHandler<HTMLLabelElement> = async (event) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      await handleProofSelected(file);
    }
  };

  const handleDragOver: React.DragEventHandler<HTMLLabelElement> = (event) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave: React.DragEventHandler<HTMLLabelElement> = () => setIsDragging(false);

  const handleAddMember = () => {
    const cleaned = memberInput.trim();
    if (!cleaned) return;

    if (form.members.length >= 5) {
      toast.error("Máximo de 5 membros por candidatura.");
      return;
    }

    if (form.members.some((member) => normalizeText(member) === normalizeText(cleaned))) {
      toast.info("Este membro já foi adicionado.");
      return;
    }

    updateField("members", [...form.members, cleaned]);
    setMemberInput("");
  };

  const handleRemoveMember = (member: string) => {
    updateField("members", form.members.filter((entry) => entry !== member));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!kind) return;

    const parsed = buildSubmeterSchema(kind).safeParse(form);
    if (!parsed.success) {
      const nextErrors = parsed.error.issues.reduce<Record<string, string>>((acc, issue) => {
        const key = String(issue.path[0] ?? "form");
        if (!acc[key]) acc[key] = issue.message;
        return acc;
      }, {});
      setErrors(nextErrors);
      toast.error("Revê os campos destacados antes de continuar.");
      return;
    }

    if (!config.isOpen && !isEditMode) {
      toast.error("As candidaturas estão fechadas neste momento.");
      return;
    }

    if (editingLocked) {
      toast.error("Esta submissão já não pode ser editada.");
      return;
    }

    try {
      setSaving(true);
      const normalizedCourse = getOfficialCourseFieldValue(form.academicCourse);

      const syncedStudent = await syncStudentProfileIfNeeded(student, {
        name: form.leaderName,
        course: normalizedCourse || undefined,
        phone: formatSubmissionPhone(form.phoneDigits),
      });
      setStudent(syncedStudent ?? student);

      const observations = [
        form.observations.trim(),
        kind === "projeto" && form.advisor.trim() ? `Docente orientador: ${form.advisor.trim()}` : "",
        kind !== "projeto" && form.organizationName.trim() ? `Entidade: ${form.organizationName.trim()}` : "",
        kind === "produto" && form.priceAverage.trim() ? `Média de preço estimado: ${form.priceAverage.trim()}` : "",
      ].filter(Boolean).join("\n");

      const payload: CreateSubmissionInput = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        members: form.members,
        leaderName: form.leaderName.trim(),
        leaderPhone: formatSubmissionPhone(form.phoneDigits),
        needs: form.needs,
        paymentProof: form.paymentProof,
        paymentConfirmed: true,
        repoUrl: form.repoUrl.trim() || undefined,
        websiteUrl: form.websiteUrl.trim() || undefined,
        observations: observations || undefined,
        agreeRules: true,
        type: submissionTypeToApi(kind),
        area: form.area,
        course: kind === "projeto" ? normalizedCourse : undefined,
        stage: kind === "negocio" ? form.stage : undefined,
        category: kind === "produto" ? form.category : undefined,
        productType: kind === "produto" ? form.productType : undefined,
      };

      if (isEditMode) {
        const updated = await api.submissions.updateOwn(editId, payload);
        toast.success("Submissão atualizada com sucesso.");
        navigate(updated.receiptPath);
        return;
      }

      const created = await api.submissions.create(payload);
      toast.success("Submissão registada com sucesso.");
      navigate(created.receiptPath);
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

      toast.error(error instanceof Error ? error.message : "Não foi possível guardar a submissão.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-section">
        <div className="page-shell flex min-h-[60vh] items-center justify-center">
          <div className="surface-card flex items-center gap-3 px-6 py-5">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-sm font-medium text-muted-foreground">A preparar o formulário de submissão...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!kind) {
    return (
      <div className="min-h-screen py-12 md:py-20">
        <div className="container mx-auto max-w-4xl px-4">
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="mb-10 text-center"
          >
            <h1 className="mb-2 text-3xl font-bold sm:text-4xl">Submeter Exposição</h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              Escolhe o tipo de candidatura e confirma o estado atual antes de avançar.
            </p>
          </motion.section>

          <div className="mb-8 grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${config.isOpen ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                  {config.isOpen ? <ShieldCheck className="h-6 w-6" /> : <ShieldX className="h-6 w-6" />}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Status</p>
                  <h2 className="font-heading text-xl font-bold">{config.isOpen ? "Candidaturas abertas" : "Candidaturas fechadas"}</h2>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {config.isOpen
                  ? "As submissões estão disponíveis neste momento. Podes avançar com a tua candidatura."
                  : "As submissões estão temporariamente desativadas. Volta mais tarde ou consulta a organização."}
              </p>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <Info className="mt-1 h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Pagamento</p>
                  <p className="mt-2 font-mono text-sm font-semibold">{config.iban}</p>
                  <p className="mt-2 text-sm text-foreground">{config.accountName}</p>
                  <p className="text-sm font-semibold text-primary">{config.paymentAmount}</p>
                </div>
              </div>
            </section>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {submissionKinds.map((entry, index) => {
              const Icon = entry.icon;
              return (
                <motion.button
                  key={entry.id}
                  type="button"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06, duration: 0.24, ease: "easeOut" }}
                  onClick={() => handlePickKind(entry.id)}
                  className={`overflow-hidden rounded-2xl border border-border bg-gradient-to-br ${entry.gradient} p-6 text-left shadow-sm transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg`}
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h2 className="font-heading text-lg font-bold text-foreground">{entry.label}</h2>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">{entry.description}</p>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="uor-page-bg min-h-screen py-12 md:py-20">
      <div className="page-shell-narrow">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <button type="button" onClick={() => !isEditMode && setKind(null)} className="mb-4 flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary">
            <ArrowLeft className="h-4 w-4" />
            {isEditMode ? "Ajustar submissão atual" : "Voltar à seleção"}
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              {selectedKind ? <selectedKind.icon className="h-5 w-5 text-primary" /> : null}
            </div>
            <h1 className="text-3xl font-bold md:text-4xl">{selectedKind?.label}</h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
            {selectedKind?.description}
          </p>
        </motion.div>

        <div className="surface-card mb-6 overflow-hidden border-border/70 bg-card p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">
                <span className={`mr-2 inline-block h-2 w-2 rounded-full ${config.isOpen ? "bg-primary" : "bg-destructive"}`}></span>
                {config.isOpen ? "Candidaturas abertas" : "Candidaturas fechadas"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {kind === "projeto"
                  ? "Projetos aprovados entram na votação pública."
                  : "Exposições aprovadas ficam visíveis na plataforma."}
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <div className="text-sm">
                <p className="font-semibold">{student?.studentNumber || "Sessão ativa"}</p>
                <p className="text-xs text-muted-foreground">{isEditMode ? "Modo de edição" : "Conta verificada"}</p>
              </div>
            </div>
          </div>
        </div>

        {editingLocked ? (
          <div className="surface-card border-rose-500/20 bg-rose-500/[0.05] p-5 text-sm leading-7 text-rose-700">
            Esta submissão já não pode ser editada porque saiu do estado pendente. O recibo continua acessível em <Link to={`/submissoes/${editingReceipt?.id}`} className="font-semibold underline">/submissoes/{editingReceipt?.id}</Link>.
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="responsive-two-col items-start">
          <section className="space-y-6">
            <div className="surface-card space-y-5 p-6">
              <div>
                <h2 className="text-xl font-semibold">Representante da equipa</h2>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="premium-stat-card">
                  <p className="premium-kicker">Perfil</p>
                  <p className="mt-2 safe-break text-sm font-semibold text-slate-900">{student?.name || "Nome indisponível"}</p>
                </div>
                <div className="premium-stat-card">
                  <p className="premium-kicker">Curso</p>
                  <p className="mt-2 safe-break text-sm font-semibold text-slate-900">{student?.course || "Curso não informado"}</p>
                </div>
                <div className="premium-stat-card">
                  <p className="premium-kicker">Contacto</p>
                  <p className="mt-2 safe-break text-sm font-semibold text-slate-900">{student?.phone || "Sem telefone sincronizado"}</p>
                </div>
              </div>

              <div className="responsive-two-col">
                <div className={studentFieldCardClassName(matchesStudentField("leaderName"))}>
                  <p className="field-shell__kicker">Nome oficial</p>
                  <p className="field-shell__title">Nome completo do responsável</p>
                  <Label htmlFor="leaderName">Nome completo</Label>
                  <Input
                    id="leaderName"
                    value={form.leaderName}
                    onChange={(event) => updateField("leaderName", event.target.value)}
                    aria-required="true"
                    aria-invalid={Boolean(errors.leaderName)}
                    aria-describedby={errors.leaderName ? errorId("leaderName") : undefined}
                    className={inputCls(errors, "leaderName", form.leaderName, undefined, isTouched("leaderName"))}
                  />
                  <AutoFillBadge visible={matchesStudentField("leaderName")} />
                  {fieldError(errors, "leaderName", isTouched("leaderName"), errorId("leaderName"))}
                </div>

                <div className={studentFieldCardClassName(matchesStudentField("phoneDigits"))}>
                  <p className="field-shell__kicker">Canal de contacto</p>
                  <p className="field-shell__title">Número principal para retorno</p>
                  <Label htmlFor="phoneDigits">Contacto</Label>
                  <Input
                    id="phoneDigits"
                    value={formatSubmissionPhone(form.phoneDigits)}
                    onChange={(event) => updateField("phoneDigits", extractSubmissionPhoneDigits(event.target.value))}
                    aria-required="true"
                    aria-invalid={Boolean(errors.phoneDigits)}
                    aria-describedby={errors.phoneDigits ? errorId("phoneDigits") : undefined}
                    className={inputCls(errors, "phoneDigits", form.phoneDigits, undefined, isTouched("phoneDigits"))}
                  />
                  <AutoFillBadge visible={matchesStudentField("phoneDigits")} />
                  {fieldError(errors, "phoneDigits", isTouched("phoneDigits"), errorId("phoneDigits"))}
                </div>
              </div>

              <div className={studentFieldCardClassName(matchesStudentField("academicCourse"))}>
                <p className="field-shell__kicker">Curso académico</p>
                <p className="field-shell__title">Ligação institucional da candidatura</p>
                <Label htmlFor="academicCourse">Curso académico</Label>
                  <Select value={form.academicCourse} onValueChange={(value) => updateField("academicCourse", value)}>
                    <SelectTrigger
                      id="academicCourse"
                      aria-required="true"
                      aria-invalid={Boolean(errors.academicCourse)}
                      aria-describedby={errors.academicCourse ? errorId("academicCourse") : undefined}
                      className="h-11 rounded-xl px-4 text-base md:text-sm"
                    >
                    <SelectValue placeholder="Seleciona o curso" />
                  </SelectTrigger>
                  <SelectContent>
                    {academicCourseOptions.map((option) => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <AutoFillBadge visible={matchesStudentField("academicCourse")} />
                {fieldError(errors, "academicCourse", isTouched("academicCourse"), errorId("academicCourse"))}
              </div>
            </div>

            <div className="surface-card space-y-5 p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Detalhes da candidatura</p>
                <h2 className="mt-2 text-xl font-semibold">Tudo dentro de limites consistentes</h2>
              </div>

            <div className="space-y-2">
                <Label htmlFor="submissionName">Nome da candidatura</Label>
                <Input id="submissionName" value={form.name} onChange={(event) => updateField("name", event.target.value)} className={inputCls(errors, "name", form.name)} />
                {fieldError(errors, "name")}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea id="description" value={form.description} onChange={(event) => updateField("description", event.target.value.slice(0, 500))} className={`min-h-[140px] rounded-xl px-4 py-3 text-base md:text-sm ${errors.description ? 'input-invalid' : form.description.length >= 20 ? 'input-valid' : ''}`} />
                <div className="field-note flex items-center justify-between">
                  <span>Máximo de 500 caracteres.</span>
                  <span className={form.description.length > 450 ? 'text-[hsl(var(--warning))]' : ''}>{form.description.length}/500</span>
                </div>
                {fieldError(errors, "description")}
              </div>

              <div className="responsive-two-col">
                <div className="space-y-2">
                  <Label htmlFor="area">Área principal</Label>
                  <Select value={form.area} onValueChange={(value) => updateField("area", value)}>
                    <SelectTrigger
                      id="area"
                      aria-required="true"
                      aria-invalid={Boolean(errors.area)}
                      aria-describedby={errors.area ? errorId("area") : undefined}
                      className="h-11 rounded-xl px-4 text-base md:text-sm"
                    >
                      <SelectValue placeholder="Seleciona a área" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableAreas.map((option) => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldError(errors, "area", isTouched("area"), errorId("area"))}
                </div>

                {kind === "projeto" ? (
                  <div className="space-y-2">
                    <Label htmlFor="advisor">Docente orientador</Label>
                    <Input id="advisor" value={form.advisor} onChange={(event) => updateField("advisor", event.target.value)} className={inputCls(errors, "advisor", form.advisor)} />
                    {fieldError(errors, "advisor")}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="organizationName">Entidade responsável</Label>
                    <Input id="organizationName" value={form.organizationName} onChange={(event) => updateField("organizationName", event.target.value)} className={inputCls(errors, "organizationName", form.organizationName)} />
                    {fieldError(errors, "organizationName")}
                  </div>
                )}
              </div>

              {kind === "negocio" ? (
                <div className="space-y-2">
                  <Label htmlFor="stage">Estágio do negócio</Label>
                  <Select value={form.stage} onValueChange={(value) => updateField("stage", value)}>
                      <SelectTrigger
                        id="stage"
                        aria-required="true"
                        aria-invalid={Boolean(errors.stage)}
                        aria-describedby={errors.stage ? errorId("stage") : undefined}
                        className="h-11 rounded-xl px-4 text-base md:text-sm"
                      >
                        <SelectValue placeholder="Seleciona o estágio" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableBusinessStages.map((option) => (
                          <SelectItem key={option} value={option}>{option}</SelectItem>
                        ))}
                      </SelectContent>
                  </Select>
                  {fieldError(errors, "stage", isTouched("stage"), errorId("stage"))}
                </div>
              ) : null}

              {kind === "produto" ? (
                <div className="responsive-two-col">
                  <div className="space-y-2">
                    <Label htmlFor="category">Categoria do produto</Label>
                    <Select value={form.category} onValueChange={(value) => updateField("category", value)}>
                      <SelectTrigger
                        id="category"
                        aria-required="true"
                        aria-invalid={Boolean(errors.category)}
                        aria-describedby={errors.category ? errorId("category") : undefined}
                        className="h-11 rounded-xl px-4 text-base md:text-sm"
                      >
                        <SelectValue placeholder="Seleciona a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableProductAreas.map((option) => (
                          <SelectItem key={option} value={option}>{option}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldError(errors, "category", isTouched("category"), errorId("category"))}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="productType">Tipo do produto</Label>
                    <Select value={form.productType} onValueChange={(value) => updateField("productType", value)}>
                      <SelectTrigger
                        id="productType"
                        aria-required="true"
                        aria-invalid={Boolean(errors.productType)}
                        aria-describedby={errors.productType ? errorId("productType") : undefined}
                        className="h-11 rounded-xl px-4 text-base md:text-sm"
                      >
                        <SelectValue placeholder="Seleciona o formato" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableProductTypes.map((option) => (
                          <SelectItem key={option} value={option}>{option}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldError(errors, "productType", isTouched("productType"), errorId("productType"))}
                  </div>
                </div>
              ) : null}

              {kind === "produto" ? (
                <div className="space-y-2">
                  <Label htmlFor="priceAverage">Média de preço estimado</Label>
                  <Input
                    id="priceAverage"
                    value={form.priceAverage}
                    onChange={(event) => updateField("priceAverage", event.target.value)}
                    aria-invalid={Boolean(errors.priceAverage)}
                    aria-describedby={errors.priceAverage ? errorId("priceAverage") : undefined}
                    className={inputCls(errors, "priceAverage", form.priceAverage, undefined, isTouched("priceAverage"))}
                  />
                  {fieldError(errors, "priceAverage", isTouched("priceAverage"), errorId("priceAverage"))}
                </div>
              ) : null}

              <div className="responsive-two-col">
                <div className="space-y-2">
                  <Label htmlFor="repoUrl">Repositório (opcional)</Label>
                  <Input id="repoUrl" value={form.repoUrl} onChange={(event) => updateField("repoUrl", event.target.value)} placeholder="https://github.com/..." className={inputCls(errors, "repoUrl", form.repoUrl)} />
                  {fieldError(errors, "repoUrl")}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="websiteUrl">Website / Link (opcional)</Label>
                  <Input id="websiteUrl" value={form.websiteUrl} onChange={(event) => updateField("websiteUrl", event.target.value)} placeholder="https://..." className={inputCls(errors, "websiteUrl", form.websiteUrl)} />
                  {fieldError(errors, "websiteUrl")}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="observations">Observações adicionais</Label>
                <Textarea id="observations" value={form.observations} onChange={(event) => updateField("observations", event.target.value.slice(0, 500))} className="min-h-[120px] rounded-xl px-4 py-3 text-base md:text-sm" />
                {fieldError(errors, "observations")}
              </div>
            </div>

            <div className="surface-card space-y-5 p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Equipa</p>
                  <h2 className="mt-2 text-xl font-semibold">Membros visíveis só no detalhe</h2>
                </div>
                <span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
                  {form.members.length} membro(s)
                </span>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Input value={memberInput} onChange={(event) => setMemberInput(event.target.value)} placeholder="Adicionar membro" className="h-11 flex-1 rounded-xl px-4 text-base md:text-sm" />
                <Button type="button" onClick={handleAddMember} className="h-11 rounded-xl">
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar
                </Button>
              </div>
              {fieldError(errors, "members")}

              <div className="surface-scroll-y max-h-[32dvh] rounded-3xl border border-border/60 bg-background/80 p-4">
                {form.members.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Ainda não adicionaste nenhum membro.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {form.members.map((member, index) => (
                      <div key={`${member}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
                        <span className="min-w-0 break-words text-sm font-medium">{member}</span>
                        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-xl" onClick={() => handleRemoveMember(member)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="surface-card space-y-5 p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Pagamento e necessidades</p>
              </div>

              <label
                className={`grid cursor-pointer gap-4 rounded-[18px] border border-dashed p-5 transition-all ${
                  isDragging ? "border-primary bg-primary/10 shadow-[0_18px_36px_rgba(255,94,0,0.14)]" : "border-primary/30 bg-[linear-gradient(135deg,rgba(255,94,0,0.05),rgba(0,184,148,0.06))] hover:border-primary/50 hover:bg-primary/5"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleProofDrop}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{form.paymentProofName || "Selecionar PDF ou imagem do comprovativo"}</p>
                  <p className="mt-1 text-xs leading-6 text-muted-foreground">PDF, PNG, JPG ou WEBP. O preview fica dentro de um viewport limitado com scroll interno.</p>
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
              {fieldError(errors, "paymentProof")}

              {form.paymentProof ? (
                <div className="flex justify-end">
                  <Button type="button" variant="ghost" size="sm" onClick={() => void handleProofSelected(null)}>
                    Remover ficheiro
                  </Button>
                </div>
              ) : null}

              <ResponsiveDocumentViewer
                title="Comprovativo anexado"
                description="PDFs e imagens usam um container com altura máxima e scroll interno, sem rebentar mobile nem tablet."
                source={previewDocumentSource}
                fileName={form.paymentProofName || (editingReceipt?.paymentProofPath ? "Comprovativo atual" : null)}
              />

              <div className="responsive-grid">
                {needsOptions.map((option) => (
                  <label key={option} className="premium-check-card">
                    <Checkbox checked={form.needs.includes(option)} onCheckedChange={() => toggleNeed(option)} className="mt-1" />
                    <span className="text-sm leading-6">{option}</span>
                  </label>
                ))}
              </div>

              <label className="premium-check-card">
                <Checkbox checked={form.paymentConfirmed} onCheckedChange={(value) => updateField("paymentConfirmed", Boolean(value) as true)} className="mt-1" />
                <span className="text-sm leading-6">Confirmo que já fiz a transferência e anexei o respetivo comprovativo.</span>
              </label>
              {fieldError(errors, "paymentConfirmed")}

              <label className="premium-check-card">
                <Checkbox checked={form.agreeRules} onCheckedChange={(value) => updateField("agreeRules", Boolean(value) as true)} className="mt-1" />
                <span className="text-sm leading-6">Li as regras da exposição e aceito que a submissão fique associada à minha conta de estudante.</span>
              </label>
              {fieldError(errors, "agreeRules")}
            </div>
          </section>

          <aside className="space-y-6">
            <div className="surface-card space-y-4 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <FileBadge2 className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Resumo</p>
                  <p className="text-lg font-semibold">{isEditMode ? "Atualização da submissão" : "Nova submissão"}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Tipo</p>
                  <p className="mt-2 text-sm font-semibold">{selectedKind?.label}</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">IBAN</p>
                  <p className="mt-2 break-words text-sm font-semibold">{config.iban}</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Montante</p>
                  <p className="mt-2 text-sm font-semibold">{config.paymentAmount}</p>
                  <p className="mt-1 text-xs leading-6 text-muted-foreground">{config.paymentInstructions || "Confirma o pagamento antes de submeter."}</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Experiência</p>
                  <p className="mt-2 text-sm font-semibold">Mobile-first e orientada a sessão</p>
                  <p className="mt-1 text-xs leading-6 text-muted-foreground">O formulário foi pensado para uso recorrente, toque confortável e reabertura posterior no recibo.</p>
                </div>
                {editingReceipt ? (
                  <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Estado atual</p>
                    <p className="mt-2 text-sm font-semibold">{editingReceipt.statusLabel}</p>
                    <Button asChild variant="link" className="mt-2 h-auto p-0">
                      <Link to={editingReceipt.receiptPath}>
                        Abrir recibo atual
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>



            <div className="surface-card p-6">
              <div className="flex flex-col gap-3">
                <Button type="submit" disabled={saving || editingLocked} className="h-11 rounded-xl">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  {isEditMode ? "Atualizar e voltar ao recibo" : "Submeter e abrir recibo"}
                </Button>
                <Button asChild variant="outline" className="h-11 rounded-xl">
                  <Link to="/minha-area">Ir para Minha Área</Link>
                </Button>
              </div>
            </div>
          </aside>
        </form>
      </div>
    </div>
  );
}
