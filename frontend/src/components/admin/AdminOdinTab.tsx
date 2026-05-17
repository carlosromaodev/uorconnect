import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Ban,
  Eye,
  Loader2,
  Radar,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  api,
  type OdinDeviceRisk,
  type OdinExcludeStudentInput,
  type OdinOverview,
  type OdinRiskLevel,
  type OdinStudentRisk,
} from "@/lib/api";

const riskStyles: Record<OdinRiskLevel, string> = {
  LOW: "border-slate-200 bg-slate-50 text-slate-700",
  MEDIUM: "border-amber-200 bg-amber-50 text-amber-800",
  HIGH: "border-orange-200 bg-orange-50 text-orange-800",
  CRITICAL: "border-rose-200 bg-rose-50 text-rose-800",
};

const riskLabels: Record<OdinRiskLevel, string> = {
  LOW: "baixo",
  MEDIUM: "médio",
  HIGH: "alto",
  CRITICAL: "crítico",
};

const defaultExcludeOptions: OdinExcludeStudentInput = {
  reason: "",
  deleteProfile: true,
  removeVotes: true,
  removeLikes: true,
  removeComments: true,
  removePassport: false,
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-AO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function shortDeviceId(value: string) {
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function riskBadge(level: OdinRiskLevel, score: number) {
  return (
    <Badge className={`border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${riskStyles[level]}`}>
      {riskLabels[level]} · {score}
    </Badge>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "slate" | "orange" | "rose" | "emerald";
}) {
  const toneClass = {
    slate: "border-slate-200 bg-slate-50 text-slate-950",
    orange: "border-orange-200 bg-orange-50 text-orange-900",
    rose: "border-rose-200 bg-rose-50 text-rose-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
  }[tone];

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-[11px] font-black uppercase tracking-[0.16em] opacity-70">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight">{value}</p>
    </div>
  );
}

function DeviceCard({ device }: { device: OdinDeviceRisk }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-slate-500" />
            <p className="truncate font-mono text-sm font-bold text-slate-950">{shortDeviceId(device.deviceId)}</p>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Último sinal {formatDateTime(device.lastSeenAt)} · {device.eventCount} evento(s)
          </p>
        </div>
        {riskBadge(device.riskLevel, device.riskScore)}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <span className="rounded-xl bg-slate-50 px-3 py-2 font-semibold text-slate-600">{device.distinctStudents} contas</span>
        <span className="rounded-xl bg-slate-50 px-3 py-2 font-semibold text-slate-600">{device.voteCount} votos</span>
        <span className="rounded-xl bg-slate-50 px-3 py-2 font-semibold text-slate-600">{device.loginCount} logins</span>
        <span className="rounded-xl bg-slate-50 px-3 py-2 font-semibold text-slate-600">{device.distinctProjectsVoted} projetos</span>
      </div>

      <div className="mt-4 space-y-2">
        {device.reasons.map((reason) => (
          <p key={reason} className="rounded-xl border border-orange-100 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-900">
            {reason}
          </p>
        ))}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Contas vistas</p>
          <div className="space-y-2">
            {device.students.slice(0, 5).map((student) => (
              <div key={`${device.deviceId}-${student.studentNumber}`} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs">
                <span className="min-w-0 truncate font-bold text-slate-800">
                  {student.studentName ?? student.studentNumber}
                </span>
                <span className="shrink-0 text-slate-500">{student.voteCount} voto(s)</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Projetos tocados</p>
          <div className="space-y-2">
            {device.projects.slice(0, 5).map((project) => (
              <div key={`${device.deviceId}-${project.submissionId}`} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs">
                <span className="min-w-0 truncate font-bold text-slate-800">{project.submissionName}</span>
                <span className="shrink-0 text-slate-500">{project.votes} voto(s)</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StudentRiskCard({
  student,
  onExclude,
}: {
  student: OdinStudentRisk;
  onExclude: (student: OdinStudentRisk) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-base font-black text-slate-950">
            {student.studentName ?? `Estudante ${student.studentNumber}`}
          </p>
          <p className="text-xs text-slate-500">
            {student.studentNumber} · {student.studentCourse ?? "curso por confirmar"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {riskBadge(student.riskLevel, student.riskScore)}
          <Button
            size="sm"
            variant="destructive"
            className="h-8 rounded-xl text-xs"
            disabled={!student.studentId}
            onClick={() => onExclude(student)}
          >
            <Ban className="mr-1.5 h-3.5 w-3.5" />
            Excluir
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
        <span className="rounded-xl bg-slate-50 px-3 py-2 font-semibold text-slate-600">{student.devices.length} dispositivo(s)</span>
        <span className="rounded-xl bg-slate-50 px-3 py-2 font-semibold text-slate-600">{student.loginCount} login(s)</span>
        <span className="rounded-xl bg-slate-50 px-3 py-2 font-semibold text-slate-600">{student.voteCount} voto(s)</span>
      </div>

      <div className="mt-4 space-y-2">
        {student.reasons.slice(0, 3).map((reason) => (
          <p key={reason} className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-900">
            {reason}
          </p>
        ))}
      </div>
    </div>
  );
}

export default function AdminOdinTab() {
  const [overview, setOverview] = useState<OdinOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [windowHours, setWindowHours] = useState(48);
  const [selectedStudent, setSelectedStudent] = useState<OdinStudentRisk | null>(null);
  const [excludeOptions, setExcludeOptions] = useState<OdinExcludeStudentInput>(defaultExcludeOptions);
  const [excluding, setExcluding] = useState(false);

  const topDevices = useMemo(
    () => (overview?.devices ?? []).filter((device) => device.riskScore >= 40).slice(0, 8),
    [overview],
  );
  const topStudents = useMemo(
    () => (overview?.students ?? []).slice(0, 8),
    [overview],
  );

  const loadOverview = async (hours = windowHours) => {
    setLoading(true);
    try {
      setOverview(await api.odin.overview({ windowHours: hours }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar o ODIN.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOverview(windowHours);
  }, [windowHours]);

  const openExcludeDialog = (student: OdinStudentRisk) => {
    setSelectedStudent(student);
    setExcludeOptions({
      ...defaultExcludeOptions,
      reason: `Suspeita ODIN: ${student.reasons[0] ?? "atividade incomum no mesmo dispositivo."}`,
    });
  };

  const updateExcludeOption = (key: keyof OdinExcludeStudentInput, value: boolean | string) => {
    setExcludeOptions((current) => ({ ...current, [key]: value }));
  };

  const handleExclude = async () => {
    if (!selectedStudent?.studentId) return;
    if (excludeOptions.reason.trim().length < 8) {
      toast.error("Escreve um motivo claro para a auditoria.");
      return;
    }

    setExcluding(true);
    try {
      const result = await api.odin.excludeStudent(selectedStudent.studentId, excludeOptions);
      toast.success(`ODIN limpou ${result.removed.studentVotes} voto(s) e registou a ação.`);
      setSelectedStudent(null);
      await loadOverview(windowHours);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível executar a ação ODIN.");
    } finally {
      setExcluding(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 text-white shadow-xl">
        <div className="grid gap-6 p-5 md:grid-cols-[1.3fr_0.7fr] md:p-7">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-300/30 bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-orange-100">
              <Radar className="h-3.5 w-3.5" />
              Sistema ODIN
            </div>
            <h2 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">
              Anti-bot, multi-conta e pressão suspeita nos votos
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              O ODIN analisa logins, votos e interações por cookie/dispositivo persistente. Ele não decide sozinho:
              mostra indícios, provas e deixa a exclusão sempre auditável pela organização.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-300">Janela de análise</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[24, 48, 168].map((hours) => (
                <Button
                  key={hours}
                  type="button"
                  size="sm"
                  variant={windowHours === hours ? "secondary" : "outline"}
                  className="rounded-xl"
                  onClick={() => setWindowHours(hours)}
                >
                  {hours === 168 ? "7 dias" : `${hours}h`}
                </Button>
              ))}
            </div>
            <Button
              type="button"
              className="mt-4 w-full rounded-xl bg-orange-500 text-white hover:bg-orange-600"
              onClick={() => void loadOverview(windowHours)}
              disabled={loading}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Atualizar ODIN
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Dispositivos suspeitos" value={overview?.stats.suspiciousDevices ?? 0} tone="rose" />
        <StatCard label="Contas em risco" value={overview?.stats.suspectStudents ?? 0} tone="orange" />
        <StatCard label="Votos sob análise" value={overview?.stats.suspectVotes ?? 0} tone="slate" />
        <StatCard label="Mesma cookie/dispositivo" value={overview?.stats.multiAccountDevices ?? 0} tone="emerald" />
      </div>

      {loading && !overview ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-3 py-14 text-sm font-semibold text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            ODIN está a cruzar dispositivos, contas e votos...
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ShieldAlert className="h-5 w-5 text-orange-600" />
                  Dispositivos com sinais fortes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {topDevices.map((device) => (
                  <DeviceCard key={device.deviceId} device={device} />
                ))}
                {topDevices.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50 p-6 text-center text-sm font-semibold text-emerald-800">
                    Nenhum dispositivo com risco relevante nesta janela.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5 text-rose-600" />
                  Perfis a rever
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {topStudents.map((student) => (
                  <StudentRiskCard
                    key={`${student.studentId ?? student.studentNumber}-${student.lastSeenAt}`}
                    student={student}
                    onExclude={openExcludeDialog}
                  />
                ))}
                {topStudents.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-600">
                    Ainda não há perfis suspeitos. Continua a monitorizar durante a votação.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Eye className="h-5 w-5 text-slate-700" />
                  Projetos sob pressão
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(overview?.projects ?? []).slice(0, 8).map((project) => (
                  <div key={project.submissionId} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-black text-slate-950">{project.submissionName}</p>
                        <p className="text-xs text-slate-500">
                          {project.suspiciousDevices} dispositivo(s) · {project.suspiciousStudents} conta(s)
                        </p>
                      </div>
                      <Badge className="border border-rose-200 bg-rose-50 text-rose-800">
                        {project.suspiciousVotes} voto(s)
                      </Badge>
                    </div>
                  </div>
                ))}
                {(overview?.projects ?? []).length === 0 && (
                  <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm font-semibold text-slate-600">
                    Nenhum projeto com pressão suspeita nesta janela.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  O que mais o ODIN deve acompanhar
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(overview?.suggestions ?? []).map((suggestion) => (
                  <p key={suggestion} className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold leading-6 text-slate-700">
                    {suggestion}
                  </p>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <Dialog open={Boolean(selectedStudent)} onOpenChange={(open) => !open && setSelectedStudent(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-rose-600" />
              Excluír perfil e limpar ações
            </DialogTitle>
            <DialogDescription>
              Esta ação fica registada na auditoria. Usa-a quando a revisão humana confirmar abuso ou bot.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="font-black text-slate-950">
                {selectedStudent?.studentName ?? selectedStudent?.studentNumber}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {selectedStudent?.studentNumber} · {selectedStudent?.voteCount ?? 0} voto(s) · risco {selectedStudent?.riskScore ?? 0}
              </p>
            </div>

            <label className="space-y-2 text-sm font-semibold text-slate-700">
              Motivo para auditoria
              <Textarea
                value={excludeOptions.reason}
                onChange={(event) => updateExcludeOption("reason", event.target.value)}
                className="min-h-28"
                maxLength={500}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["deleteProfile", "Bloquear perfil/login"],
                ["removeVotes", "Remover votos e pontos"],
                ["removeLikes", "Remover likes"],
                ["removeComments", "Remover comentários"],
                ["removePassport", "Remover ações do passaporte"],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700">
                  <Checkbox
                    checked={Boolean(excludeOptions[key as keyof OdinExcludeStudentInput])}
                    onCheckedChange={(checked) => updateExcludeOption(key as keyof OdinExcludeStudentInput, checked === true)}
                  />
                  {label}
                </label>
              ))}
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              <AlertTriangle className="mr-2 inline h-4 w-4" />
              O cookie de dispositivo é um sinal forte para multi-conta no mesmo navegador, mas IP e navegador podem ser partilhados em laboratórios. Revê os motivos antes de confirmar.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedStudent(null)} disabled={excluding}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => void handleExclude()} disabled={excluding}>
              {excluding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ban className="mr-2 h-4 w-4" />}
              Confirmar ODIN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
