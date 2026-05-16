import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import {
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  FileImage,
  Loader2,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { ContextualSmsAction } from "@/components/admin/ContextualSmsAction";
import { api, type TeamMembership } from "@/lib/api";
import { readCompressedImageFileAsDataUrl } from "@/lib/project-media";
import {
  useTaskStore,
  type Task,
  type TaskAttachment,
  type TaskInput,
  type TaskPriority,
  type TaskStatus,
} from "./use-task-store";

/* ── Constants ── */

const STATUS_META: Record<TaskStatus, { label: string; color: string; accent: string }> = {
  todo: { label: "A Fazer", color: "bg-slate-100 text-slate-700", accent: "border-t-slate-400" },
  in_progress: { label: "Em Progresso", color: "bg-blue-50 text-blue-700", accent: "border-t-blue-500" },
  in_review: { label: "Em Revisão", color: "bg-amber-50 text-amber-700", accent: "border-t-amber-500" },
  done: { label: "Concluído", color: "bg-emerald-50 text-emerald-700", accent: "border-t-emerald-500" },
};

const PRIORITY_META: Record<TaskPriority, { label: string; border: string; badge: string }> = {
  low: { label: "Baixa", border: "border-l-slate-300", badge: "bg-slate-100 text-slate-600" },
  medium: { label: "Média", border: "border-l-blue-400", badge: "bg-blue-50 text-blue-700" },
  high: { label: "Alta", border: "border-l-amber-500", badge: "bg-amber-50 text-amber-700" },
  urgent: { label: "Urgente", border: "border-l-red-500", badge: "bg-red-50 text-red-700" },
};

const STATUSES: TaskStatus[] = ["todo", "in_progress", "in_review", "done"];

const CATEGORY_SUGGESTIONS = ["Design", "Marketing", "Logística", "Protocolo", "Relações Externas", "Relações Internas", "Comunicação", "Académico", "Evento", "Geral"];

function initials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function dueDateLabel(dueDate: string | null) {
  if (!dueDate) return null;
  try {
    return format(new Date(dueDate), "d MMM", { locale: pt });
  } catch {
    return null;
  }
}

function isOverdue(dueDate: string | null) {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date(new Date().toDateString());
}

/* ── TaskCard ── */

function TaskCard({
  task,
  onOpen,
  onMove,
  onDelete,
}: {
  task: Task;
  onOpen: () => void;
  onMove: (status: TaskStatus) => void;
  onDelete: () => void;
}) {
  const priority = PRIORITY_META[task.priority];
  const overdue = task.status !== "done" && isOverdue(task.dueDate);
  const dateStr = dueDateLabel(task.dueDate);

  return (
    <div
      onClick={onOpen}
      className={`group cursor-pointer rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm transition-shadow hover:shadow-md border-l-[3px] ${priority.border}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-[13px] font-semibold leading-snug text-slate-800 line-clamp-2">{task.title}</h4>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 rounded-md p-1 text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44" onClick={(e) => e.stopPropagation()}>
            {STATUSES.filter((s) => s !== task.status).map((s) => (
              <DropdownMenuItem key={s} onClick={() => onMove(s)}>
                <ChevronRight className="mr-2 h-3.5 w-3.5" />
                {STATUS_META[s].label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={onDelete}>
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {task.description && (
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500 line-clamp-2">{task.description}</p>
      )}

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${priority.badge}`}>
          {priority.label}
        </span>
        {task.category && (
          <span className="inline-flex rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
            {task.category}
          </span>
        )}
        {task.attachments.length > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400">
            <Paperclip className="h-2.5 w-2.5" />
            {task.attachments.length}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        {task.assigneeName ? (
          <div className="flex items-center gap-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[8px] font-bold text-white">
              {initials(task.assigneeName)}
            </div>
            <span className="text-[11px] text-slate-500 truncate max-w-[100px]">{task.assigneeName.split(" ")[0]}</span>
          </div>
        ) : (
          <span className="text-[11px] text-slate-400">Sem atribuição</span>
        )}
        {dateStr && (
          <span className={`flex items-center gap-1 text-[10px] font-medium ${overdue ? "text-red-500" : "text-slate-400"}`}>
            <Clock className="h-2.5 w-2.5" />
            {dateStr}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── TaskColumn ── */

function TaskColumn({
  status,
  tasks,
  onOpenTask,
  onMoveTask,
  onDeleteTask,
}: {
  status: TaskStatus;
  tasks: Task[];
  onOpenTask: (task: Task) => void;
  onMoveTask: (id: string, status: TaskStatus) => void;
  onDeleteTask: (id: string) => void;
}) {
  const meta = STATUS_META[status];

  return (
    <div className={`flex flex-col rounded-xl border border-slate-200/80 bg-slate-50/50 border-t-[3px] ${meta.accent}`}>
      <div className="flex items-center justify-between px-3.5 py-3">
        <div className="flex items-center gap-2">
          <span className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold ${meta.color}`}>{meta.label}</span>
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-200/80 px-1 text-[10px] font-bold text-slate-500">
            {tasks.length}
          </span>
        </div>
      </div>
      <ScrollArea className="flex-1 px-2.5 pb-2.5" style={{ maxHeight: "calc(100vh - 260px)" }}>
        <div className="space-y-2.5">
          {tasks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 py-8 text-center">
              <p className="text-xs text-slate-400">Nenhuma tarefa</p>
            </div>
          ) : (
            tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onOpen={() => onOpenTask(task)}
                onMove={(s) => onMoveTask(task.id, s)}
                onDelete={() => onDeleteTask(task.id)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

/* ── CreateTaskDialog ── */

function CreateTaskDialog({
  open,
  onOpenChange,
  members,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: TeamMembership[];
  onSubmit: (input: TaskInput) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [category, setCategory] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const reset = () => {
    setTitle("");
    setDescription("");
    setPriority("medium");
    setCategory("");
    setAssigneeId("");
    setDueDate(undefined);
    setAttachments([]);
  };

  const selectedMember = members.find((m) => String(m.id) === assigneeId);

  const handleFileAdd = async (file: File) => {
    if (attachments.length >= 3) {
      toast.warning("Máximo de 3 anexos por tarefa.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Apenas imagens são suportadas.");
      return;
    }
    try {
      const dataUrl = await readCompressedImageFileAsDataUrl(file, { maxLength: 400_000, maxDimension: 600 });
      setAttachments((prev) => [...prev, {
        id: crypto.randomUUID(),
        name: file.name,
        dataUrl,
        addedAt: new Date().toISOString(),
      }]);
    } catch {
      toast.error("Não foi possível processar a imagem.");
    }
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      toast.warning("O título é obrigatório.");
      return;
    }
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      priority,
      category: category.trim(),
      assigneeId: selectedMember ? selectedMember.id : null,
      assigneeName: selectedMember ? selectedMember.fullName : null,
      assigneePhone: selectedMember?.studentNumber ?? null,
      dueDate: dueDate ? dueDate.toISOString() : null,
      attachments,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto rounded-xl p-0">
        <DialogHeader className="border-b border-slate-100 px-5 pt-5 pb-4">
          <DialogTitle className="text-[15px]">Nova tarefa</DialogTitle>
          <DialogDescription className="text-xs">Cria uma tarefa e atribui a um membro do núcleo.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4">
          {/* Title */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700">Título *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Preparar cartazes do evento"
              className="h-9 rounded-lg text-sm"
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700">Descrição</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes, requisitos ou observações..."
              rows={3}
              className="resize-none rounded-lg text-sm"
            />
          </div>

          {/* Priority + Category row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">Prioridade</label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger className="h-9 rounded-lg text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(PRIORITY_META) as [TaskPriority, typeof PRIORITY_META.low][]).map(([key, meta]) => (
                    <SelectItem key={key} value={key}>{meta.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">Categoria</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-9 rounded-lg text-sm">
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_SUGGESTIONS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Assignee */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700">Atribuir a</label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger className="h-9 rounded-lg text-sm">
                <SelectValue placeholder="Selecionar membro..." />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>
                    <span className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[8px] font-bold text-white">{initials(m.fullName)}</span>
                      {m.fullName}
                      <span className="text-[10px] text-slate-400">{m.team}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Due date */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700">Data limite</label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-9 w-full justify-start rounded-lg text-sm font-normal">
                  <CalendarDays className="mr-2 h-3.5 w-3.5 text-slate-400" />
                  {dueDate ? format(dueDate, "d 'de' MMMM, yyyy", { locale: pt }) : "Sem data limite"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={(d) => { setDueDate(d ?? undefined); setCalendarOpen(false); }}
                  locale={pt}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Attachments */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700">Anexos ({attachments.length}/3)</label>
            {attachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {attachments.map((att) => (
                  <div key={att.id} className="group relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                    <img src={att.dataUrl} alt={att.name} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                      className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X className="h-4 w-4 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {attachments.length < 3 && (
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50">
                <FileImage className="h-3.5 w-3.5" />
                Adicionar imagem
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => { if (e.target.files?.[0]) void handleFileAdd(e.target.files[0]); e.target.value = ""; }} />
              </label>
            )}
          </div>
        </div>

        <DialogFooter className="border-t border-slate-100 px-5 py-3">
          <Button variant="outline" className="rounded-lg" onClick={() => { reset(); onOpenChange(false); }}>Cancelar</Button>
          <Button className="rounded-lg bg-slate-900 hover:bg-slate-800" onClick={handleSubmit}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Criar tarefa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── TaskDetailSheet ── */

function TaskDetailSheet({
  task,
  open,
  onOpenChange,
  members,
  onUpdate,
  onDelete,
  onMove,
}: {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: TeamMembership[];
  onUpdate: (id: string, changes: Partial<Task>) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, status: TaskStatus) => void;
}) {
  if (!task) return null;

  const priority = PRIORITY_META[task.priority];
  const statusMeta = STATUS_META[task.status];
  const overdue = task.status !== "done" && isOverdue(task.dueDate);

  const handleAssigneeChange = (val: string) => {
    const member = members.find((m) => String(m.id) === val);
    onUpdate(task.id, {
      assigneeId: member ? member.id : null,
      assigneeName: member ? member.fullName : null,
      assigneePhone: member?.studentNumber ?? null,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-b border-slate-100 px-5 pt-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-[15px] leading-snug">{task.title}</SheetTitle>
              <SheetDescription className="mt-1 text-xs">
                Criada em {format(new Date(task.createdAt), "d MMM yyyy, HH:mm", { locale: pt })}
                {task.createdBy ? ` por ${task.createdBy}` : ""}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-5 px-5 py-5">
          {/* Status */}
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Estado</label>
            <Select value={task.status} onValueChange={(v) => onMove(task.id, v as TaskStatus)}>
              <SelectTrigger className="h-9 rounded-lg text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    <span className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${STATUS_META[s].accent.replace("border-t-", "bg-")}`} />
                      {STATUS_META[s].label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Prioridade</label>
            <Select value={task.priority} onValueChange={(v) => onUpdate(task.id, { priority: v as TaskPriority })}>
              <SelectTrigger className="h-9 rounded-lg text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(PRIORITY_META) as [TaskPriority, typeof PRIORITY_META.low][]).map(([key, meta]) => (
                  <SelectItem key={key} value={key}>{meta.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Assignee */}
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Atribuído a</label>
            <Select value={task.assigneeId ? String(task.assigneeId) : ""} onValueChange={handleAssigneeChange}>
              <SelectTrigger className="h-9 rounded-lg text-sm">
                <SelectValue placeholder="Sem atribuição" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>{m.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {task.assigneeName && task.assigneePhone && (
              <div className="mt-2">
                <ContextualSmsAction
                  buttonLabel="Notificar via SMS"
                  buttonVariant="outline"
                  title="Notificar sobre tarefa"
                  recipient={{ name: task.assigneeName, studentNumber: task.assigneePhone }}
                  defaultMessage={`Olá {{nome}}, foi-te atribuída a tarefa: "${task.title}".${task.dueDate ? ` Prazo: ${dueDateLabel(task.dueDate)}.` : ""} Verifica o painel admin.`}
                />
              </div>
            )}
          </div>

          {/* Due date */}
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Data limite</label>
            <div className="flex items-center gap-2">
              {task.dueDate ? (
                <span className={`text-sm font-medium ${overdue ? "text-red-500" : "text-slate-700"}`}>
                  {format(new Date(task.dueDate), "d 'de' MMMM, yyyy", { locale: pt })}
                  {overdue && <span className="ml-1.5 text-[10px]">(atrasada)</span>}
                </span>
              ) : (
                <span className="text-sm text-slate-400">Sem data limite</span>
              )}
            </div>
          </div>

          {/* Category */}
          {task.category && (
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Categoria</label>
              <Badge variant="secondary" className="rounded-md text-xs">{task.category}</Badge>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Descrição</label>
            {task.description ? (
              <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm leading-relaxed text-slate-600">{task.description}</p>
            ) : (
              <p className="text-sm text-slate-400">Sem descrição.</p>
            )}
          </div>

          {/* Attachments */}
          {task.attachments.length > 0 && (
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Anexos</label>
              <div className="grid grid-cols-3 gap-2">
                {task.attachments.map((att) => (
                  <div key={att.id} className="overflow-hidden rounded-lg border border-slate-200">
                    <img src={att.dataUrl} alt={att.name} className="aspect-square w-full object-cover" />
                    <p className="truncate px-1.5 py-1 text-[10px] text-slate-500">{att.name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="border-t border-slate-100 px-5 py-4">
          <Button
            variant="outline"
            size="sm"
            className="w-full rounded-lg border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={() => { onDelete(task.id); onOpenChange(false); }}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Eliminar tarefa
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ═══════════════════════════ MAIN COMPONENT ═══════════════════════════ */

export default function AdminTasksTab() {
  const { tasks, loading: loadingTasks, addTask, updateTask, deleteTask, moveTask } = useTaskStore();
  const [members, setMembers] = useState<TeamMembership[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailTask, setDetailTask] = useState<Task | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");

  // Load team members
  useEffect(() => {
    api.teamCredentials.teamMemberships()
      .then((overview) => setMembers(overview.members.filter((m) => m.status === "ACTIVE")))
      .catch(() => toast.error("Não foi possível carregar membros do núcleo."))
      .finally(() => setLoadingMembers(false));
  }, []);

  // Distinct categories from existing tasks
  const categories = useMemo(() => {
    const cats = new Set(tasks.map((t) => t.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [tasks]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    let result = tasks;
    const q = search.trim().toLowerCase();
    if (q) result = result.filter((t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
    if (filterAssignee !== "all") result = result.filter((t) => String(t.assigneeId) === filterAssignee);
    if (filterPriority !== "all") result = result.filter((t) => t.priority === filterPriority);
    if (filterCategory !== "all") result = result.filter((t) => t.category === filterCategory);
    return result;
  }, [tasks, search, filterAssignee, filterPriority, filterCategory]);

  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = { todo: [], in_progress: [], in_review: [], done: [] };
    for (const t of filteredTasks) grouped[t.status].push(t);
    return grouped;
  }, [filteredTasks]);

  const handleCreateTask = useCallback(async (input: TaskInput) => {
    try {
      const task = await addTask(input);
      toast.success(`Tarefa "${task.title}" criada.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar a tarefa.");
    }
  }, [addTask]);

  const handleDeleteTask = useCallback(async (id: string) => {
    try {
      await deleteTask(id);
      toast.success("Tarefa eliminada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível eliminar a tarefa.");
    }
  }, [deleteTask]);

  const handleUpdateTask = useCallback(async (id: string, changes: Partial<Task>) => {
    try {
      await updateTask(id, changes);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a tarefa.");
    }
  }, [updateTask]);

  const handleMoveTask = useCallback(async (id: string, status: TaskStatus) => {
    try {
      await moveTask(id, status);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível mover a tarefa.");
    }
  }, [moveTask]);

  const hasActiveFilters = search || filterAssignee !== "all" || filterPriority !== "all" || filterCategory !== "all";

  const clearFilters = () => {
    setSearch("");
    setFilterAssignee("all");
    setFilterPriority("all");
    setFilterCategory("all");
  };

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Quadro de Tarefas</h3>
          <p className="text-xs text-slate-500">
            {tasks.length} tarefa{tasks.length !== 1 ? "s" : ""} · {tasks.filter((t) => t.status !== "done").length} ativa{tasks.filter((t) => t.status !== "done").length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button className="h-9 rounded-lg bg-slate-900 text-sm hover:bg-slate-800" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Nova tarefa
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar tarefas..."
            className="h-8 w-48 rounded-lg border-slate-200 bg-white pl-8 text-xs"
          />
        </div>

        <Select value={filterAssignee} onValueChange={setFilterAssignee}>
          <SelectTrigger className="h-8 w-auto min-w-[130px] rounded-lg border-slate-200 bg-white text-xs">
            <SelectValue placeholder="Membro" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={String(m.id)}>{m.fullName}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="h-8 w-auto min-w-[110px] rounded-lg border-slate-200 bg-white text-xs">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {(Object.entries(PRIORITY_META) as [TaskPriority, typeof PRIORITY_META.low][]).map(([key, meta]) => (
              <SelectItem key={key} value={key}>{meta.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {categories.length > 0 && (
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="h-8 w-auto min-w-[110px] rounded-lg border-slate-200 bg-white text-xs">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs text-slate-500" onClick={clearFilters}>
            <X className="mr-1 h-3 w-3" />
            Limpar
          </Button>
        )}
      </div>

      {/* Board */}
      {loadingMembers || loadingTasks ? (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          A carregar tarefas e membros do núcleo...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {STATUSES.map((status) => (
            <TaskColumn
              key={status}
              status={status}
              tasks={tasksByStatus[status]}
              onOpenTask={setDetailTask}
              onMoveTask={(id, nextStatus) => void handleMoveTask(id, nextStatus)}
              onDeleteTask={handleDeleteTask}
            />
          ))}
        </div>
      )}

      {/* Create dialog */}
      <CreateTaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        members={members}
        onSubmit={handleCreateTask}
      />

      {/* Detail sheet */}
      <TaskDetailSheet
        task={detailTask}
        open={detailTask !== null}
        onOpenChange={(v) => { if (!v) setDetailTask(null); }}
        members={members}
        onUpdate={(id, changes) => void handleUpdateTask(id, changes)}
        onDelete={handleDeleteTask}
        onMove={(id, nextStatus) => void handleMoveTask(id, nextStatus)}
      />
    </div>
  );
}
