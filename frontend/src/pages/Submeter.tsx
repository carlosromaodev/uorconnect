import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { z } from "zod";
import { Send, CheckCircle, ExternalLink, Info, Lightbulb, Store, Package, Loader2, ShieldCheck, ShieldX, Plus, X, Plane, Ticket, Sparkles, ArrowRight, Download, Copy, MessageSquareMore, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { api, type CreateSubmissionInput, type SubmissionConfig } from "@/lib/api";

type TipoSubmissao = "projeto" | "negocio" | "produto";

const tiposSubmissao = [
  { id: "projeto" as TipoSubmissao, label: "Expor Projeto", icon: Lightbulb, desc: "Projeto académico ou tecnológico com acesso a votação pública e prémio", color: "from-[hsl(var(--area-iot))]/20 to-primary/10" },
  { id: "negocio" as TipoSubmissao, label: "Expor Negócio", icon: Store, desc: "Startup, empresa ou ideia de negócio em categoria de exposição", color: "from-[hsl(var(--area-negocio))]/20 to-[hsl(var(--area-negocio))]/10" },
  { id: "produto" as TipoSubmissao, label: "Expor Produto", icon: Package, desc: "Produto físico ou digital em categoria de exposição", color: "from-[hsl(var(--area-produto))]/20 to-[hsl(var(--area-produto))]/10" },
];

const cursosUniversidade = [
  "Eng. Informática",
  "Eng. Telecomunicações",
  "Eng. Eletrotécnica",
  "Ciências Computação",
  "Arquitetura e Urbanismo",
  "Direito",
  "Contabilidade e Auditoria",
  "Gestão de Empresas",
  "Economia",
  "Enfermagem",
  "Psicologia",
  "Outro",
];

const areasProjeto = ["Engenharia", "Tecnologia", "Sustentabilidade", "Inovação", "Ciências Aplicadas", "Outra"];
const areasNegocio = ["Tecnologia", "Comércio", "Serviços", "Alimentação", "Educação", "Saúde", "Outra"];
const areasProduto = ["Hardware", "Software", "Alimentar", "Artesanato", "Vestuário", "Outro"];
const necessidades = ["Tomada elétrica", "Projetor multimédia", "Ligação à internet", "Mesa de exposição", "Espaço extra"];

const defaultConfig: SubmissionConfig = {
  key: "default",
  isOpen: true,
  iban: "AO006 0055 0000 3295 0561 10379",
  accountName: "Universidade Óscar Ribas",
  paymentAmount: "15.000 Kz",
  paymentInstructions: "Confirma a transferência antes de enviar a candidatura.",
  projectCommunityUrl: null,
  businessCommunityUrl: null,
  productCommunityUrl: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

type FormState = {
  leaderName: string;
  phone: string;
  course: string;
  organizationName: string;
  members: string;
  name: string;
  description: string;
  area: string;
  advisor: string;
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
  needs: string[];
};

const defaultFormState: FormState = {
  leaderName: "",
  phone: "",
  course: "",
  organizationName: "",
  members: "",
  name: "",
  description: "",
  area: "",
  advisor: "",
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
  needs: [],
};

const buildSchema = (tipo: TipoSubmissao) =>
  z.object({
    leaderName: z.string().min(3, "Informa o nome do responsável."),
    phone: z.string().regex(/^\d{8}$/, "Completa os 8 dígitos finais do contacto."),
    course: tipo === "projeto" ? z.string().min(2, "Seleciona o curso.") : z.string().optional(),
    organizationName: tipo !== "projeto" ? z.string().min(2, "Informa o nome da empresa ou marca.") : z.string().optional(),
    members: z.string().min(3, "Informa os membros da equipa."),
    name: z.string().min(3, "Informa o nome da candidatura."),
    description: z.string().min(20, "A descrição precisa de mais detalhe.").max(500, "Máximo de 500 caracteres."),
    area: z.string().min(2, "Seleciona a área."),
    advisor: tipo === "projeto" ? z.string().min(3, "Informa o docente orientador.") : z.string().optional(),
    stage: tipo === "negocio" ? z.string().min(2, "Seleciona o estágio do negócio.") : z.string().optional(),
    category: tipo === "produto" ? z.string().min(2, "Seleciona a categoria do produto.") : z.string().optional(),
    productType: tipo === "produto" ? z.string().min(2, "Seleciona o tipo do produto.") : z.string().optional(),
    priceAverage: tipo === "produto" ? z.string().min(2, "Informa a média de preço estimado.") : z.string().optional(),
    repoUrl: z.union([z.literal(""), z.string().url("Usa um link válido.")]),
    websiteUrl: z.union([z.literal(""), z.string().url("Usa um link válido.")]),
    observations: z.string().max(500, "Máximo de 500 caracteres.").optional(),
    agreeRules: z.literal(true, { errorMap: () => ({ message: "Precisas aceitar as regras." }) }),
    paymentProof: z.string().regex(/^(data:|https?:\/\/)/, "Anexa o comprovativo do pagamento."),
    paymentConfirmed: z.literal(true, { errorMap: () => ({ message: "Confirma que já fizeste a transferência." }) }),
    needs: z.array(z.enum(["Tomada elétrica", "Projetor multimédia", "Ligação à internet", "Mesa de exposição", "Espaço extra"])),
  });

function fieldError(errors: Record<string, string>, key: keyof FormState) {
  return errors[key] ? <p className="text-[11px] font-medium text-destructive">{errors[key]}</p> : null;
}

const ANGOLA_PHONE_PREFIX = "+244 9";

const submissionThemes: Record<TipoSubmissao, { primary: string; secondary: string; surface: string; badge: string }> = {
  projeto: {
    primary: "#FD8305",
    secondary: "#223D42",
    surface: "linear-gradient(135deg, rgba(253,131,5,0.18), rgba(34,61,66,0.12))",
    badge: "Projeto em embarque"
  },
  negocio: {
    primary: "#0F766E",
    secondary: "#164E63",
    surface: "linear-gradient(135deg, rgba(15,118,110,0.18), rgba(22,78,99,0.12))",
    badge: "Negócio em embarque"
  },
  produto: {
    primary: "#8B5CF6",
    secondary: "#1E293B",
    surface: "linear-gradient(135deg, rgba(139,92,246,0.18), rgba(30,41,59,0.12))",
    badge: "Produto em embarque"
  }
};

function normalizePhoneDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 8);
}

