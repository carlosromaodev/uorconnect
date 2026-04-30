import type { ReactNode } from "react";
import { CheckCircle2, Loader2, MessageSquare, Shield, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ContextualSmsAction } from "@/components/admin/ContextualSmsAction";
import type { AdminAuthorizedStudent, StudentProfile } from "@/lib/api";

type AdminSecurityTabProps = {
  accessForm: AdminAccessForm;
  authorizedAdminStudents: AdminAuthorizedStudent[];
  authorizedStudentNumber: string;
  busyKey: string | null;
  recentLogins: StudentProfile[];
  onAccessFormChange: (value: AdminAccessForm | ((current: AdminAccessForm) => AdminAccessForm)) => void;
  onAuthorizeAdminStudent: () => void;
  onAuthorizedStudentNumberChange: (value: string) => void;
  onRevokeAdminStudent: (studentNumber: string) => void;
};

type AdminPermission = {
  value: string;
  label: string;
};

type AdminAccessForm = {
  team: string;
  role: "SUPER_ADMIN" | "TEAM_LEAD" | "MEMBER";
  permissions: string[];
};

const adminPermissions: AdminPermission[] = [
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

function normalizeStudentNumberInput(value: string) {
  return value.replace(/\D/g, "").slice(0, 10);
}

function whatsappLink(phone?: string | null) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}

function formatDateLabel(value: string) {
  if (!value) return "Sem data";
  return new Date(value).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

export default function AdminSecurityTab({
  accessForm,
  authorizedAdminStudents,
  authorizedStudentNumber,
  busyKey,
  recentLogins,
  onAccessFormChange,
  onAuthorizeAdminStudent,
  onAuthorizedStudentNumberChange,
  onRevokeAdminStudent,
}: AdminSecurityTabProps) {
  const selectedPermissions = accessForm.role === "SUPER_ADMIN"
    ? adminPermissions.map((permission) => permission.value)
    : accessForm.permissions;

  const updatePermission = (permission: string, checked: boolean) => {
    onAccessFormChange((current) => {
      const currentPermissions = new Set(current.permissions);
      if (checked) {
        currentPermissions.add(permission);
      } else {
        currentPermissions.delete(permission);
      }
      return {
        ...current,
        permissions: Array.from(currentPermissions),
      };
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-primary" />
              Acessos administrativos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
              <div className="mb-4 flex flex-col gap-1">
                <p className="text-sm font-semibold">Novo acesso</p>
                <p className="text-xs text-muted-foreground">Define a equipa, o perfil e os módulos que este utilizador pode gerir.</p>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <FormField label="Número de estudante">
                  <Input
                    value={authorizedStudentNumber}
                    onChange={(event) => onAuthorizedStudentNumberChange(normalizeStudentNumberInput(event.target.value))}
                    placeholder="Até 10 dígitos"
                    inputMode="numeric"
                    maxLength={10}
                  />
                </FormField>
                <FormField label="Equipa">
                  <Input
                    value={accessForm.team}
                    onChange={(event) => onAccessFormChange((current) => ({ ...current, team: event.target.value }))}
                    placeholder="Ex: Credenciamento"
                  />
                </FormField>
                <FormField label="Perfil">
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={accessForm.role}
                    onChange={(event) => {
                      const role = event.target.value as AdminAccessForm["role"];
                      onAccessFormChange((current) => ({
                        ...current,
                        role,
                        permissions: role === "SUPER_ADMIN" ? current.permissions : current.permissions.length ? current.permissions : ["OVERVIEW"],
                      }));
                    }}
                  >
                    <option value="SUPER_ADMIN">Super admin</option>
                    <option value="TEAM_LEAD">Líder de equipa</option>
                    <option value="MEMBER">Membro</option>
                  </select>
                </FormField>
                <div className="flex items-end">
                  <Button className="h-10 w-full" onClick={onAuthorizeAdminStudent} disabled={busyKey === "security-authorize"}>
                    {busyKey === "security-authorize" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
                    Autorizar acesso
                  </Button>
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-border/60 bg-background/80 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground">Áreas permitidas</p>
                  {accessForm.role === "SUPER_ADMIN" && <Badge variant="outline">Todas as áreas incluídas</Badge>}
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {adminPermissions.map((permission) => (
                  <label
                    key={permission.value}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${
                      selectedPermissions.includes(permission.value)
                        ? "border-primary/30 bg-primary/5 text-foreground"
                        : "border-border/60 bg-background text-muted-foreground"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedPermissions.includes(permission.value)}
                      disabled={accessForm.role === "SUPER_ADMIN"}
                      onChange={(event) => updatePermission(permission.value, event.target.checked)}
                    />
                    {selectedPermissions.includes(permission.value) && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                    {permission.label}
                  </label>
                ))}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {authorizedAdminStudents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                  Ainda não existem estudantes autorizados para a área administrativa.
                </div>
              ) : (
                authorizedAdminStudents.map((student) => (
                  <div key={student.id} className="flex flex-col gap-3 rounded-xl border border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold">{student.studentNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {student.team} · {student.role === "SUPER_ADMIN" ? "Super admin" : student.role === "TEAM_LEAD" ? "Líder" : "Membro"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Áreas: {student.permissions === "ALL" ? "Todas" : student.permissions.split(",").join(", ")}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">Autorizado em {formatDateLabel(student.createdAt)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <ContextualSmsAction
                        title="Avisar acesso administrativo"
                        buttonLabel="Avisar"
                        recipient={{ studentNumber: student.studentNumber, name: `Estudante ${student.studentNumber}` }}
                        defaultMessage={`Olá {{nome}}, o teu acesso administrativo ao UOR Connect foi configurado para a equipa ${student.team}. Entra no painel para gerir as tuas áreas.`}
                      />
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => onRevokeAdminStudent(student.studentNumber)}
                        disabled={busyKey === `security-revoke-${student.studentNumber}`}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Remover acesso
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" />
              Logins recentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentLogins.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                Ainda não existem logins recentes registados.
              </div>
            ) : (
              recentLogins.map((student) => {
                const whatsappUrl = whatsappLink(student.phone);
                return (
                  <div key={student.id} className="rounded-xl border border-border/70 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">{student.name || `Estudante ${student.studentNumber}`}</p>
                        <p className="text-xs text-muted-foreground">Nº {student.studentNumber} · {student.course || "Curso não informado"}</p>
                        <p className="text-xs text-muted-foreground">{student.email || "Sem email"}</p>
                        <p className="text-xs text-muted-foreground">{student.phone || "Sem contacto telefónico"}</p>
                        <p className="text-xs text-muted-foreground">
                          Último login: {student.lastLoginAt ? formatDateLabel(student.lastLoginAt) : "Sem data registada"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <ContextualSmsAction
                          title="Enviar comunicação ao estudante"
                          recipient={{
                            name: student.name,
                            studentNumber: student.studentNumber,
                            phone: student.phone,
                            course: student.course,
                          }}
                          defaultMessage="Olá {{nome}}, temos uma atualização importante sobre o teu acesso ao UOR Connect. Consulta o painel assim que possível."
                        />
                        {whatsappUrl && (
                          <Button size="sm" className="bg-[#25D366] text-white hover:bg-[#1fb85a]" asChild>
                            <a href={whatsappUrl} target="_blank" rel="noreferrer noopener">
                              <MessageSquare className="mr-1 h-3.5 w-3.5" />
                              Puxar no WhatsApp
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
