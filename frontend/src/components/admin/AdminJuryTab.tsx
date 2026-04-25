import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, KeyRound, Loader2, Plus, RefreshCcw, Send, Trash2, UserSquare2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, type JuryMember } from "@/lib/api";

function formatDateLabel(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("pt-PT");
}

function normalizePhoneDraft(value: string) {
  return value.replace(/[^\d+\s()-]/g, "").slice(0, 24);
}

type JuryAccessForm = {
  team: string;
  role: "SUPER_ADMIN" | "TEAM_LEAD" | "MEMBER";
  permissions: string[];
};

const defaultJuryAccessForm: JuryAccessForm = {
  team: "Júri",
  role: "TEAM_LEAD",
  permissions: ["OVERVIEW", "SUBMISSIONS", "VOTES", "WINNERS"],
};

const adminPermissions = [
  { value: "OVERVIEW", label: "Visão Geral" },
  { value: "ANALYTICS", label: "Analytics" },
  { value: "SMS", label: "SMS" },
  { value: "JURY", label: "Júri" },
  { value: "ATTENDANCE", label: "Check-in" },
  { value: "CERTIFICATES", label: "Certificados" },
  { value: "AUDIT", label: "Auditoria" },
  { value: "SUBMISSIONS", label: "Candidaturas" },
  { value: "SPEAKERS", label: "Palestrantes" },
  { value: "SCHEDULE", label: "Agenda" },
  { value: "GUIDE", label: "Guia" },
  { value: "COURSES", label: "Cursos" },
  { value: "PANELS", label: "Painéis" },
  { value: "EVENTO", label: "Evento" },
  { value: "FAQ", label: "FAQ" },
  { value: "LIVE", label: "Ao Vivo" },
  { value: "VOTES", label: "Votações" },
  { value: "SECURITY", label: "Segurança" },
  { value: "STUDENTS", label: "Estudantes" },
  { value: "WINNERS", label: "Vencedores" },
];