function extractPhoneDigitsFromInput(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.startsWith("2449")) {
    return normalizePhoneDigits(digits.slice(4));
  }

  if (digits.startsWith("244")) {
    return normalizePhoneDigits(digits.slice(3));
  }

  if (digits.startsWith("9")) {
    return normalizePhoneDigits(digits.slice(1));
  }

  return normalizePhoneDigits(digits);
}

function downloadBlob(blob: Blob, fileName: string) {
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(blobUrl);
}

function toAbsoluteUrl(path?: string | null) {
  if (!path) return null;
  const normalizedPath = path.startsWith("/submissions/") ? `/api${path}` : path;
  return new URL(normalizedPath, window.location.origin).toString();
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Não foi possível ler o ficheiro selecionado."));
    reader.readAsDataURL(file);
  });
}

export default function Submeter() {
  const navigate = useNavigate();
  const [tipo, setTipo] = useState<TipoSubmissao | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [referenceCode, setReferenceCode] = useState("");
  const [submittedMeta, setSubmittedMeta] = useState<{ id: number; communityUrl: string | null; boardingPassPath: string; paymentProofPath: string | null } | null>(null);
  const [config, setConfig] = useState<SubmissionConfig>(defaultConfig);
  const [form, setForm] = useState<FormState>(defaultFormState);
  const [memberInput, setMemberInput] = useState("");
  const [paymentProofName, setPaymentProofName] = useState("");

  useEffect(() => {
    api.submissions.config()
      .then(setConfig)
      .catch(() => setConfig(defaultConfig))
      .finally(() => setLoadingConfig(false));
  }, []);

  const tipoAtual = useMemo(() => tiposSubmissao.find((item) => item.id === tipo) ?? null, [tipo]);
  const areas = tipo === "projeto" ? areasProjeto : tipo === "negocio" ? areasNegocio : areasProduto;
  const submissionTheme = tipo ? submissionThemes[tipo] : submissionThemes.projeto;
  const formattedLeaderPhone = `${ANGOLA_PHONE_PREFIX}${form.phone}`;
  const phoneInputValue = `${ANGOLA_PHONE_PREFIX}${form.phone}`;
  const memberList = useMemo(
    () => form.members.split(",").map((item) => item.trim()).filter(Boolean),
    [form.members]
  );

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const toggleNeed = (need: string) => {
    updateField(
      "needs",
      form.needs.includes(need) ? form.needs.filter((item) => item !== need) : [...form.needs, need]
    );
  };

  const syncMembers = (members: string[]) => {
    updateField("members", members.join(", "));
  };

  const buildShareLegend = () => {
    const boardingPassUrl = toAbsoluteUrl(submittedMeta?.boardingPassPath);
    const paymentProofUrl = toAbsoluteUrl(submittedMeta?.paymentProofPath);

    return [
      `UOR Connect | ${tipoAtual?.label ?? "Candidatura"}`,
      `Inscrição: ${referenceCode}`,
      `Candidatura: ${form.name}`,
      `Responsável: ${form.leaderName} (${formattedLeaderPhone})`,
      boardingPassUrl ? `Talão de embarque: ${boardingPassUrl}` : "",
      paymentProofUrl ? `Comprovativo do pagamento: ${paymentProofUrl}` : "",
      "Legenda: segue o talão de embarque e o comprovativo do pagamento para validação da candidatura."
    ].filter(Boolean).join("\n");
  };

  const handleDownloadBoardingPass = async () => {
    if (!submittedMeta) return;

    try {
      const pdf = await api.submissions.boardingPassPdf(submittedMeta.id);
      downloadBlob(pdf, `${referenceCode.toLowerCase()}-talao-embarque.pdf`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao baixar o talão.");
    }
  };

  const handleCopyLegend = async () => {
    try {
      await navigator.clipboard.writeText(buildShareLegend());
      toast.success("Legenda copiada.");
    } catch {
      toast.error("Não foi possível copiar a legenda.");
    }
  };

  const handlePaymentProofSelected = async (file?: File | null) => {
    if (!file) {
      updateField("paymentProof", "");
      setPaymentProofName("");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("O comprovativo deve ter no máximo 5 MB.");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      updateField("paymentProof", dataUrl);
      setPaymentProofName(file.name);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao ler o comprovativo.");
    }
  };

  const handleAddMember = () => {
    const nextName = memberInput.trim();
    if (!nextName) return;

    if (memberList.length >= 5) {
      toast.error("Máximo de 5 membros por candidatura.");
      return;
    }

    syncMembers([...memberList, nextName]);
    setMemberInput("");
  };

  const handleRemoveMember = (name: string) => {
    syncMembers(memberList.filter((item) => item !== name));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!tipo) return;

    const parsed = buildSchema(tipo).safeParse(form);
    if (!parsed.success) {
      const nextErrors = parsed.error.issues.reduce<Record<string, string>>((acc, issue) => {
        const key = String(issue.path[0] ?? "form");
        if (!acc[key]) acc[key] = issue.message;
        return acc;
      }, {});
      setErrors(nextErrors);
      toast.error("Revê os campos destacados antes de submeter.");
      return;
    }

    if (!config.isOpen) {
      toast.error("As candidaturas estão fechadas neste momento.");
      return;
    }

    const observations = [
      form.observations.trim(),
      tipo === "projeto" && form.advisor.trim() ? `Docente orientador: ${form.advisor.trim()}` : "",
      tipo !== "projeto" && form.organizationName.trim() ? `Entidade: ${form.organizationName.trim()}` : "",
      tipo === "produto" && form.priceAverage.trim() ? `Média de preço estimado: ${form.priceAverage.trim()}` : "",
      form.leaderName.trim() ? `Responsável: ${form.leaderName.trim()}` : "",
    ].filter(Boolean).join("\n");

    const payload: CreateSubmissionInput = {
      name: form.name.trim(),
      description: form.description.trim(),
      members: form.members.trim(),
      leaderName: form.leaderName.trim(),
      leaderPhone: formattedLeaderPhone,
      needs: form.needs,
      paymentProof: form.paymentProof,
      paymentConfirmed: true,
      repoUrl: form.repoUrl.trim() || undefined,
      websiteUrl: form.websiteUrl.trim() || undefined,
      observations: observations || undefined,
      agreeRules: true,
      type: tipo === "projeto" ? "PROJECT" : tipo === "negocio" ? "BUSINESS" : "PRODUCT",
      area: form.area,
      course: tipo === "projeto" ? form.course : undefined,
      stage: tipo === "negocio" ? form.stage : undefined,
      category: tipo === "produto" ? form.category : undefined,
      productType: tipo === "produto" ? form.productType : undefined,
    };

    try {
      setLoading(true);
      const result = await api.submissions.create(payload);
      setReferenceCode(result.referenceCode);
      setSubmittedMeta({
        id: result.id,
        communityUrl: result.communityUrl,
        boardingPassPath: result.boardingPassPath,
        paymentProofPath: result.paymentProofPath
      });
      setSubmitted(true);
      toast.success("Candidatura submetida com sucesso.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao submeter. Tenta novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSubmitted(false);
    setTipo(null);
    setErrors({});
    setForm(defaultFormState);
    setMemberInput("");
    setPaymentProofName("");
    setSubmittedMeta(null);
  };

  if (submitted) {
    const shareLegend = buildShareLegend();
    const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(shareLegend)}`;
    return (
      <div className="relative min-h-screen overflow-hidden px-4 py-12">
        <div className="absolute inset-0 opacity-90" style={{ background: submissionTheme.surface }} />
        <div className="absolute -left-20 top-10 h-64 w-64 rounded-full blur-3xl" style={{ backgroundColor: `${submissionTheme.primary}30` }} />
        <div className="absolute -right-24 bottom-10 h-72 w-72 rounded-full blur-3xl" style={{ backgroundColor: `${submissionTheme.secondary}28` }} />

        <div className="relative mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="overflow-hidden rounded-[32px] border border-white/50 bg-white/92 shadow-[0_30px_120px_rgba(15,23,42,0.18)] backdrop-blur"
          >
            <div className="grid xl:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)]">
              <div className="relative min-w-0 overflow-hidden p-6 md:p-8 xl:p-10" style={{ background: `linear-gradient(160deg, ${submissionTheme.primary}18, ${submissionTheme.secondary}10)` }}>
                <div className="absolute inset-x-0 top-0 h-2" style={{ background: `linear-gradient(90deg, ${submissionTheme.primary}, ${submissionTheme.secondary})` }} />
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <img src="/logo.svg" alt="UOR Connect" className="h-12 w-auto rounded-2xl border border-white/60 bg-white/80 p-2 shadow-sm" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">UOR Connect</p>
                      <p className="truncate text-sm font-medium text-slate-700">Feira do Dia das Telecomunicações</p>
                    </div>
                  </div>
                  <div className="rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em]" style={{ backgroundColor: `${submissionTheme.primary}16`, color: submissionTheme.secondary }}>
                    {submissionTheme.badge}
                  </div>
                </div>

                <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${submissionTheme.primary}, ${submissionTheme.secondary})` }}>
                    <CheckCircle className="h-7 w-7" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Check-in concluído</p>
                    <h2 className="font-heading text-3xl font-bold leading-tight text-slate-900 md:text-4xl">Candidatura embarcada com sucesso</h2>
                  </div>
                </div>

                <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
                  A tua inscrição foi registada como se tivesses acabado de fazer check-in para a área de exposição. Guarda o número de inscrição e acompanha as próximas chamadas da organização.
                </p>

                <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                  <div className="rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-sm md:p-6">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      <Ticket className="h-4 w-4" />
                      Número de inscrição
                    </div>
                    <p className="mt-3 break-all font-mono text-xl font-bold leading-tight md:text-2xl" style={{ color: submissionTheme.secondary }}>{referenceCode}</p>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Embarque</p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">{form.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{tipoAtual?.label}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Legenda</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">Baixa o talão em PDF e partilha-o com o comprovativo do pagamento no grupo da comunidade correspondente.</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-5 text-white shadow-sm md:p-6">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                      <Plane className="h-4 w-4" />
                      Gate de saída
                    </div>
                    <div className="mt-4 space-y-3">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">Responsável</p>
                        <p className="mt-2 text-sm font-semibold text-white">{form.leaderName}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">Contacto</p>
                        <p className="mt-2 break-all text-sm font-semibold text-white">{formattedLeaderPhone}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">Área</p>
                        <p className="mt-2 text-sm font-semibold text-white">{form.area}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative min-w-0 border-t border-dashed border-slate-200 bg-slate-950 p-6 text-white md:p-8 xl:border-l xl:border-t-0">

                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-white/60">
                  <Sparkles className="h-4 w-4" />
                  Próximos passos
                </div>

                <div className="mt-6 space-y-4">
                  {[
                    "Guarda o número de inscrição para a validação e triagem da candidatura.",
                    "A organização vai usar o contacto submetido para atualizações rápidas e confirmação.",
                    "Se fores aprovado, a candidatura entra em exposição pública e, no caso de projeto, em votação."
                  ].map((step, index) => (
                    <div key={step} className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-bold">{index + 1}</div>
                      <p className="text-sm leading-6 text-white/80">{step}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">Legenda de partilha</p>
                  <p className="mt-2 text-sm leading-6 text-white/75">
                    Usa esta legenda quando fores enviar o talão e o comprovativo no WhatsApp ou no grupo da comunidade.
                  </p>
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-6 text-white/80">{shareLegend}</pre>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <Button variant="outline" className="rounded-2xl border-white/15 bg-transparent text-white hover:bg-white/10" onClick={() => void handleDownloadBoardingPass()}>
                    <Download className="mr-2 h-4 w-4" />
                    Baixar talão em PDF
                  </Button>
                  <Button variant="outline" className="rounded-2xl border-white/15 bg-transparent text-white hover:bg-white/10" onClick={() => void handleCopyLegend()}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar legenda
                  </Button>
                  <Button variant="outline" className="rounded-2xl border-white/15 bg-transparent text-white hover:bg-white/10" asChild>
                    <a href={whatsappShareUrl} target="_blank" rel="noopener noreferrer">
                      <MessageSquareMore className="mr-2 h-4 w-4" />
                      Partilhar no WhatsApp
                    </a>
                  </Button>
                  {submittedMeta?.communityUrl ? (
                    <Button variant="outline" className="rounded-2xl border-white/15 bg-transparent text-white hover:bg-white/10" asChild>
                      <a href={submittedMeta.communityUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Entrar na comunidade
                      </a>
                    </Button>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 px-4 py-3 text-sm text-white/55">
                      A comunidade deste tipo ainda não foi configurada no admin.
                    </div>
                  )}
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Button variant="outline" className="flex-1 rounded-2xl border-white/15 bg-transparent text-white hover:bg-white/10" onClick={() => navigate("/")}>
                    Voltar ao início
                  </Button>
                  <Button className="flex-1 rounded-2xl font-semibold" style={{ backgroundColor: submissionTheme.primary, color: "#fff" }} onClick={handleReset}>
                    Nova candidatura
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  if (!tipo) {
    return (
      <div className="min-h-screen py-12 md:py-20">
        <div className="container mx-auto max-w-4xl px-4">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-heading font-bold mb-2">Submeter Exposição</h1>
            <p className="text-muted-foreground text-sm md:text-base">Escolhe o tipo de candidatura e confirma o estado atual antes de avançar.</p>
          </motion.div>

          <div className="mb-8 grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
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
                {config.isOpen ? "As submissões estão disponíveis neste momento. Podes avançar com a tua candidatura." : "As submissões estão temporariamente desativadas. Volta mais tarde ou consulta a organização."}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <Info className="mt-1 h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Pagamento</p>
                  {loadingConfig ? (
                    <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> A carregar configuração...</div>
                  ) : (
                    <>
                      <p className="mt-2 font-mono text-sm font-semibold">{config.iban}</p>
                      <p className="mt-2 text-sm text-foreground">{config.accountName}</p>
                      <p className="text-sm font-semibold text-primary">{config.paymentAmount}</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {tiposSubmissao.map((item, index) => (
              <motion.button
                key={item.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                onClick={() => setTipo(item.id)}
                className={`overflow-hidden rounded-2xl border border-border bg-gradient-to-br ${item.color} p-6 text-left shadow-sm transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg`}
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80">
                  <item.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-heading text-lg font-bold text-foreground">{item.label}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.desc}</p>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 md:py-20">
      <div className="container mx-auto max-w-5xl px-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <button onClick={() => setTipo(null)} className="mb-4 flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary">
            ← Voltar à seleção
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              {tipoAtual && <tipoAtual.icon className="h-5 w-5 text-primary" />}
            </div>
            <h1 className="text-3xl md:text-4xl font-heading font-bold">{tipoAtual?.label}</h1>
          </div>
          <p className="mt-2 text-sm md:text-base text-muted-foreground">{tipoAtual?.desc} com validação completa antes do envio.</p>
        </motion.div>

        <div className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Status</p>
              <p className={`mt-1 font-heading text-xl font-bold ${config.isOpen ? "text-primary" : "text-destructive"}`}>
                {config.isOpen ? "Submissões ativas" : "Submissões desativadas"}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {tipo === "projeto"
                  ? "Projetos académicos aprovados entram na votação pública e podem receber o prémio oficial."
                  : "Negócios e produtos aprovados ficam em categoria de exposição e concorrem a vaga gratuita na próxima feira."}
              </p>
            </div>
            <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold ${config.isOpen ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
              {config.isOpen ? "Podes candidatar-te agora" : "Indisponível de momento"}
            </span>
          </div>
        </div>

        <motion.form initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 space-y-5 shadow-sm">
              <h2 className="text-sm font-heading font-bold text-primary">Dados do Participante</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Nome completo *</Label>
                  <Input value={form.leaderName} onChange={(e) => updateField("leaderName", e.target.value)} placeholder="Nome completo" className="h-10 text-sm" />
                  {fieldError(errors, "leaderName")}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Telefone *</Label>
                  <Input
                    value={phoneInputValue}
                    onChange={(e) => updateField("phone", extractPhoneDigitsFromInput(e.target.value))}
                    placeholder={`${ANGOLA_PHONE_PREFIX}XX XXX XXX`}
                    className="h-10 text-sm"
                    inputMode="numeric"
                  />
                  <p className="text-[11px] text-muted-foreground">Formato final: {formattedLeaderPhone}</p>
                  {fieldError(errors, "phone")}
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {tipo === "projeto" ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Curso *</Label>
                    <Select value={form.course} onValueChange={(value) => updateField("course", value)}>
                      <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="Selecionar curso" /></SelectTrigger>
                      <SelectContent>{cursosUniversidade.map((curso) => <SelectItem key={curso} value={curso}>{curso}</SelectItem>)}</SelectContent>
                    </Select>
                    {fieldError(errors, "course")}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">{tipo === "negocio" ? "Empresa / Organização *" : "Marca / Fabricante *"}</Label>
                    <Input value={form.organizationName} onChange={(e) => updateField("organizationName", e.target.value)} placeholder={tipo === "negocio" ? "Nome da empresa" : "Nome da marca"} className="h-10 text-sm" />
                    {fieldError(errors, "organizationName")}
                  </div>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs font-semibold">Membros da equipa *</Label>
                  <div className="relative">
                    <Input
                      value={memberInput}
                      onChange={(e) => setMemberInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddMember();
                        }
                      }}
                      placeholder={memberList.length > 0 ? "Adicione o próximo nome" : "Adicione o primeiro nome"}
                      className="h-10 pr-12 text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleAddMember}
                      className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary transition-colors hover:bg-primary/15"
                      aria-label="Adicionar membro"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {memberList.map((member) => (
                      <div key={member} className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/30 px-2.5 py-1 text-[11px] text-muted-foreground">
                        <span>{member}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(member)}
                          className="text-muted-foreground transition-colors hover:text-foreground"
                          aria-label={`Remover ${member}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  {fieldError(errors, "members")}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 space-y-5 shadow-sm">
              <h2 className="text-sm font-heading font-bold text-primary">
                {tipo === "projeto" ? "Informações do Projeto" : tipo === "negocio" ? "Informações do Negócio" : "Informações do Produto"}
              </h2>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Nome da candidatura *</Label>
                <Input value={form.name} onChange={(e) => updateField("name", e.target.value)} placeholder={tipo === "projeto" ? "Ex: SmartCampus" : tipo === "negocio" ? "Ex: TechStart Angola" : "Ex: Carregador Solar Portátil"} className="h-10 text-sm" />
                {fieldError(errors, "name")}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Descrição *</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => updateField("description", e.target.value.slice(0, 500))}
                  rows={5}
                  maxLength={500}
                  className="text-sm"
                  placeholder="Descreve o objetivo, valor e diferencial da candidatura..."
                />
                <div className="flex justify-end">
                  <p className="text-[11px] text-muted-foreground">{form.description.length}/500 caracteres</p>
                </div>
                {fieldError(errors, "description")}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Área *</Label>
                  <Select value={form.area} onValueChange={(value) => updateField("area", value)}>
                    <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="Selecionar área" /></SelectTrigger>
                    <SelectContent>{areas.map((area) => <SelectItem key={area} value={area}>{area}</SelectItem>)}</SelectContent>
                  </Select>
                  {fieldError(errors, "area")}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    {tipo === "projeto" ? "Docente orientador *" : tipo === "negocio" ? "Estágio do negócio *" : "Média de preço estimado *"}
                  </Label>
                  {tipo === "negocio" ? (
                    <Select value={form.stage} onValueChange={(value) => updateField("stage", value)}>
                      <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="Selecionar estágio" /></SelectTrigger>
                      <SelectContent>
                        {["Ideia", "Protótipo", "MVP", "Funcionando", "Já no Mercado"].map((stage) => <SelectItem key={stage} value={stage}>{stage}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={tipo === "projeto" ? form.advisor : form.priceAverage}
                      onChange={(e) => updateField(tipo === "projeto" ? "advisor" : "priceAverage", e.target.value)}
                      placeholder={tipo === "projeto" ? "Nome do orientador" : "Ex: 15.000 Kz a 25.000 Kz"}
                      className="h-10 text-sm"
                    />
                  )}
                  {tipo === "projeto" ? fieldError(errors, "advisor") : tipo === "negocio" ? fieldError(errors, "stage") : fieldError(errors, "priceAverage")}
                </div>
              </div>

              {tipo === "produto" && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Categoria do produto *</Label>
                    <Select value={form.category} onValueChange={(value) => updateField("category", value)}>
                      <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="Selecionar categoria" /></SelectTrigger>
                      <SelectContent>{areasProduto.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                    </Select>
                    {fieldError(errors, "category")}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Tipo de produto *</Label>
                    <Select value={form.productType} onValueChange={(value) => updateField("productType", value)}>
                      <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="Selecionar tipo" /></SelectTrigger>
                      <SelectContent>
                        {["Físico", "Digital", "Híbrido"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {fieldError(errors, "productType")}
                  </div>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{tipo === "projeto" ? "Link do projeto" : "Link do negócio / produto"} (opcional)</Label>
                  <Input value={tipo === "projeto" ? form.repoUrl : form.websiteUrl} onChange={(e) => updateField(tipo === "projeto" ? "repoUrl" : "websiteUrl", e.target.value)} placeholder="https://..." className="h-10 text-sm" />
                  {tipo === "projeto" ? fieldError(errors, "repoUrl") : fieldError(errors, "websiteUrl")}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Observações (opcional)</Label>
                  <Textarea value={form.observations} onChange={(e) => updateField("observations", e.target.value)} rows={3} className="text-sm" placeholder="Informações adicionais relevantes para a organização." />
                  {fieldError(errors, "observations")}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 space-y-4 shadow-sm">
              <h2 className="text-sm font-heading font-bold text-primary">Necessidades Técnicas</h2>
              <div className="space-y-3">
                {necessidades.map((need) => (
                  <label key={need} className="flex items-center gap-3 cursor-pointer">
                    <Checkbox checked={form.needs.includes(need)} onCheckedChange={() => toggleNeed(need)} />
                    <span className="text-sm text-foreground">{need}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 space-y-4 shadow-sm">
              <h2 className="text-sm font-heading font-bold text-primary">Pagamento</h2>
              <div className="rounded-xl border border-border bg-muted/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">IBAN</p>
                <p className="mt-2 font-mono text-sm font-semibold">{config.iban}</p>
                <p className="mt-3 text-sm text-foreground">{config.accountName}</p>
                <p className="text-sm font-semibold text-primary">{config.paymentAmount}</p>
                {config.paymentInstructions && <p className="mt-3 text-sm leading-6 text-muted-foreground">{config.paymentInstructions}</p>}
              </div>

              <label className="flex items-start gap-3 rounded-xl border border-border/80 bg-background/70 p-4">
                <Checkbox checked={form.paymentConfirmed} onCheckedChange={(checked) => updateField("paymentConfirmed", Boolean(checked))} />
                <div>
                  <p className="text-sm font-semibold">Já fiz a transferência</p>
                  <p className="text-xs text-muted-foreground">Marca esta opção depois de concluir o pagamento.</p>
                </div>
              </label>
              {fieldError(errors, "paymentConfirmed")}

              <div className="rounded-xl border border-border/80 bg-background/70 p-4">
                <Label className="text-sm font-semibold">Comprovativo do pagamento *</Label>
                <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border px-4 py-4 transition-colors hover:border-primary/40 hover:bg-primary/5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Paperclip className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{paymentProofName || "Selecionar PDF ou imagem do comprovativo"}</p>
                    <p className="text-xs text-muted-foreground">Formatos: PDF, PNG, JPG ou WEBP até 5 MB.</p>
                  </div>
                  <input
                    type="file"
                    accept="application/pdf,image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) => void handlePaymentProofSelected(event.target.files?.[0] ?? null)}
                  />
                </label>
                <p className="mt-2 text-[11px] text-muted-foreground">O comprovativo será anexado ao fluxo de partilha com a comunidade.</p>
                {fieldError(errors, "paymentProof")}
              </div>

              <label className="flex items-start gap-3 rounded-xl border border-border/80 bg-background/70 p-4">
                <Checkbox checked={form.agreeRules} onCheckedChange={(checked) => updateField("agreeRules", Boolean(checked))} />
                <div>
                  <p className="text-sm font-semibold">Li e aceito as regras</p>
                  <p className="text-xs text-muted-foreground">Ao submeter, confirmas que os dados enviados são válidos.</p>
                </div>
              </label>
              {fieldError(errors, "agreeRules")}
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <Button type="submit" className="h-11 w-full rounded-xl font-semibold" disabled={loading || !config.isOpen}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    A enviar...
                  </span>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Submeter candidatura
                  </>
                )}
              </Button>
              {!config.isOpen && <p className="mt-3 text-center text-xs font-medium text-destructive">As candidaturas estão fechadas na configuração atual.</p>}
            </div>
          </div>
        </motion.form>
      </div>
    </div>
  );
}
