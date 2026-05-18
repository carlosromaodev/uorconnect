import { type FormEvent, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Award,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Copy,
  Download,
  Gauge,
  Gift,
  Loader2,
  MinusCircle,
  Plus,
  RefreshCw,
  Route,
  Save,
  ScanLine,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
  UsersRound,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { api, type DigitalPassportAdminMission, type DigitalPassportAdminMissionQr, type DigitalPassportAdminOverview, type DigitalPassportAdminReports } from "@/lib/api";
import type { DigitalPassportAdminChallenge, DigitalPassportAdminSurpriseQr } from "@/lib/api";
import { downloadBlobFile } from "@/lib/student-documents";

const missionTypeOptions = [
  { value: "EVENT_CHECKIN", label: "Entrada no evento", color: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  { value: "PASSPORT_REFERRAL", label: "Convite afiliado", color: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  { value: "WORKSHOP_CHECKIN", label: "Workshop/Palestra", color: "border-sky-200 bg-sky-50 text-sky-800" },
  { value: "STAND_VISIT", label: "Visita a stand", color: "border-orange-200 bg-orange-50 text-orange-800" },
  { value: "EXHIBITOR_CHALLENGE", label: "Desafio do expositor", color: "border-violet-200 bg-violet-50 text-violet-800" },
  { value: "NETWORKING_CROSS_COURSE", label: "Networking intercurso", color: "border-teal-200 bg-teal-50 text-teal-800" },
  { value: "NUCLEUS_MEMBER_BONUS", label: "Pontos Núcleo", color: "border-cyan-200 bg-cyan-50 text-cyan-800" },
  { value: "SPECIAL_QUIZ", label: "Quiz especial", color: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800" },
  { value: "FAIR_SURPRISE_QR", label: "Caça aos QR", color: "border-orange-200 bg-orange-50 text-orange-800" },
  { value: "POINT_BATTLE", label: "Batalha de pontos", color: "border-rose-200 bg-rose-50 text-rose-800" },
  { value: "CLUE_CHAIN", label: "Pistas encadeadas", color: "border-indigo-200 bg-indigo-50 text-indigo-800" },
  { value: "COOPERATIVE_MISSION", label: "Missão cooperativa", color: "border-teal-200 bg-teal-50 text-teal-800" },
  { value: "RECOVERY_SMART", label: "Recuperação inteligente", color: "border-lime-200 bg-lime-50 text-lime-800" },
  { value: "JOURNEY_COMPLETION", label: "Jornada completa", color: "border-amber-200 bg-amber-50 text-amber-800" },
];

const missionQrTypeOptions = [
  { value: "POINT_BATTLE_QR", label: "Batalha de pontos", hint: "Checkpoint com pontos ou presença no ranking", icon: Trophy },
  { value: "CLUE_CHAIN_QR", label: "Pistas encadeadas", hint: "QR que abre uma pergunta/pista ligada", icon: Route },
  { value: "COOPERATIVE_MISSION_QR", label: "Missão cooperativa", hint: "Libera pontos quando o grupo mínimo escanear", icon: UsersRound },
  { value: "RECOVERY_SMART_QR", label: "Recuperação inteligente", hint: "Recupera pontos perdidos em QR surpresa", icon: ShieldCheck },
] as const;

const surpriseEffectOptions = [
  { value: "UNIVERSAL_DYNAMIC", label: "Dinâmico universal", hint: "Decide no scan: pode dar, tirar, multiplicar, dividir ou revelar pista", color: "border-slate-200 bg-slate-50 text-slate-800", icon: Sparkles },
  { value: "ADD_POINTS", label: "Pontos", hint: "Adiciona pontos", color: "border-emerald-200 bg-emerald-50 text-emerald-800", icon: Gift },
  { value: "SUBTRACT_POINTS", label: "Risco", hint: "Tira pontos", color: "border-rose-200 bg-rose-50 text-rose-800", icon: MinusCircle },
  { value: "MULTIPLY_BONUS", label: "Turbo", hint: "Multiplica pontos", color: "border-orange-200 bg-orange-50 text-orange-800", icon: Zap },
  { value: "DIVIDE_BONUS", label: "Fragmento", hint: "Divide pontos", color: "border-violet-200 bg-violet-50 text-violet-800", icon: Sparkles },
] as const;

type MissionDraft = {
  key: string;
  type: string;
  title: string;
  description: string;
  points: string;
  active: boolean;
};

type ChallengeDraft = {
  type: "EXHIBITOR_CHALLENGE" | "SPECIAL_QUIZ";
  missionId: string;
  qrActionId: string;
  question: string;
  options: string;
  correctAnswer: string;
  explanation: string;
  maxAttempts: string;
  active: boolean;
};

type SurpriseDraft = {
  name: string;
  description: string;
  effectType: "ADD_POINTS" | "SUBTRACT_POINTS" | "MULTIPLY_BONUS" | "DIVIDE_BONUS" | "UNIVERSAL_DYNAMIC";
  effectValue: string;
  batchQuantity: string;
  codePrefix: string;
  startNumber: string;
  universalAddWeight: string;
  universalSubtractWeight: string;
  universalMultiplyWeight: string;
  universalDivideWeight: string;
  universalHintWeight: string;
  universalRecoveryWeight: string;
  universalLossAddWeight: string;
  universalLossSubtractWeight: string;
  convertAfterLosses: string;
  convertToEffectValue: string;
  hintAfterLoss: string;
  rarity: "COMMON" | "RARE" | "SECRET" | "TEMPORARY";
  visibility: "VISIBLE" | "SEMI_HIDDEN" | "SECRET";
  maxUsesTotal: string;
  maxUsesPerStudent: string;
  negativeCapPerStudent: string;
  active: boolean;
};

type MissionQrDraft = {
  missionId: string;
  type: (typeof missionQrTypeOptions)[number]["value"];
  label: string;
  description: string;
  cooperativeThreshold: string;
  active: boolean;
};

type SurpriseQrBatchSummary = {
  batchCode: string;
  quantity: number;
  activeCount: number;
  printedCount: number;
  firstCode: string | null;
  lastCode: string | null;
  effectType: string;
  createdAt: string;
};

const defaultMissionDraft: MissionDraft = {
  key: "",
  type: "WORKSHOP_CHECKIN",
  title: "",
  description: "",
  points: "10",
  active: true,
};

const defaultChallengeDraft: ChallengeDraft = {
  type: "EXHIBITOR_CHALLENGE",
  missionId: "",
  qrActionId: "",
  question: "",
  options: "",
  correctAnswer: "",
  explanation: "",
  maxAttempts: "1",
  active: true,
};

const defaultSurpriseDraft: SurpriseDraft = {
  name: "",
  description: "",
  effectType: "ADD_POINTS",
  effectValue: "10",
  batchQuantity: "12",
  codePrefix: "QR",
  startNumber: "1",
  universalAddWeight: "50",
  universalSubtractWeight: "25",
  universalMultiplyWeight: "10",
  universalDivideWeight: "10",
  universalHintWeight: "5",
  universalRecoveryWeight: "0",
  universalLossAddWeight: "70",
  universalLossSubtractWeight: "10",
  convertAfterLosses: "",
  convertToEffectValue: "15",
  hintAfterLoss: "",
  rarity: "COMMON",
  visibility: "VISIBLE",
  maxUsesTotal: "",
  maxUsesPerStudent: "1",
  negativeCapPerStudent: "",
  active: true,
};

const defaultMissionQrDraft: MissionQrDraft = {
  missionId: "",
  type: "CLUE_CHAIN_QR",
  label: "",
  description: "",
  cooperativeThreshold: "3",
  active: true,
};

const resetChallengePhrase = "REINICIAR DESAFIO";
const adminDangerPhone = "+244937624785";

function adminChallengeStatusLabel(challenge: DigitalPassportAdminChallenge) {
  if (challenge.status === "REJECTED") return "Recusado";
  if (challenge.status === "PENDING_APPROVAL" || challenge.pendingApproval) return "Pendente admin";
  if (challenge.status === "PAUSED" || !challenge.active) return "Pausado";
  return "Aprovado";
}

function adminChallengeStatusClass(challenge: DigitalPassportAdminChallenge) {
  if (challenge.status === "REJECTED") return "border-rose-200 bg-rose-50 text-rose-800";
  if (challenge.status === "PENDING_APPROVAL" || challenge.pendingApproval) return "border-amber-200 bg-amber-50 text-amber-800";
  if (challenge.status === "PAUSED" || !challenge.active) return "border-slate-200 bg-white text-slate-600";
  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function adminChallengeReviewPriority(challenge: DigitalPassportAdminChallenge) {
  if (challenge.status === "PENDING_APPROVAL" || challenge.pendingApproval) return 0;
  if (challenge.status === "REJECTED") return 1;
  if (challenge.status === "PAUSED" || !challenge.active) return 2;
  return 3;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-AO").format(value);
}

function missionTypeMeta(type: string) {
  return missionTypeOptions.find((option) => option.value === type)
    ?? { value: type, label: type, color: "border-slate-200 bg-slate-50 text-slate-700" };
}

function surpriseEffectMeta(type: string) {
  return surpriseEffectOptions.find((option) => option.value === type)
    ?? surpriseEffectOptions[0];
}

function slugifyMissionKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Trophy;
  label: string;
  value: string | number;
  tone: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border p-4 shadow-sm ${tone}`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] opacity-70">{label}</p>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/70">
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </motion.div>
  );
}

export default function AdminPassportTab() {
  const [overview, setOverview] = useState<DigitalPassportAdminOverview | null>(null);
  const [reports, setReports] = useState<DigitalPassportAdminReports | null>(null);
  const [missions, setMissions] = useState<DigitalPassportAdminMission[]>([]);
  const [challenges, setChallenges] = useState<DigitalPassportAdminChallenge[]>([]);
  const [surpriseQrs, setSurpriseQrs] = useState<DigitalPassportAdminSurpriseQr[]>([]);
  const [missionQrs, setMissionQrs] = useState<DigitalPassportAdminMissionQr[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [challengeSaving, setChallengeSaving] = useState(false);
  const [surpriseSaving, setSurpriseSaving] = useState(false);
  const [surpriseBatchSaving, setSurpriseBatchSaving] = useState(false);
  const [missionQrSaving, setMissionQrSaving] = useState(false);
  const [downloadingSurpriseQrId, setDownloadingSurpriseQrId] = useState<number | null>(null);
  const [downloadingMissionQrId, setDownloadingMissionQrId] = useState<number | null>(null);
  const [downloadingSurpriseBatchCode, setDownloadingSurpriseBatchCode] = useState<string | null>(null);
  const [operationalSaving, setOperationalSaving] = useState<"freeze" | "recalculate" | "export" | null>(null);
  const [reviewSavingId, setReviewSavingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<MissionDraft>(defaultMissionDraft);
  const [challengeDraft, setChallengeDraft] = useState<ChallengeDraft>(defaultChallengeDraft);
  const [surpriseDraft, setSurpriseDraft] = useState<SurpriseDraft>(defaultSurpriseDraft);
  const [missionQrDraft, setMissionQrDraft] = useState<MissionQrDraft>(defaultMissionQrDraft);
  const [reviewDrafts, setReviewDrafts] = useState<Record<number, string>>({});
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetSmsExpiresAt, setResetSmsExpiresAt] = useState<string | null>(null);
  const [resetCode, setResetCode] = useState("");
  const [resetPhrase, setResetPhrase] = useState("");
  const [resetSendingCode, setResetSendingCode] = useState(false);
  const [resetConfirming, setResetConfirming] = useState(false);

  const filteredMissions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return missions;
    return missions.filter((mission) => (
      `${mission.title} ${mission.key} ${mission.type}`.toLowerCase().includes(query)
    ));
  }, [missions, search]);

  const visibleChallenges = useMemo(
    () =>
      [...challenges].sort((left, right) => {
        const priorityDiff =
          adminChallengeReviewPriority(left) -
          adminChallengeReviewPriority(right);
        if (priorityDiff !== 0) return priorityDiff;
        return Date.parse(right.createdAt) - Date.parse(left.createdAt);
      }),
    [challenges],
  );

  const surpriseQrBatches = useMemo<SurpriseQrBatchSummary[]>(() => {
    const batches = new Map<string, SurpriseQrBatchSummary>();

    for (const item of surpriseQrs) {
      if (!item.batchCode) continue;

      const batch = batches.get(item.batchCode) ?? {
        batchCode: item.batchCode,
        quantity: 0,
        activeCount: 0,
        printedCount: 0,
        firstCode: item.displayCode,
        lastCode: item.displayCode,
        effectType: item.effectType,
        createdAt: item.createdAt,
      };

      batch.quantity += 1;
      batch.activeCount += item.active ? 1 : 0;
      batch.printedCount += item.printedAt ? 1 : 0;
      batch.firstCode = batch.firstCode ?? item.displayCode;
      batch.lastCode = item.displayCode ?? batch.lastCode;

      if (Date.parse(item.createdAt) > Date.parse(batch.createdAt)) {
        batch.createdAt = item.createdAt;
        batch.effectType = item.effectType;
      }

      batches.set(item.batchCode, batch);
    }

    return Array.from(batches.values()).sort((left, right) => (
      Date.parse(right.createdAt) - Date.parse(left.createdAt)
    ));
  }, [surpriseQrs]);

  const latestSurpriseBatch = surpriseQrBatches[0] ?? null;

  const load = async () => {
    setLoading(true);
    try {
      const [nextOverview, nextReports, nextMissions, nextChallenges, nextSurprises, nextMissionQrs] = await Promise.all([
        api.passport.overview(),
        api.passport.reports(),
        api.passport.missions(),
        api.passport.challenges(),
        api.passport.surpriseQrs(),
        api.passport.missionQrs(),
      ]);
      setOverview(nextOverview);
      setReports(nextReports);
      setMissions(nextMissions);
      setChallenges(nextChallenges);
      setSurpriseQrs(nextSurprises);
      setMissionQrs(nextMissionQrs);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao carregar Passaporte Digital.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleTitleChange = (title: string) => {
    setDraft((current) => ({
      ...current,
      title,
      key: current.key || slugifyMissionKey(title),
    }));
  };

  const handleCreateMission = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.key.trim() || !draft.title.trim()) {
      toast.info("Preenche a chave e o nome da missão.");
      return;
    }

    const points = Number(draft.points);
    if (!Number.isFinite(points) || points < 0) {
      toast.info("Define uma pontuação válida.");
      return;
    }

    setSaving(true);
    try {
      const mission = await api.passport.createMission({
        key: slugifyMissionKey(draft.key),
        type: draft.type,
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        points,
        active: draft.active,
      });
      setMissions((current) => [mission, ...current]);
      setDraft(defaultMissionDraft);
      toast.success("Missão criada no Passaporte.");
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao criar missão.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleMission = async (mission: DigitalPassportAdminMission) => {
    try {
      const updated = await api.passport.updateMission(mission.id, { active: !mission.active });
      setMissions((current) => current.map((item) => item.id === mission.id ? updated : item));
      toast.success(updated.active ? "Missão ativada." : "Missão pausada.");
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao atualizar missão.");
    }
  };

  const handleCreateMissionQr = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const missionId = Number(missionQrDraft.missionId);
    if (!missionId || !missionQrDraft.label.trim()) {
      toast.info("Escolhe a missão e escreve o nome do QR.");
      return;
    }

    setMissionQrSaving(true);
    try {
      const qr = await api.passport.createMissionQr({
        missionId,
        type: missionQrDraft.type,
        label: missionQrDraft.label.trim(),
        description: missionQrDraft.description.trim() || null,
        cooperativeThreshold:
          missionQrDraft.type === "COOPERATIVE_MISSION_QR"
            ? Number(missionQrDraft.cooperativeThreshold) || 3
            : null,
        active: missionQrDraft.active,
      });
      setMissionQrs((current) => [qr, ...current]);
      setMissionQrDraft(defaultMissionQrDraft);
      toast.success("QR de etapa criado.");
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao criar QR de etapa.");
    } finally {
      setMissionQrSaving(false);
    }
  };

  const handleCreateChallenge = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = challengeDraft.question.trim();
    const correctAnswer = challengeDraft.correctAnswer.trim();
    if (!question || !correctAnswer) {
      toast.info("Preenche a pergunta e a resposta correta.");
      return;
    }

    setChallengeSaving(true);
    try {
      const challenge = await api.passport.createChallenge({
        type: challengeDraft.type,
        missionId: challengeDraft.missionId ? Number(challengeDraft.missionId) : null,
        qrActionId: challengeDraft.qrActionId ? Number(challengeDraft.qrActionId) : null,
        question,
        options: challengeDraft.options
          .split("\n")
          .map((option) => option.trim())
          .filter(Boolean),
        correctAnswer,
        explanation: challengeDraft.explanation.trim() || null,
        maxAttempts: Number(challengeDraft.maxAttempts) || 1,
        active: challengeDraft.active,
      });
      setChallenges((current) => [challenge, ...current]);
      setChallengeDraft(defaultChallengeDraft);
      toast.success("Desafio criado no Passaporte.");
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao criar desafio.");
    } finally {
      setChallengeSaving(false);
    }
  };

  const handleToggleChallenge = async (challenge: DigitalPassportAdminChallenge) => {
    try {
      const nextActive = !challenge.active;
      const updated = await api.passport.updateChallenge(challenge.id, {
        active: nextActive,
        status: nextActive ? "APPROVED" : "PAUSED",
      });
      setChallenges((current) => current.map((item) => item.id === challenge.id ? updated : item));
      toast.success(updated.active ? "Desafio ativado." : "Desafio pausado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao atualizar desafio.");
    }
  };

  const handleReviewChallenge = async (
    challenge: DigitalPassportAdminChallenge,
    status: "APPROVED" | "REJECTED",
  ) => {
    const reviewNote = (reviewDrafts[challenge.id] ?? challenge.reviewNote ?? "").trim();
    if (status === "REJECTED" && reviewNote.length < 4) {
      toast.info("Escreve uma nota curta para o expositor corrigir o desafio.");
      return;
    }

    setReviewSavingId(challenge.id);
    try {
      const updated = await api.passport.updateChallenge(challenge.id, {
        status,
        active: status === "APPROVED",
        reviewNote: reviewNote || null,
      });
      setChallenges((current) => current.map((item) => item.id === challenge.id ? updated : item));
      setReviewDrafts((current) => ({ ...current, [challenge.id]: "" }));
      toast.success(status === "APPROVED" ? "Desafio aprovado." : "Desafio recusado com nota.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao rever desafio.");
    } finally {
      setReviewSavingId(null);
    }
  };

  const buildSurpriseDynamicRules = () => {
    if (surpriseDraft.effectType === "UNIVERSAL_DYNAMIC") {
      const afterLosses = Number(surpriseDraft.convertAfterLosses) || 4;
      return {
        mode: "UNIVERSAL_DYNAMIC" as const,
        weights: {
          ADD_POINTS: Number(surpriseDraft.universalAddWeight) || 0,
          SUBTRACT_POINTS: Number(surpriseDraft.universalSubtractWeight) || 0,
          MULTIPLY_BONUS: Number(surpriseDraft.universalMultiplyWeight) || 0,
          DIVIDE_BONUS: Number(surpriseDraft.universalDivideWeight) || 0,
          NEUTRAL_HINT: Number(surpriseDraft.universalHintWeight) || 0,
          RECOVERY_POINTS: Number(surpriseDraft.universalRecoveryWeight) || 0,
        },
        values: {
          ADD_POINTS: Number(surpriseDraft.effectValue) || 10,
          SUBTRACT_POINTS: Math.max(1, Math.min(50, Number(surpriseDraft.convertToEffectValue) || 5)),
          MULTIPLY_BONUS: 2,
          DIVIDE_BONUS: 2,
          NEUTRAL_HINT: 0,
          RECOVERY_POINTS: 10,
        },
        lossAdjustment: {
          afterLosses,
          weights: {
            ADD_POINTS: Number(surpriseDraft.universalLossAddWeight) || 0,
            SUBTRACT_POINTS: Number(surpriseDraft.universalLossSubtractWeight) || 0,
            MULTIPLY_BONUS: Number(surpriseDraft.universalMultiplyWeight) || 0,
            DIVIDE_BONUS: Number(surpriseDraft.universalDivideWeight) || 0,
            NEUTRAL_HINT: Number(surpriseDraft.universalHintWeight) || 0,
            RECOVERY_POINTS: Number(surpriseDraft.universalRecoveryWeight) || 0,
          },
        },
        hintAfterLoss: surpriseDraft.hintAfterLoss.trim() || null,
      };
    }

    const convertAfterLosses = Number(surpriseDraft.convertAfterLosses);
    if (!Number.isFinite(convertAfterLosses) || convertAfterLosses < 1) return null;
    const convertToEffectValue = Number(surpriseDraft.convertToEffectValue) || 15;
    return {
      convertAfterLosses,
      convertToEffectType: "ADD_POINTS" as const,
      convertToEffectValue,
      hintAfterLoss: surpriseDraft.hintAfterLoss.trim() || null,
    };
  };

  const handleCreateSurpriseQr = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = surpriseDraft.name.trim();
    const effectValue = Number(surpriseDraft.effectValue);
    if (!name || !Number.isFinite(effectValue)) {
      toast.info("Preenche o nome e o valor do efeito.");
      return;
    }

    setSurpriseSaving(true);
    try {
      const surprise = await api.passport.createSurpriseQr({
        name,
        description: surpriseDraft.description.trim() || null,
        effectType: surpriseDraft.effectType,
        effectValue,
        dynamicRules: buildSurpriseDynamicRules(),
        rarity: surpriseDraft.rarity,
        visibility: surpriseDraft.visibility,
        maxUsesTotal: surpriseDraft.maxUsesTotal ? Number(surpriseDraft.maxUsesTotal) : null,
        maxUsesPerStudent: surpriseDraft.maxUsesPerStudent ? Number(surpriseDraft.maxUsesPerStudent) : 1,
        negativeCapPerStudent: surpriseDraft.negativeCapPerStudent ? Number(surpriseDraft.negativeCapPerStudent) : null,
        active: surpriseDraft.active,
      });
      setSurpriseQrs((current) => [surprise, ...current]);
      setSurpriseDraft(defaultSurpriseDraft);
      toast.success("QR surpresa criado.");
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao criar QR surpresa.");
    } finally {
      setSurpriseSaving(false);
    }
  };

  const handleCreateSurpriseQrBatch = async () => {
    const name = surpriseDraft.name.trim();
    const effectValue = Number(surpriseDraft.effectValue);
    const quantity = Number(surpriseDraft.batchQuantity);
    if (!name || !Number.isFinite(effectValue) || !Number.isFinite(quantity) || quantity < 1) {
      toast.info("Preenche o nome, valor e quantidade do lote.");
      return;
    }

    setSurpriseBatchSaving(true);
    try {
      const batch = await api.passport.createSurpriseQrBatch({
        name,
        description: surpriseDraft.description.trim() || null,
        effectType: surpriseDraft.effectType,
        effectValue,
        quantity,
        codePrefix: surpriseDraft.codePrefix.trim() || "QR",
        startNumber: Number(surpriseDraft.startNumber) || 1,
        dynamicRules: buildSurpriseDynamicRules(),
        rarity: surpriseDraft.rarity,
        visibility: surpriseDraft.visibility,
        maxUsesTotal: surpriseDraft.maxUsesTotal ? Number(surpriseDraft.maxUsesTotal) : null,
        maxUsesPerStudent: surpriseDraft.maxUsesPerStudent ? Number(surpriseDraft.maxUsesPerStudent) : 1,
        negativeCapPerStudent: surpriseDraft.negativeCapPerStudent ? Number(surpriseDraft.negativeCapPerStudent) : null,
        active: surpriseDraft.active,
      });
      setSurpriseQrs((current) => [...batch.items, ...current]);
      toast.success(`Lote ${batch.batchCode} criado com ${batch.quantity} QR surpresa.`);
      void handleDownloadSurpriseQrBatchPdf(batch.batchCode);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao criar lote de QR surpresa.");
    } finally {
      setSurpriseBatchSaving(false);
    }
  };

  const handleToggleSurpriseQr = async (surprise: DigitalPassportAdminSurpriseQr) => {
    try {
      const updated = await api.passport.updateSurpriseQr(surprise.id, { active: !surprise.active });
      setSurpriseQrs((current) => current.map((item) => item.id === surprise.id ? updated : item));
      toast.success(updated.active ? "QR surpresa ativado." : "QR surpresa pausado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao atualizar QR surpresa.");
    }
  };

  const handleCopySurpriseQr = async (surprise: DigitalPassportAdminSurpriseQr) => {
    try {
      await navigator.clipboard.writeText(surprise.validationUrl);
      toast.success("Link do QR surpresa copiado.");
    } catch {
      toast.info(surprise.validationUrl);
    }
  };

  const handleCopyMissionQr = async (qr: DigitalPassportAdminMissionQr) => {
    try {
      await navigator.clipboard.writeText(qr.validationUrl);
      toast.success("Link do QR de etapa copiado.");
    } catch {
      toast.info(qr.validationUrl);
    }
  };

  const handleDownloadMissionQrPdf = async (qr: DigitalPassportAdminMissionQr) => {
    try {
      setDownloadingMissionQrId(qr.id);
      const blob = await api.passport.missionQrPdf(qr.id);
      const safeName = qr.label.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || String(qr.id);
      downloadBlobFile(blob, `qr-etapa-${safeName}.pdf`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao baixar PDF do QR de etapa.");
    } finally {
      setDownloadingMissionQrId(null);
    }
  };

  const handleDownloadSurpriseQrPdf = async (surprise: DigitalPassportAdminSurpriseQr) => {
    try {
      setDownloadingSurpriseQrId(surprise.id);
      const blob = await api.passport.surpriseQrPdf(surprise.id);
      const safeName = surprise.name.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || String(surprise.id);
      downloadBlobFile(blob, `qr-surpresa-${safeName}.pdf`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao baixar PDF do QR surpresa.");
    } finally {
      setDownloadingSurpriseQrId(null);
    }
  };

  const handleDownloadSurpriseQrBatchPdf = async (batchCode: string) => {
    try {
      setDownloadingSurpriseBatchCode(batchCode);
      const blob = await api.passport.surpriseQrBatchPdf(batchCode);
      downloadBlobFile(blob, `qr-surpresa-lote-${batchCode}.pdf`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao baixar PDF do lote.");
    } finally {
      setDownloadingSurpriseBatchCode(null);
    }
  };

  const handleFreezeRanking = async () => {
    setOperationalSaving("freeze");
    try {
      const frozen = await api.passport.freezeRanking("Ranking congelado para validação administrativa.");
      setReports((current) => current ? {
        ...current,
        rankingFrozen: {
          id: frozen.id,
          frozenAt: frozen.frozenAt,
          frozenByStudentNumber: frozen.frozenByStudentNumber,
          note: frozen.note,
        },
      } : current);
      toast.success("Ranking congelado para anúncio de vencedores.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao congelar ranking.");
    } finally {
      setOperationalSaving(null);
    }
  };

  const handleRecalculateRanking = async () => {
    setOperationalSaving("recalculate");
    try {
      const result = await api.passport.recalculate();
      setOverview(result.overview);
      setReports(result.reports);
      toast.success("Ranking recalculado a partir do ledger auditável.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao recalcular ranking.");
    } finally {
      setOperationalSaving(null);
    }
  };

  const handleRequestResetConfirmation = async () => {
    setResetSendingCode(true);
    try {
      const confirmation = await api.passport.requestResetConfirmation();
      setResetSmsExpiresAt(confirmation.expiresAt);
      setResetCode("");
      toast.success(`Código SMS enviado para ${adminDangerPhone}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao enviar o código SMS.");
    } finally {
      setResetSendingCode(false);
    }
  };

  const handleConfirmChallengeReset = async () => {
    if (resetPhrase.trim() !== resetChallengePhrase) {
      toast.info(`Escreve ${resetChallengePhrase} para confirmar.`);
      return;
    }
    if (!/^\d{6}$/.test(resetCode.trim())) {
      toast.info("Insere o código SMS de 6 dígitos.");
      return;
    }

    setResetConfirming(true);
    try {
      const result = await api.passport.confirmReset({
        code: resetCode.trim(),
        confirmationText: resetPhrase.trim(),
      });
      toast.success(`Desafio reiniciado: ${result.pointLedgerDeleted} registo(s) de pontos removido(s).`);
      setResetDialogOpen(false);
      setResetSmsExpiresAt(null);
      setResetCode("");
      setResetPhrase("");
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao reiniciar o desafio.");
    } finally {
      setResetConfirming(false);
    }
  };

  const handleExportWinners = async () => {
    setOperationalSaving("export");
    try {
      const result = await api.passport.exportWinners(10);
      const lines = [
        "Posição;Número;Nome;Curso;Pontos;Prémio",
        ...result.winners.map((winner) => [
          winner.position,
          winner.studentNumber,
          winner.studentName ?? "",
          winner.studentCourse ?? "",
          winner.points,
          winner.prize,
        ].map((value) => String(value).replace(/;/g, ",")).join(";")),
      ];
      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `passaporte-vencedores-${result.generatedAt.slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Vencedores exportados com auditoria.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao exportar vencedores.");
    } finally {
      setOperationalSaving(null);
    }
  };

  const rankingRows = reports?.ranking?.length ? reports.ranking : overview?.leaderboard ?? [];
  const topStudent = rankingRows[0];
  const activePlayers = overview?.activePlayers ?? 0;

  return (
    <div className="min-w-0 space-y-5">
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg overflow-hidden rounded-2xl p-0">
          <DialogHeader className="border-b border-rose-100 bg-rose-50 px-5 pb-4 pt-5 text-left">
            <DialogTitle className="flex items-center gap-2 text-rose-900">
              <AlertTriangle className="h-5 w-5" />
              Reiniciar desafio
            </DialogTitle>
            <DialogDescription className="text-rose-800/80">
              Esta ação remove inscrições, pontos, scans, respostas, badges e ranking congelado. Missões, perguntas e QR configurados ficam guardados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-5 py-4">
            <div className="rounded-xl border border-rose-100 bg-white p-3 text-sm text-slate-700">
              <p className="font-bold text-slate-950">Proteção por SMS</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                O código de confirmação é enviado apenas para {adminDangerPhone}. O reset só acontece depois de inserir o código e a frase de confirmação.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50"
              onClick={() => void handleRequestResetConfirmation()}
              disabled={resetSendingCode || resetConfirming}
            >
              {resetSendingCode ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              Enviar código SMS
            </Button>
            {resetSmsExpiresAt ? (
              <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                Código enviado. Válido até {new Date(resetSmsExpiresAt).toLocaleTimeString("pt-AO", { hour: "2-digit", minute: "2-digit" })}.
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Código SMS</label>
                <Input
                  value={resetCode}
                  onChange={(event) => setResetCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  className="rounded-xl"
                  placeholder="000000"
                  disabled={resetConfirming}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Frase</label>
                <Input
                  value={resetPhrase}
                  onChange={(event) => setResetPhrase(event.target.value.toUpperCase())}
                  className="rounded-xl"
                  placeholder={resetChallengePhrase}
                  disabled={resetConfirming}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="border-t border-slate-100 bg-slate-50 px-5 py-4">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setResetDialogOpen(false)} disabled={resetConfirming}>
              Cancelar
            </Button>
            <Button type="button" className="rounded-xl bg-rose-700 text-white hover:bg-rose-800" onClick={() => void handleConfirmChallengeReset()} disabled={resetConfirming || !resetSmsExpiresAt}>
              {resetConfirming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlertTriangle className="mr-2 h-4 w-4" />}
              Confirmar reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <section className="passport-admin-hero overflow-hidden rounded-[28px] border border-slate-200 text-slate-950">
        <div className="passport-admin-hero__grid" aria-hidden="true" />
        <div className="relative z-10 grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_460px] lg:p-7">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-[11px] font-black uppercase text-orange-800">
              <Sparkles className="h-3.5 w-3.5" />
              Passaporte Digital
            </div>
            <h2 className="mt-4 text-2xl font-black leading-tight sm:text-3xl">Desafio da feira com controlo operacional</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Gere missões por QR, acompanha quem entrou no desafio, quem já pontuou e quais estudantes estão a liderar com dados auditáveis.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700">Prémio: 1 recurso no 2.º semestre</span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700">Certificado digital</span>
            </div>
          </div>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <StatTile icon={UsersRound} label="Entraram" value={formatNumber(overview?.participants ?? 0)} tone="border-slate-200 bg-white text-slate-950" />
              <StatTile icon={Zap} label="Pontuaram" value={formatNumber(activePlayers)} tone="border-emerald-200 bg-emerald-50 text-emerald-900" />
              <StatTile icon={ScanLine} label="Scans" value={formatNumber(overview?.totalScans ?? 0)} tone="border-slate-200 bg-white text-slate-950" />
              <StatTile icon={Trophy} label="Pontos" value={formatNumber(overview?.totalPoints ?? 0)} tone="border-orange-200 bg-orange-50 text-orange-900" />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-black uppercase text-slate-500">Líder atual</p>
              {topStudent ? (
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-950">{topStudent.studentName ?? `Estudante ${topStudent.studentNumber}`}</p>
                    <p className="truncate text-xs text-slate-500">{topStudent.studentCourse ?? topStudent.studentNumber}</p>
                  </div>
                  <span className="rounded-2xl bg-slate-950 px-3 py-2 text-sm font-black text-white">#{topStudent.position} · {topStudent.points}</span>
                </div>
              ) : (
                <p className="mt-2 text-xs font-semibold text-slate-500">O ranking aparece quando os estudantes começarem a pontuar.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Scans/min</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{reports?.operational.scansPerMinuteLast15m ?? 0}</p>
            <p className="mt-1 text-xs text-slate-500">Últimos 15 minutos</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">Suspeitos</p>
            <p className="mt-1 text-2xl font-bold">{reports?.operational.suspiciousScans ?? 0}</p>
            <p className="mt-1 text-xs text-amber-800/70">Marcados para revisão</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Ranking</p>
            <p className="mt-1 text-sm font-bold">{reports?.rankingFrozen ? "Congelado" : "Em tempo real"}</p>
            <p className="mt-1 text-xs text-emerald-800/70">
              {reports?.rankingFrozen ? new Date(reports.rankingFrozen.frozenAt).toLocaleString("pt-AO") : "Pronto para congelar"}
            </p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:w-[560px] lg:grid-cols-4">
          <Button type="button" variant="outline" className="h-11 rounded-xl" disabled={operationalSaving !== null} onClick={() => void handleRecalculateRanking()}>
            {operationalSaving === "recalculate" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Recalcular
          </Button>
          <Button type="button" variant="outline" className="h-11 rounded-xl" disabled={operationalSaving !== null} onClick={() => void handleFreezeRanking()}>
            {operationalSaving === "freeze" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
            Congelar
          </Button>
          <Button type="button" className="h-11 rounded-xl bg-slate-950 text-white hover:bg-slate-800" disabled={operationalSaving !== null} onClick={() => void handleExportWinners()}>
            {operationalSaving === "export" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trophy className="mr-2 h-4 w-4" />}
            Exportar
          </Button>
          <Button type="button" variant="outline" className="h-11 rounded-xl border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100" disabled={operationalSaving !== null} onClick={() => setResetDialogOpen(true)}>
            <AlertTriangle className="mr-2 h-4 w-4" />
            Reiniciar desafio
          </Button>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <h3 className="flex items-center gap-2 text-base font-bold text-slate-950">
                <Gauge className="h-4 w-4 text-sky-700" />
                Missões oficiais
              </h3>
              <p className="mt-1 text-xs text-slate-500">Ativa, pausa e acompanha o desempenho de cada missão.</p>
            </div>
            <div className="flex gap-2">
              <div className="relative min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-10 w-full rounded-xl pl-9 text-sm sm:w-64"
                  placeholder="Pesquisar missão..."
                />
              </div>
              <Button variant="outline" className="h-10 rounded-xl" onClick={() => void load()} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          <div className="p-4 sm:p-5">
            {loading ? (
              <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-slate-100 bg-slate-50">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filteredMissions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
                <Route className="mx-auto h-9 w-9 text-slate-300" />
                <p className="mt-3 text-sm font-semibold text-slate-700">Nenhuma missão encontrada</p>
                <p className="mt-1 text-xs text-slate-500">Cria uma missão ou ajusta a pesquisa.</p>
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {filteredMissions.map((mission, index) => {
                  const meta = missionTypeMeta(mission.type);
                  const missionStats = overview?.missions.find((item) => item.id === mission.id);
                  return (
                    <motion.article
                      key={mission.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22, delay: index * 0.025 }}
                      className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${meta.color}`}>
                            {meta.label}
                          </span>
                          <h4 className="mt-2 truncate text-sm font-bold text-slate-950">{mission.title}</h4>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{mission.description || "Sem descrição."}</p>
                        </div>
                        <Switch checked={mission.active} onCheckedChange={() => void handleToggleMission(mission)} aria-label={mission.active ? "Pausar missão" : "Ativar missão"} />
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2">
                        <div className="rounded-xl border border-white bg-white px-3 py-2">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Pontos</p>
                          <p className="mt-1 text-lg font-bold text-slate-950">{mission.points}</p>
                        </div>
                        <div className="rounded-xl border border-white bg-white px-3 py-2">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Scans</p>
                          <p className="mt-1 text-lg font-bold text-slate-950">{missionStats?.scansCount ?? 0}</p>
                        </div>
                        <div className="rounded-xl border border-white bg-white px-3 py-2">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Pontos</p>
                          <p className="mt-1 text-lg font-bold text-slate-950">{missionStats?.ledgerCount ?? 0}</p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                        <span className="truncate">{mission.key}</span>
                        <span className={`rounded-full px-2 py-0.5 font-semibold ${mission.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                          {mission.active ? "Ativa" : "Pausada"}
                        </span>
                      </div>
                    </motion.article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-5">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
              <h3 className="flex items-center gap-2 text-base font-bold text-slate-950">
                <Plus className="h-4 w-4 text-primary" />
                Nova missão
              </h3>
              <p className="mt-1 text-xs text-slate-500">Cria a regra antes de ligar um QR a ela.</p>
            </div>
            <form className="space-y-3 p-4 sm:p-5" onSubmit={handleCreateMission}>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Nome da missão</label>
                <Input value={draft.title} onChange={(event) => handleTitleChange(event.target.value)} className="rounded-xl" placeholder="Ex.: Visita ao stand de IA" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Chave interna</label>
                <Input value={draft.key} onChange={(event) => setDraft((current) => ({ ...current, key: slugifyMissionKey(event.target.value) }))} className="rounded-xl font-mono text-xs" placeholder="visita-stand-ia" />
              </div>
              <div className="grid grid-cols-[1fr_110px] gap-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">Tipo</label>
                  <select
                    value={draft.type}
                    onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value }))}
                    className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                  >
                    {missionTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">Pontos</label>
                  <Input value={draft.points} onChange={(event) => setDraft((current) => ({ ...current, points: event.target.value.replace(/\D/g, "") }))} className="rounded-xl" inputMode="numeric" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Descrição</label>
                <Textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} className="min-h-20 rounded-xl text-sm" placeholder="O que o estudante precisa fazer para pontuar?" />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-xs font-semibold text-slate-700">Começar ativa</span>
                <Switch checked={draft.active} onCheckedChange={(active) => setDraft((current) => ({ ...current, active }))} />
              </div>
              <Button type="submit" className="h-11 w-full rounded-xl" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Guardar missão
              </Button>
            </form>
          </section>

          <section className="overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-sm">
            <div className="border-b border-indigo-100 bg-indigo-50/70 px-4 py-4 sm:px-5">
              <h3 className="flex items-center gap-2 text-base font-bold text-slate-950">
                <ScanLine className="h-4 w-4 text-indigo-700" />
                QR de etapa
              </h3>
              <p className="mt-1 text-xs text-slate-500">Liga batalha, pistas, cooperação e recuperação a uma missão.</p>
            </div>
            <form className="space-y-3 p-4 sm:p-5" onSubmit={handleCreateMissionQr}>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Missão ligada</label>
                <select
                  value={missionQrDraft.missionId}
                  onChange={(event) => setMissionQrDraft((current) => ({ ...current, missionId: event.target.value }))}
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                >
                  <option value="">Selecionar missão</option>
                  {missions.map((mission) => (
                    <option key={mission.id} value={mission.id}>{mission.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Tipo de QR</label>
                <select
                  value={missionQrDraft.type}
                  onChange={(event) => setMissionQrDraft((current) => ({ ...current, type: event.target.value as MissionQrDraft["type"] }))}
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                >
                  {missionQrTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label} - {option.hint}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Nome do QR</label>
                <Input
                  value={missionQrDraft.label}
                  onChange={(event) => setMissionQrDraft((current) => ({ ...current, label: event.target.value }))}
                  className="rounded-xl"
                  placeholder="Ex.: Pista 01 - Auditório"
                />
              </div>
              {missionQrDraft.type === "COOPERATIVE_MISSION_QR" ? (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">Grupo mínimo</label>
                  <Input
                    value={missionQrDraft.cooperativeThreshold}
                    onChange={(event) => setMissionQrDraft((current) => ({ ...current, cooperativeThreshold: event.target.value.replace(/\D/g, "") }))}
                    className="rounded-xl"
                    inputMode="numeric"
                  />
                </div>
              ) : null}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Descrição</label>
                <Textarea
                  value={missionQrDraft.description}
                  onChange={(event) => setMissionQrDraft((current) => ({ ...current, description: event.target.value }))}
                  className="min-h-16 rounded-xl text-sm"
                  placeholder="Orientação interna para esta etapa."
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2">
                <span className="text-xs font-semibold text-slate-700">Começar ativo</span>
                <Switch checked={missionQrDraft.active} onCheckedChange={(active) => setMissionQrDraft((current) => ({ ...current, active }))} />
              </div>
              <Button type="submit" className="h-11 w-full rounded-xl bg-indigo-700 text-white hover:bg-indigo-800" disabled={missionQrSaving}>
                {missionQrSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanLine className="mr-2 h-4 w-4" />}
                Gerar QR de etapa
              </Button>
            </form>

            {missionQrs.length > 0 ? (
              <div className="border-t border-slate-100 p-4 sm:p-5">
                <div className="space-y-2">
                  {missionQrs.slice(0, 5).map((qr) => {
                    const option = missionQrTypeOptions.find((item) => item.value === qr.type) ?? missionQrTypeOptions[0];
                    const QrIcon = option.icon;
                    return (
                      <div key={qr.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-800">
                              <QrIcon className="h-3 w-3" />
                              {option.label}
                            </span>
                            <p className="mt-1 truncate text-xs font-bold text-slate-900">{qr.label}</p>
                            <p className="mt-0.5 text-[10px] text-slate-500">{qr.missionTitle ?? "Sem missão"} · {qr.scansCount} scan(s)</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-lg px-2"
                              onClick={() => void handleCopyMissionQr(qr)}
                              aria-label="Copiar link do QR de etapa"
                              title="Copiar link"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-lg px-2"
                              onClick={() => void handleDownloadMissionQrPdf(qr)}
                              disabled={downloadingMissionQrId === qr.id}
                              aria-label="Baixar PDF do QR de etapa"
                              title="Baixar PDF"
                            >
                              {downloadingMissionQrId === qr.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </section>

          <section className="overflow-hidden rounded-2xl border border-orange-200 bg-white shadow-sm">
            <div className="border-b border-orange-100 bg-[linear-gradient(135deg,rgba(255,94,0,0.12),rgba(15,23,42,0.04))] px-4 py-4 sm:px-5">
              <h3 className="flex items-center gap-2 text-base font-bold text-slate-950">
                <Gift className="h-4 w-4 text-orange-700" />
                QR surpresa
              </h3>
              <p className="mt-1 text-xs text-slate-500">Cria sinais escondidos pela feira com pontos, risco e multiplicadores.</p>
            </div>
            <form className="space-y-3 p-4 sm:p-5" onSubmit={handleCreateSurpriseQr}>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Nome do QR</label>
                <Input
                  value={surpriseDraft.name}
                  onChange={(event) => setSurpriseDraft((current) => ({ ...current, name: event.target.value }))}
                  className="rounded-xl"
                  placeholder="Ex.: UOR Pulse #1"
                />
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_110px]">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">Efeito</label>
                  <select
                    value={surpriseDraft.effectType}
                    onChange={(event) => setSurpriseDraft((current) => ({ ...current, effectType: event.target.value as SurpriseDraft["effectType"] }))}
                    className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                  >
                    {surpriseEffectOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label} - {option.hint}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">Valor</label>
                  <Input
                    value={surpriseDraft.effectValue}
                    onChange={(event) => setSurpriseDraft((current) => ({ ...current, effectValue: event.target.value.replace(/\D/g, "") }))}
                    className="rounded-xl"
                    inputMode="numeric"
                  />
                </div>
              </div>
              {surpriseDraft.effectType === "UNIVERSAL_DYNAMIC" ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-900">Dinâmico universal</p>
                      <p className="mt-0.5 text-[11px] text-slate-600">Todos os QR do lote podem fazer tudo; a decisão muda por QR individual conforme o histórico daquele código.</p>
                    </div>
                    <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-orange-800">1 QR por página</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {[
                      ["Peso +", "universalAddWeight"],
                      ["Peso -", "universalSubtractWeight"],
                      ["Peso x", "universalMultiplyWeight"],
                      ["Peso /", "universalDivideWeight"],
                      ["Peso pista", "universalHintWeight"],
                      ["Peso recuperação", "universalRecoveryWeight"],
                    ].map(([label, key]) => (
                      <div key={key}>
                        <label className="mb-1 block text-[11px] font-semibold text-slate-600">{label}</label>
                        <Input
                          value={String(surpriseDraft[key as keyof SurpriseDraft] ?? "")}
                          onChange={(event) => setSurpriseDraft((current) => ({ ...current, [key]: event.target.value.replace(/\D/g, "") }))}
                          className="h-9 rounded-xl bg-white text-sm"
                          inputMode="numeric"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-600">Após X perdas</label>
                      <Input
                        value={surpriseDraft.convertAfterLosses}
                        onChange={(event) => setSurpriseDraft((current) => ({ ...current, convertAfterLosses: event.target.value.replace(/\D/g, "") }))}
                        className="h-9 rounded-xl bg-white text-sm"
                        inputMode="numeric"
                        placeholder="4"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-600">Peso + após perdas</label>
                      <Input
                        value={surpriseDraft.universalLossAddWeight}
                        onChange={(event) => setSurpriseDraft((current) => ({ ...current, universalLossAddWeight: event.target.value.replace(/\D/g, "") }))}
                        className="h-9 rounded-xl bg-white text-sm"
                        inputMode="numeric"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-600">Peso - após perdas</label>
                      <Input
                        value={surpriseDraft.universalLossSubtractWeight}
                        onChange={(event) => setSurpriseDraft((current) => ({ ...current, universalLossSubtractWeight: event.target.value.replace(/\D/g, "") }))}
                        className="h-9 rounded-xl bg-white text-sm"
                        inputMode="numeric"
                      />
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">Raridade</label>
                  <select
                    value={surpriseDraft.rarity}
                    onChange={(event) => setSurpriseDraft((current) => ({ ...current, rarity: event.target.value as SurpriseDraft["rarity"] }))}
                    className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                  >
                    <option value="COMMON">Comum</option>
                    <option value="RARE">Raro</option>
                    <option value="SECRET">Secreto</option>
                    <option value="TEMPORARY">Temporário</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">Visibilidade</label>
                  <select
                    value={surpriseDraft.visibility}
                    onChange={(event) => setSurpriseDraft((current) => ({ ...current, visibility: event.target.value as SurpriseDraft["visibility"] }))}
                    className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                  >
                    <option value="VISIBLE">Visível</option>
                    <option value="SEMI_HIDDEN">Semioculto</option>
                    <option value="SECRET">Secreto</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">Total</label>
                  <Input
                    value={surpriseDraft.maxUsesTotal}
                    onChange={(event) => setSurpriseDraft((current) => ({ ...current, maxUsesTotal: event.target.value.replace(/\D/g, "") }))}
                    className="rounded-xl"
                    inputMode="numeric"
                    placeholder="Livre"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">Por aluno</label>
                  <Input
                    value={surpriseDraft.maxUsesPerStudent}
                    onChange={(event) => setSurpriseDraft((current) => ({ ...current, maxUsesPerStudent: event.target.value.replace(/\D/g, "") }))}
                    className="rounded-xl"
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">Limite -</label>
                  <Input
                    value={surpriseDraft.negativeCapPerStudent}
                    onChange={(event) => setSurpriseDraft((current) => ({ ...current, negativeCapPerStudent: event.target.value.replace(/\D/g, "") }))}
                    className="rounded-xl"
                    inputMode="numeric"
                    placeholder="Auto"
                  />
                </div>
              </div>
              <div className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/60 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-orange-900">Lote de QR surpresa</p>
                    <p className="mt-0.5 text-[11px] text-orange-800">Imprime vários códigos numerados, como QR #001, para mudar o jogo durante a feira.</p>
                  </div>
                  {latestSurpriseBatch ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0 rounded-lg px-2 text-[11px]"
                      onClick={() => void handleDownloadSurpriseQrBatchPdf(latestSurpriseBatch.batchCode)}
                      disabled={Boolean(downloadingSurpriseBatchCode)}
                    >
                      {downloadingSurpriseBatchCode ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Download className="mr-1 h-3 w-3" />}
                      Baixar lote
                    </Button>
                  ) : null}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">Quantidade</label>
                    <Input
                      value={surpriseDraft.batchQuantity}
                      onChange={(event) => setSurpriseDraft((current) => ({ ...current, batchQuantity: event.target.value.replace(/\D/g, "") }))}
                      className="rounded-xl bg-white"
                      inputMode="numeric"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">Prefixo</label>
                    <Input
                      value={surpriseDraft.codePrefix}
                      onChange={(event) => setSurpriseDraft((current) => ({ ...current, codePrefix: event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") }))}
                      className="rounded-xl bg-white"
                      placeholder="QR"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">Início</label>
                    <Input
                      value={surpriseDraft.startNumber}
                      onChange={(event) => setSurpriseDraft((current) => ({ ...current, startNumber: event.target.value.replace(/\D/g, "") }))}
                      className="rounded-xl bg-white"
                      inputMode="numeric"
                      placeholder="1"
                    />
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr]">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">Após X perdas</label>
                    <Input
                      value={surpriseDraft.convertAfterLosses}
                      onChange={(event) => setSurpriseDraft((current) => ({ ...current, convertAfterLosses: event.target.value.replace(/\D/g, "") }))}
                      className="rounded-xl bg-white"
                      inputMode="numeric"
                      placeholder="Ex.: 5"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">Vira bónus de</label>
                    <Input
                      value={surpriseDraft.convertToEffectValue}
                      onChange={(event) => setSurpriseDraft((current) => ({ ...current, convertToEffectValue: event.target.value.replace(/\D/g, "") }))}
                      className="rounded-xl bg-white"
                      inputMode="numeric"
                      placeholder="15"
                    />
                  </div>
                </div>
                <Input
                  value={surpriseDraft.hintAfterLoss}
                  onChange={(event) => setSurpriseDraft((current) => ({ ...current, hintAfterLoss: event.target.value }))}
                  className="mt-2 rounded-xl bg-white"
                  placeholder="Palpite por WhatsApp/SMS depois de perder pontos"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3 h-10 w-full rounded-xl border-orange-300 bg-white text-orange-900 hover:bg-orange-100"
                  onClick={() => void handleCreateSurpriseQrBatch()}
                  disabled={surpriseBatchSaving}
                >
                  {surpriseBatchSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanLine className="mr-2 h-4 w-4" />}
                  Criar lote numerado
                </Button>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Descrição</label>
                <Textarea
                  value={surpriseDraft.description}
                  onChange={(event) => setSurpriseDraft((current) => ({ ...current, description: event.target.value }))}
                  className="min-h-16 rounded-xl text-sm"
                  placeholder="Texto curto para orientar a impressão ou o reveal."
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-orange-100 bg-orange-50 px-3 py-2">
                <span className="text-xs font-semibold text-slate-700">Começar ativo</span>
                <Switch checked={surpriseDraft.active} onCheckedChange={(active) => setSurpriseDraft((current) => ({ ...current, active }))} />
              </div>
              <Button type="submit" className="h-11 w-full rounded-xl bg-slate-950 text-white hover:bg-slate-800" disabled={surpriseSaving}>
                {surpriseSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Guardar QR surpresa
              </Button>
            </form>

            {surpriseQrBatches.length > 0 ? (
              <div className="border-t border-orange-100 bg-orange-50/30 p-4 sm:p-5">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-orange-900">Lotes recentes</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">Baixa novamente qualquer PDF gerado em lote para impressão do desafio.</p>
                  </div>
                  <span className="text-[11px] font-semibold text-orange-800">
                    {surpriseQrBatches.length} lote(s) disponível(is)
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {surpriseQrBatches.slice(0, 6).map((batch) => {
                    const meta = surpriseEffectMeta(batch.effectType);
                    const EffectIcon = meta.icon;
                    const range = batch.firstCode && batch.lastCode
                      ? `${batch.firstCode} - ${batch.lastCode}`
                      : batch.batchCode;

                    return (
                      <div key={batch.batchCode} className="flex flex-col gap-3 rounded-xl border border-orange-100 bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${meta.color}`}>
                              <EffectIcon className="h-3 w-3" />
                              {meta.label}
                            </span>
                            <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">{batch.batchCode}</span>
                          </div>
                          <p className="mt-1 text-xs font-bold text-slate-900">
                            {batch.quantity} QR · {range}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {batch.activeCount} ativo(s) · {batch.printedCount} impresso(s)
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 w-full rounded-lg border-orange-200 bg-orange-50 text-xs font-bold text-orange-900 hover:bg-orange-100 sm:w-auto"
                          onClick={() => void handleDownloadSurpriseQrBatchPdf(batch.batchCode)}
                          disabled={downloadingSurpriseBatchCode === batch.batchCode}
                        >
                          {downloadingSurpriseBatchCode === batch.batchCode ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-2 h-3.5 w-3.5" />}
                          Baixar PDF do lote
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {surpriseQrs.length > 0 ? (
              <div className="border-t border-slate-100 p-4 sm:p-5">
                <div className="space-y-2">
                  {surpriseQrs.slice(0, 5).map((surprise) => {
                    const meta = surpriseEffectMeta(surprise.effectType);
                    const EffectIcon = meta.icon;
                    return (
                      <div key={surprise.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${meta.color}`}>
                              <EffectIcon className="h-3 w-3" />
                              {meta.label}
                            </span>
                            <p className="mt-1 truncate text-xs font-bold text-slate-900">{surprise.name}</p>
                            <p className="mt-0.5 text-[10px] text-slate-500">
                              {surprise.displayCode ? `${surprise.displayCode} · ` : ""}{surprise.effectsCount} descoberta(s) · {surprise.rarity.toLowerCase()}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-lg px-2"
                              onClick={() => void handleCopySurpriseQr(surprise)}
                              aria-label="Copiar link do QR surpresa"
                              title="Copiar link"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-lg px-2"
                              onClick={() => void handleDownloadSurpriseQrPdf(surprise)}
                              disabled={downloadingSurpriseQrId === surprise.id}
                              aria-label="Baixar PDF do QR surpresa"
                              title="Baixar PDF"
                            >
                              {downloadingSurpriseQrId === surprise.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                            </Button>
                            <Switch checked={surprise.active} onCheckedChange={() => void handleToggleSurpriseQr(surprise)} aria-label={surprise.active ? "Pausar QR surpresa" : "Ativar QR surpresa"} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </section>

          <section className="overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-sm">
            <div className="border-b border-violet-100 bg-violet-50/70 px-4 py-4 sm:px-5">
              <h3 className="flex items-center gap-2 text-base font-bold text-slate-950">
                <Sparkles className="h-4 w-4 text-violet-700" />
                Desafios e quiz
              </h3>
              <p className="mt-1 text-xs text-slate-500">Liga uma pergunta a um QR de desafio ou quiz.</p>
            </div>
            <form className="space-y-3 p-4 sm:p-5" onSubmit={handleCreateChallenge}>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">Tipo</label>
                  <select
                    value={challengeDraft.type}
                    onChange={(event) => setChallengeDraft((current) => ({ ...current, type: event.target.value as ChallengeDraft["type"] }))}
                    className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                  >
                    <option value="EXHIBITOR_CHALLENGE">Desafio do expositor</option>
                    <option value="SPECIAL_QUIZ">Quiz especial</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">Tentativas</label>
                  <Input
                    value={challengeDraft.maxAttempts}
                    onChange={(event) => setChallengeDraft((current) => ({ ...current, maxAttempts: event.target.value.replace(/\D/g, "") }))}
                    className="rounded-xl"
                    inputMode="numeric"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">Missão</label>
                  <select
                    value={challengeDraft.missionId}
                    onChange={(event) => setChallengeDraft((current) => ({ ...current, missionId: event.target.value }))}
                    className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Automática</option>
                    {missions
                      .filter((mission) => mission.type === "EXHIBITOR_CHALLENGE" || mission.type === "SPECIAL_QUIZ" || mission.type === "CLUE_CHAIN")
                      .map((mission) => (
                        <option key={mission.id} value={mission.id}>{mission.title}</option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">ID do QR</label>
                  <Input
                    value={challengeDraft.qrActionId}
                    onChange={(event) => setChallengeDraft((current) => ({ ...current, qrActionId: event.target.value.replace(/\D/g, "") }))}
                    className="rounded-xl"
                    inputMode="numeric"
                    placeholder="Opcional"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Pergunta</label>
                <Textarea
                  value={challengeDraft.question}
                  onChange={(event) => setChallengeDraft((current) => ({ ...current, question: event.target.value }))}
                  className="min-h-20 rounded-xl text-sm"
                  placeholder="Ex.: Qual tecnologia o projeto usa para identificar imagens?"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Opções</label>
                <Textarea
                  value={challengeDraft.options}
                  onChange={(event) => setChallengeDraft((current) => ({ ...current, options: event.target.value }))}
                  className="min-h-20 rounded-xl text-sm"
                  placeholder={"Uma opção por linha\nIA\nBlockchain\nRedes"}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Resposta correta</label>
                <Input
                  value={challengeDraft.correctAnswer}
                  onChange={(event) => setChallengeDraft((current) => ({ ...current, correctAnswer: event.target.value }))}
                  className="rounded-xl"
                  placeholder="Ex.: IA"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Explicação</label>
                <Textarea
                  value={challengeDraft.explanation}
                  onChange={(event) => setChallengeDraft((current) => ({ ...current, explanation: event.target.value }))}
                  className="min-h-16 rounded-xl text-sm"
                  placeholder="Opcional"
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-violet-100 bg-violet-50 px-3 py-2">
                <span className="text-xs font-semibold text-slate-700">Começar ativo</span>
                <Switch checked={challengeDraft.active} onCheckedChange={(active) => setChallengeDraft((current) => ({ ...current, active }))} />
              </div>
              <Button type="submit" className="h-11 w-full rounded-xl bg-violet-700 text-white hover:bg-violet-800" disabled={challengeSaving}>
                {challengeSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Guardar desafio
              </Button>
            </form>

            {visibleChallenges.length > 0 ? (
              <div className="border-t border-slate-100 p-4 sm:p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Perguntas submetidas
                  </p>
                  <span className="rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-violet-800">
                    {visibleChallenges.length} no total
                  </span>
                </div>
                <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
                  {visibleChallenges.map((challenge) => (
                    <div key={challenge.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className={`mb-1 inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${adminChallengeStatusClass(challenge)}`}>
                            {adminChallengeStatusLabel(challenge)}
                          </span>
                          <p className="line-clamp-2 text-xs font-bold text-slate-900">{challenge.question}</p>
                          <p className="mt-1 text-[10px] text-slate-500">
                            {challenge.qrActionLabel || "Sem QR ligado"} · v{challenge.version} · {challenge.answersCount} resposta(s)
                          </p>
                          {challenge.reviewNote ? (
                            <p className="mt-1 rounded-lg border border-rose-100 bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-700">
                              Nota da admin: {challenge.reviewNote}
                            </p>
                          ) : null}
                          <div className="mt-2 grid gap-2">
                            <Input
                              value={reviewDrafts[challenge.id] ?? ""}
                              onChange={(event) => setReviewDrafts((current) => ({ ...current, [challenge.id]: event.target.value }))}
                              className="h-8 rounded-lg bg-white text-[11px]"
                              placeholder="Nota de revisão para o expositor"
                              disabled={reviewSavingId === challenge.id}
                            />
                            <div className="flex flex-wrap gap-1.5">
                              <Button
                                type="button"
                                size="sm"
                                className="h-8 rounded-lg bg-emerald-600 px-2.5 text-[11px] font-bold text-white hover:bg-emerald-700"
                                disabled={reviewSavingId === challenge.id}
                                onClick={() => void handleReviewChallenge(challenge, "APPROVED")}
                              >
                                {reviewSavingId === challenge.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}
                                Aprovar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 rounded-lg border-rose-200 bg-white px-2.5 text-[11px] font-bold text-rose-700 hover:bg-rose-50"
                                disabled={reviewSavingId === challenge.id}
                                onClick={() => void handleReviewChallenge(challenge, "REJECTED")}
                              >
                                Recusar
                              </Button>
                            </div>
                          </div>
                        </div>
                        <Switch checked={challenge.active} onCheckedChange={() => void handleToggleChallenge(challenge)} aria-label={challenge.active ? "Pausar desafio" : "Ativar desafio"} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
              <h3 className="flex items-center gap-2 text-base font-bold text-slate-950">
                <Trophy className="h-4 w-4 text-amber-600" />
                Ranking
              </h3>
              <p className="mt-1 text-xs text-slate-500">Top estudantes por pontos válidos.</p>
            </div>
            <div className="p-4 sm:p-5">
              {overview?.leaderboard.length ? (
                <div className="space-y-2">
                  {overview.leaderboard.slice(0, 8).map((item) => (
                    <div key={item.studentNumber} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                      <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold ${
                        item.position === 1 ? "bg-amber-100 text-amber-800" : item.position === 2 ? "bg-slate-200 text-slate-800" : item.position === 3 ? "bg-orange-100 text-orange-800" : "bg-white text-slate-600"
                      }`}>
                        #{item.position}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{item.studentName || `Estudante ${item.studentNumber}`}</p>
                        <p className="truncate text-xs text-slate-500">{item.studentCourse || item.studentNumber}</p>
                      </div>
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">{item.points} pts</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                  <Award className="mx-auto h-9 w-9 text-slate-300" />
                  <p className="mt-3 text-sm font-semibold text-slate-700">Ranking ainda vazio</p>
                  <p className="mt-1 text-xs text-slate-500">Os pontos aparecem quando os estudantes começarem a escanear QR.</p>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/80 text-emerald-700">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold">Pontuação auditável</p>
                <p className="mt-1 text-xs leading-5 text-emerald-800/80">
                  Cada ponto é guardado no ledger com chave única por estudante, missão e origem. Repetição de QR não duplica pontuação.
                </p>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