export function AdminJuryTab() {
  const [juryMembers, setJuryMembers] = useState<JuryMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [accessForm, setAccessForm] = useState<JuryAccessForm>(defaultJuryAccessForm);
  const [expiresInMinutes, setExpiresInMinutes] = useState(15);

  const activeMembers = useMemo(
    () => juryMembers.filter((member) => member.isActive),
    [juryMembers],
  );

  const fetchJuryMembers = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await api.jury.list();
      setJuryMembers(payload);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao carregar lista de júri.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchJuryMembers();
  }, [fetchJuryMembers]);

  const handleAddMember = async () => {
    if (!name.trim()) {
      toast.error("Indica o nome do júri.");
      return;
    }

    if (!phone.trim()) {
      toast.error("Indica o número de telefone do júri.");
      return;
    }

    setBusyKey("create-member");
    try {
      const created = await api.jury.create({
        name: name.trim(),
        phone: phone.trim(),
        ...accessForm,
      });
      setJuryMembers((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setName("");
      setPhone("");
      setAccessForm(defaultJuryAccessForm);
      toast.success("Número de júri adicionado com sucesso.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível adicionar o júri.");
    } finally {
      setBusyKey(null);
    }
  };

  const selectedPermissions = accessForm.role === "SUPER_ADMIN"
    ? adminPermissions.map((permission) => permission.value)
    : accessForm.permissions;

  const updatePermission = (permission: string, checked: boolean) => {
    setAccessForm((current) => {
      const currentPermissions = new Set(current.permissions);
      if (checked) {
        currentPermissions.add(permission);
      } else {
        currentPermissions.delete(permission);
      }
      return { ...current, permissions: Array.from(currentPermissions) };
    });
  };

  const handleSendCode = async (member: JuryMember) => {
    setBusyKey(`send-${member.id}`);
    try {
      const result = await api.jury.sendCode(member.id, expiresInMinutes);
      toast.success(`Código enviado para ${result.phone}. Últimos dígitos: ${result.codeLast4}.`);
      setJuryMembers((current) => current.map((item) => (
        item.id === member.id
          ? { ...item, lastCodeSentAt: new Date().toISOString() }
          : item
      )));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar o código de acesso.");
    } finally {
      setBusyKey(null);
    }
  };

  const handleRemoveMember = async (member: JuryMember) => {
    if (!window.confirm(`Remover ${member.name} da lista de júri?`)) {
      return;
    }

    setBusyKey(`remove-${member.id}`);
    try {
      await api.jury.remove(member.id);
      setJuryMembers((current) => current.filter((item) => item.id !== member.id));
      toast.success("Júri removido com sucesso.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível remover o júri.");
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/60">
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center gap-2 text-xl">
            <KeyRound className="h-5 w-5 text-primary" />
            Acesso de júri por código único
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Adiciona os números de júri e envia códigos únicos por SMS a partir da administração.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_180px]">
            <Input
              placeholder="Nome do júri"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Input
              placeholder="Telefone (+244...)"
              value={phone}
              onChange={(event) => setPhone(normalizePhoneDraft(event.target.value))}
            />
            <Button onClick={() => void handleAddMember()} disabled={busyKey === "create-member"}>
              {busyKey === "create-member" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Adicionar júri
            </Button>
          </div>

          <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Equipa</p>
                <Input
                  value={accessForm.team}
                  onChange={(event) => setAccessForm((current) => ({ ...current, team: event.target.value }))}
                  placeholder="Ex.: Júri técnico"
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Perfil</p>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={accessForm.role}
                  onChange={(event) => setAccessForm((current) => ({
                    ...current,
                    role: event.target.value as JuryAccessForm["role"],
                  }))}
                >
                  <option value="TEAM_LEAD">Líder</option>
                  <option value="MEMBER">Membro</option>
                  <option value="SUPER_ADMIN">Super admin</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Áreas permitidas</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {adminPermissions.map((permission) => {
                  const checked = selectedPermissions.includes(permission.value);
                  return (
                    <button
                      key={permission.value}
                      type="button"
                      disabled={accessForm.role === "SUPER_ADMIN"}
                      onClick={() => updatePermission(permission.value, !checked)}
                      className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left text-xs transition ${
                        checked
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border/70 bg-background text-muted-foreground hover:border-primary/30"
                      } ${accessForm.role === "SUPER_ADMIN" ? "opacity-80" : ""}`}
                    >
                      <span className="font-medium">{permission.label}</span>
                      {checked ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-muted/35 p-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock3 className="h-4 w-4" />
              Validade do código (min)
            </div>
            <Input
              type="number"
              min={3}
              max={60}
              className="h-10 w-28"
              value={expiresInMinutes}
              onChange={(event) => setExpiresInMinutes(Math.min(60, Math.max(3, Number(event.target.value) || 15)))}
            />
            <Button variant="outline" onClick={() => void fetchJuryMembers()}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Atualizar lista
            </Button>
            <Badge variant="secondary">{activeMembers.length} júri(s) ativo(s)</Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-lg">Jurados registados</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex min-h-[180px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : juryMembers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/80 p-8 text-center text-sm text-muted-foreground">
              Ainda não existem números de júri registados.
            </div>
          ) : (
            <div className="space-y-3">
              {juryMembers.map((member) => (
                <div key={member.id} className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background p-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <UserSquare2 className="h-4 w-4 text-primary" />
                      <p className="text-sm font-semibold">{member.name}</p>
                      <Badge variant={member.isActive ? "default" : "secondary"}>{member.isActive ? "Ativo" : "Inativo"}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{member.phone}</p>
                    <p className="text-xs text-muted-foreground">
                      {member.team} · {member.role === "SUPER_ADMIN" ? "Super admin" : member.role === "TEAM_LEAD" ? "Líder" : "Membro"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Áreas: {member.permissions === "ALL" ? "Todas" : member.permissions.split(",").join(", ")}
                    </p>
                    <p className="text-xs text-muted-foreground">Último código enviado: {formatDateLabel(member.lastCodeSentAt)}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => void handleSendCode(member)}
                      disabled={busyKey === `send-${member.id}` || !member.isActive}
                    >
                      {busyKey === `send-${member.id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      Enviar código
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleRemoveMember(member)}
                      disabled={busyKey === `remove-${member.id}`}
                    >
                      {busyKey === `remove-${member.id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                      Remover
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
