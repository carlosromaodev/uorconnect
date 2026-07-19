import { type FormEvent, useEffect, useState } from "react";
import { Award, Ban, Download, Eye, Loader2, MessageCircle, RefreshCw, Search, Send, ShieldCheck } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { api, type CertificateItem, type CertificateTemplate, type Course, type PagedResult } from "@/lib/api";
import { downloadBlobFile } from "@/lib/student-documents";
import { AdminTablePagination } from "@/components/admin/AdminTablePagination";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function certificateStatusLabel(status: string) {
  if (status === "ISSUED") return "Emitido";
  if (status === "REVOKED") return "Revogado";
  if (status === "REISSUED") return "Reemitido";
  return status;
}

function parseStudentNumbers(value: string) {
  return Array.from(new Set(value.split(/[\s,;]+/).map((item) => item.replace(/\D/g, "").trim()).filter(Boolean)));
}

function buildCertificateSmsMessage(certificate: CertificateItem) {
  const recipientName = certificate.recipientName || "estudante";
  return `Olá ${recipientName}, o teu certificado "${certificate.title}" já está disponível no UOR Connect. Valida e baixa aqui: ${certificate.validationUrl}`;
}

export default function AdminCertificatesTab() {
  const [certificates, setCertificates] = useState<PagedResult<CertificateItem> | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [bulkIssuing, setBulkIssuing] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [reissuingId, setReissuingId] = useState<number | null>(null);
  const [studentNumber, setStudentNumber] = useState("");
  const [notifyStudentBySms, setNotifyStudentBySms] = useState(true);
  const [notifyStudentByWhatsApp, setNotifyStudentByWhatsApp] = useState(false);
  const [title, setTitle] = useState("Certificado de Participação");
  const [type, setType] = useState("PARTICIPATION");
  const [organizerName, setOrganizerName] = useState("Faculdade de Ciências e Tecnologias");
  const [rectorTitle, setRectorTitle] = useState("O Decano");
  const [rectorName, setRectorName] = useState("Prof. Doutor Diosnorides Carbonell Torreblanca");
  const [authorityTitle, setAuthorityTitle] = useState("Vice-Reitor para os Assuntos Científicos e de Pós-Graduação");
  const [authorityName, setAuthorityName] = useState("Prof. Doutor Eugénio de Carvalho");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("todos");
  const [typeFilter, setTypeFilter] = useState("");
  const [bulkMode, setBulkMode] = useState<"ATTENDANCE" | "STUDENT_LIST" | "STUDENT_COURSE" | "COURSE_ENROLLMENT" | "PROJECT" | "ALL_PROJECTS">("ATTENDANCE");
  const [bulkStudentNumbers, setBulkStudentNumbers] = useState("");
  const [bulkStudentCourse, setBulkStudentCourse] = useState("");
  const [bulkCourseId, setBulkCourseId] = useState("");
  const [bulkSubmissionId, setBulkSubmissionId] = useState("");
  const [bulkEventKey, setBulkEventKey] = useState("main-event");
  const [bulkProjectRank, setBulkProjectRank] = useState("");

  const load = async (nextPage = page, nextSearch = search, nextStatus = statusFilter, nextType = typeFilter) => {
    setLoading(true);
    try {
      const payload = await api.certificates.list({
        page: nextPage,
        search: nextSearch || undefined,
        status: nextStatus === "todos" ? undefined : nextStatus,
        type: nextType.trim() || undefined,
      });
      setCertificates(payload);
      setPage(payload.page);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao carregar certificados.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    Promise.all([api.courses.list(true), api.certificates.templates()])
      .then(([coursesPayload, templatesPayload]) => {
        setCourses(coursesPayload.courses);
        setTemplates(templatesPayload.templates);
      })
      .catch(() => {
        setCourses([]);
        setTemplates([]);
      });
  }, []);

  const applyTemplate = (templateType: string) => {
    const template = templates.find((item) => item.type === templateType);
    if (!template) return;
    setType(template.type);
    setTitle(template.title);
  };

  const buildCertificateMetadata = () => ({
    organizerName: organizerName.trim(),
    rectorTitle: rectorTitle.trim(),
    rectorName: rectorName.trim(),
    authorityTitle: authorityTitle.trim(),
    authorityName: authorityName.trim(),
  });

  const handleIssue = async () => {
    if (!studentNumber.trim()) {
      toast.error("Informa o número de estudante.");
      return;
    }

    setIssuing(true);
    try {
      const normalizedStudentNumber = studentNumber.replace(/\D/g, "").trim();
      const certificate = await api.certificates.issue({
        studentNumber: normalizedStudentNumber,
        title,
        type,
        metadata: buildCertificateMetadata(),
      });

      if (notifyStudentBySms || notifyStudentByWhatsApp) {
        const deliveryResults: string[] = [];
        try {
          const audience = {
            type: "SELECTED_STUDENTS" as const,
            selectedStudentNumbers: [certificate.recipientNumber ?? normalizedStudentNumber],
          };
          if (notifyStudentBySms) {
            const result = await api.sms.sendCampaign({
              title: `Certificado emitido - ${certificate.recipientNumber ?? normalizedStudentNumber}`,
              sender: "UOR CONNECT",
              message: buildCertificateSmsMessage(certificate),
              audience,
            });
            deliveryResults.push(`SMS ${result.successCount}/${result.totalRecipients}`);
          }
          if (notifyStudentByWhatsApp) {
            const result = await api.whatsapp.sendCampaign({
              title: `Certificado emitido - ${certificate.recipientNumber ?? normalizedStudentNumber}`,
              message: buildCertificateSmsMessage(certificate),
              audience,
            });
            deliveryResults.push(`WhatsApp ${result.successCount}/${result.totalRecipients}`);
          }
          toast.success(`Certificado emitido e aviso enviado: ${deliveryResults.join(" · ")}.`);
        } catch (deliveryError) {
          toast.warning(deliveryError instanceof Error
            ? `Certificado emitido, mas o aviso falhou: ${deliveryError.message}`
            : "Certificado emitido, mas não foi possível enviar o aviso.");
        }
      } else {
        toast.success("Certificado emitido.");
      }

      setStudentNumber("");
      await load(1, search.trim(), statusFilter, typeFilter);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao emitir certificado.");
    } finally {
      setIssuing(false);
    }
  };

  const handleBulkIssue = async () => {
    setBulkIssuing(true);
    try {
      const result = bulkMode === "ATTENDANCE"
        ? await api.certificates.issueAttendees({
          title,
          type: type || "EVENT_PARTICIPATION",
          eventKey: bulkEventKey || "main-event",
          metadata: buildCertificateMetadata(),
        })
        : await api.certificates.issueBulk({
          mode: bulkMode as "STUDENT_LIST" | "STUDENT_COURSE" | "COURSE_ENROLLMENT" | "PROJECT" | "ALL_PROJECTS",
          title,
          type,
          studentNumbers: bulkMode === "STUDENT_LIST" ? parseStudentNumbers(bulkStudentNumbers) : undefined,
          studentCourse: bulkMode === "STUDENT_COURSE" ? bulkStudentCourse.trim() : undefined,
          courseId: bulkMode === "COURSE_ENROLLMENT" && bulkCourseId ? Number(bulkCourseId) : undefined,
          submissionId: bulkMode === "PROJECT" && bulkSubmissionId ? Number(bulkSubmissionId) : undefined,
          projectRank: (bulkMode === "PROJECT" || bulkMode === "ALL_PROJECTS") && bulkProjectRank.trim() ? bulkProjectRank.trim() : undefined,
          metadata: buildCertificateMetadata(),
        });
      toast.success(`${result.issued} certificado(s) emitido(s). ${result.skipped} já existiam.`);
      await load(1, search.trim(), statusFilter, typeFilter);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao emitir certificados em lote.");
    } finally {
      setBulkIssuing(false);
    }
  };

  const handleDownload = async (certificate: CertificateItem) => {
    setDownloadingId(certificate.id);
    try {
      const blob = await api.certificates.pdf(certificate.id);
      downloadBlobFile(blob, `${certificate.code.toLowerCase()}.pdf`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao baixar PDF.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleRevoke = async (certificate: CertificateItem) => {
    const reason = window.prompt("Motivo da revogação", certificate.revokedReason ?? "");
    if (reason === null) return;
    setRevokingId(certificate.id);
    try {
      await api.certificates.revoke(certificate.id, reason.trim() || "Revogado administrativamente.");
      toast.success("Certificado revogado.");
      await load(page, search.trim(), statusFilter, typeFilter);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao revogar certificado.");
    } finally {
      setRevokingId(null);
    }
  };

  const handleReissue = async (certificate: CertificateItem) => {
    setReissuingId(certificate.id);
    try {
      const result = await api.certificates.reissue(certificate.id);
      toast.success(`Certificado reemitido: ${result.next.code}.`);
      await load(page, search.trim(), statusFilter, typeFilter);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao reemitir certificado.");
    } finally {
      setReissuingId(null);
    }
  };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void load(1, search.trim(), statusFilter, typeFilter);
  };

  const handlePageChange = (nextPage: number) => {
    void load(nextPage, search.trim(), statusFilter, typeFilter);
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Award className="h-5 w-5 text-primary" />
              Emitir certificado individual
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-3 md:grid-cols-4">
              <Input value={studentNumber} onChange={(event) => setStudentNumber(event.target.value)} placeholder="Número estudante" />
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={type}
                onChange={(event) => applyTemplate(event.target.value)}
              >
                {templates.length === 0 ? <option value={type}>{type}</option> : null}
                {templates.map((template) => (
                  <option key={template.key} value={template.type}>{template.title}</option>
                ))}
              </select>
              <Input value={type} onChange={(event) => setType(event.target.value.toUpperCase())} placeholder="Tipo" />
              <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título do certificado" />
            </div>
            <div className="rounded-[16px] border border-border/70 bg-muted/20 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Eye className="h-4 w-4 text-primary" />
                Pré-visualização
              </div>
              <p className="text-base font-bold">{title || "Certificado de Participação"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Destinatário: {studentNumber.trim() ? `Estudante ${studentNumber.trim()}` : "número ainda não informado"}
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">Tipo: {type || "PARTICIPATION"}</p>
            </div>
            <div className="rounded-[16px] border border-border/70 bg-background p-4">
              <p className="mb-3 text-sm font-semibold">Entidades e assinaturas do certificado</p>
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  value={organizerName}
                  onChange={(event) => setOrganizerName(event.target.value)}
                  placeholder="Entidade organizadora"
                  aria-label="Entidade organizadora"
                />
                <Input
                  value={rectorTitle}
                  onChange={(event) => setRectorTitle(event.target.value)}
                  placeholder="Título do Reitor"
                  aria-label="Título do Reitor"
                />
                <Input
                  value={rectorName}
                  onChange={(event) => setRectorName(event.target.value)}
                  placeholder="Nome do Reitor"
                  aria-label="Nome do Reitor"
                />
                <Input
                  value={authorityTitle}
                  onChange={(event) => setAuthorityTitle(event.target.value)}
                  placeholder="Título da autoridade direita"
                  aria-label="Título da autoridade direita"
                />
                <Input
                  value={authorityName}
                  onChange={(event) => setAuthorityName(event.target.value)}
                  placeholder="Nome da autoridade direita"
                  aria-label="Nome da autoridade direita"
                  className="md:col-span-2"
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                Estes campos alteram apenas o certificado que está a ser emitido, sem mudar o design visual do PDF.
              </p>
            </div>
            <div className="flex flex-col gap-3 rounded-[16px] border border-border/70 bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">Enviar link por SMS</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Depois da emissão, o estudante recebe uma mensagem com o link público de validação e download.
                </p>
              </div>
              <Switch checked={notifyStudentBySms} onCheckedChange={setNotifyStudentBySms} />
            </div>
            <div className="flex flex-col gap-3 rounded-[16px] border border-emerald-500/20 bg-emerald-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <MessageCircle className="h-4 w-4 text-emerald-700" />
                  Enviar link por WhatsApp
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Usa a instância padrão da Evolution API para enviar a mesma validação.
                </p>
              </div>
              <Switch checked={notifyStudentByWhatsApp} onCheckedChange={setNotifyStudentByWhatsApp} />
            </div>
            <Button className="w-fit rounded-xl" onClick={() => void handleIssue()} disabled={issuing}>
              {issuing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Emitir certificado
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Emissão em lote
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm leading-6 text-muted-foreground">
              Gera certificados para presenças, lista de estudantes, curso académico, inscritos num curso do portal ou todos os membros de um projeto.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={bulkMode}
                onChange={(event) => setBulkMode(event.target.value as typeof bulkMode)}
              >
                <option value="ATTENDANCE">Presenças do evento</option>
                <option value="STUDENT_LIST">Lista de estudantes</option>
                <option value="STUDENT_COURSE">Curso académico</option>
                <option value="COURSE_ENROLLMENT">Inscritos em curso do portal</option>
                <option value="PROJECT">Projeto — membros de um projeto específico</option>
                <option value="ALL_PROJECTS">Todos os projetos — todos os expositores confirmados</option>
              </select>
              {bulkMode === "ATTENDANCE" ? (
                <Input value={bulkEventKey} onChange={(event) => setBulkEventKey(event.target.value)} placeholder="Código do evento" />
              ) : null}
              {bulkMode === "STUDENT_COURSE" ? (
                <Input value={bulkStudentCourse} onChange={(event) => setBulkStudentCourse(event.target.value)} placeholder="Ex.: Engenharia Informática" />
              ) : null}
              {bulkMode === "COURSE_ENROLLMENT" ? (
                <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={bulkCourseId} onChange={(event) => setBulkCourseId(event.target.value)}>
                  <option value="">Selecionar curso</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>{course.name}</option>
                  ))}
                </select>
              ) : null}
              {bulkMode === "PROJECT" ? (
                <Input
                  value={bulkSubmissionId}
                  onChange={(event) => setBulkSubmissionId(event.target.value.replace(/\D/g, ""))}
                  placeholder="ID do projeto (número)"
                />
              ) : null}
            </div>
            {bulkMode === "STUDENT_LIST" ? (
              <Textarea
                value={bulkStudentNumbers}
                onChange={(event) => setBulkStudentNumbers(event.target.value)}
                placeholder="Cole números separados por linha, espaço ou vírgula"
                className="min-h-[96px]"
              />
            ) : null}
            {bulkMode === "PROJECT" ? (
              <div className="rounded-[14px] border border-primary/20 bg-primary/5 p-4 space-y-3">
                <p className="text-sm font-semibold text-primary">Certificados de projeto em lote</p>
                <p className="text-xs leading-5 text-muted-foreground">
                  Serão emitidos certificados personalizados para <strong>todos os membros confirmados</strong> do projeto,
                  incluindo o líder. O texto do certificado incluirá automaticamente:
                </p>
                <ul className="text-xs leading-6 text-muted-foreground list-disc pl-4">
                  <li>O <strong>nome do projeto</strong></li>
                  <li>A <strong>posição no ranking geral</strong> (calculada automaticamente a partir das pontuações ao vivo)</li>
                  <li>O <strong>papel de cada membro</strong> — líder ou membro da equipa — com texto diferenciado</li>
                </ul>
                <div className="pt-1">
                  <label className="mb-1.5 block text-xs font-medium text-foreground">
                    Posição no ranking <span className="text-muted-foreground">(opcional — deixa em branco para calcular automaticamente)</span>
                  </label>
                  <Input
                    value={bulkProjectRank}
                    onChange={(event) => setBulkProjectRank(event.target.value)}
                    placeholder="Ex.: 1.º Lugar, 2.º Lugar, 5.º Lugar…"
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Se deixares em branco, o sistema consulta o ranking atual de pontuações e calcula a posição automaticamente.
                  </p>
                </div>
              </div>
            ) : null}
            {bulkMode === "ALL_PROJECTS" ? (
              <div className="rounded-[14px] border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
                <p className="text-sm font-semibold text-emerald-700">Todos os expositores — emissão automática global</p>
                <p className="text-xs leading-5 text-muted-foreground">
                  O sistema vai percorrer <strong>todos os projetos com presença confirmada</strong> e emitir certificados
                  automaticamente para o líder e todos os membros confirmados de cada projeto, sem necessidade de indicar um ID.
                </p>
                <ul className="text-xs leading-6 text-muted-foreground list-disc pl-4">
                  <li>Apenas projetos com <strong>pagamento confirmado</strong> são incluídos</li>
                  <li>Cada membro só recebe um certificado por projeto (duplicados são ignorados)</li>
                  <li>A posição no ranking é calculada automaticamente via pontuações ao vivo</li>
                </ul>
                <div className="pt-1">
                  <label className="mb-1.5 block text-xs font-medium text-foreground">
                    Posição no ranking <span className="text-muted-foreground">(opcional — aplica-se a todos os projetos se preenchido)</span>
                  </label>
                  <Input
                    value={bulkProjectRank}
                    onChange={(event) => setBulkProjectRank(event.target.value)}
                    placeholder="Deixa em branco para calcular automaticamente por projeto"
                  />
                </div>
              </div>
            ) : null}
            <Button className="mt-4 rounded-xl" variant="outline" onClick={() => void handleBulkIssue()} disabled={bulkIssuing}>
              {bulkIssuing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Award className="mr-2 h-4 w-4" />}
              Emitir em lote
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="text-base">Certificados emitidos</CardTitle>
            <form className="flex flex-col gap-2 sm:flex-row" onSubmit={handleSearch}>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar certificado..." />
              </div>
              <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="todos">Todos estados</option>
                <option value="ISSUED">Emitidos</option>
                <option value="REVOKED">Revogados</option>
              </select>
              <Input className="sm:w-40" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value.toUpperCase())} placeholder="Tipo" />
              <Button variant="outline" className="rounded-xl" type="submit" disabled={loading}>
                <Search className="mr-2 h-4 w-4" />
                Pesquisar
              </Button>
              <Button variant="outline" className="rounded-xl" type="button" onClick={() => void load(page, search.trim(), statusFilter, typeFilter)} disabled={loading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </form>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Certificado</TableHead>
                  <TableHead>Destinatário</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Emitido</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5}>A carregar certificados...</TableCell></TableRow>
                ) : certificates?.items.length ? (
                  certificates.items.map((certificate) => (
                    <TableRow key={certificate.id}>
                      <TableCell>
                        <p className="font-semibold">{certificate.title}</p>
                        <p className="font-mono text-xs text-muted-foreground">{certificate.code}</p>
                        <p className="text-xs text-muted-foreground">Versão {certificate.version}</p>
                      </TableCell>
                      <TableCell>
                        <p className="font-semibold">{certificate.recipientName}</p>
                        <p className="text-xs text-muted-foreground">{certificate.recipientNumber || "Sem número"}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={certificate.status === "REVOKED" ? "outline" : "secondary"}>
                          {certificateStatusLabel(certificate.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(certificate.issuedAt)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => void handleDownload(certificate)} disabled={downloadingId === certificate.id}>
                            {downloadingId === certificate.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />}
                            PDF
                          </Button>
                          <Button asChild size="sm" variant="outline">
                            <a href={certificate.validationUrl} target="_blank" rel="noreferrer">Validar</a>
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => void handleReissue(certificate)} disabled={reissuingId === certificate.id}>
                            {reissuingId === certificate.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
                            Reemitir
                          </Button>
                          {certificate.status !== "REVOKED" ? (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="outline" disabled={revokingId === certificate.id}>
                                  {revokingId === certificate.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Ban className="mr-1 h-3.5 w-3.5" />}
                                  Revogar
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Revogar certificado?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    O certificado {certificate.code} deixará de aparecer como válido na página pública de validação.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => void handleRevoke(certificate)}>
                                    Revogar certificado
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={5}>Sem certificados emitidos para estes filtros.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {certificates ? (
            <AdminTablePagination
              page={certificates.page}
              total={certificates.total}
              totalPages={certificates.totalPages}
              loading={loading}
              onPageChange={handlePageChange}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
