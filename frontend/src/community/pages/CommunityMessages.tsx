import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, FolderOpen, GraduationCap, Loader2, MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/social/UserAvatar";
import { api, getToken, type CommunityChatMessage, type CommunityChatThread } from "@/lib/api";
import { timeAgo } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";
import { Link } from "react-router-dom";
import { useCommunityBase } from "@/community/components/CommunityShell";

function ThreadList({ threads, onSelect }: { threads: CommunityChatThread[]; onSelect: (t: CommunityChatThread) => void }) {
  if (!threads.length) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 bg-white p-8 text-center">
        <MessageCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground/20" />
        <p className="text-sm font-medium text-muted-foreground">Nenhuma conversa activa.</p>
        <p className="mt-1 text-xs text-muted-foreground/60">As conversas de projetos e cursos aparecerão aqui.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {threads.map((thread) => (
        <motion.button
          key={thread.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => onSelect(thread)}
          className="flex w-full items-center gap-3 rounded-xl border border-border/50 bg-white p-3.5 text-left shadow-sm transition-all hover:border-primary/20 hover:shadow-md"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/8">
            {thread.contextType === "PROJECT" ? (
              <FolderOpen className="h-5 w-5 text-primary" />
            ) : (
              <GraduationCap className="h-5 w-5 text-primary" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-bold">{thread.title || `${thread.contextType === "PROJECT" ? "Projeto" : "Curso"} #${thread.contextId}`}</span>
              {thread.lastMessageAt && (
                <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(thread.lastMessageAt)}</span>
              )}
            </div>
            {thread.lastMessage && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{thread.lastMessage}</p>
            )}
          </div>
          {thread.messageCount > 0 && (
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 px-1.5 text-[10px] font-bold text-primary">
              {thread.messageCount}
            </span>
          )}
        </motion.button>
      ))}
    </div>
  );
}

function ThreadChat({ thread, onBack }: { thread: CommunityChatThread; onBack: () => void }) {
  const [messages, setMessages] = useState<CommunityChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.community.threadMessages(thread.id)
      .then(setMessages)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [thread.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      const msg = await api.community.sendThreadMessage(thread.id, input.trim());
      setMessages((prev) => [...prev, msg]);
      setInput("");
    } catch {
      toast.error("Erro ao enviar mensagem.");
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex h-[calc(100vh-10rem)] flex-col"
    >
      {/* Thread header */}
      <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-white p-3 shadow-sm">
        <button onClick={onBack} className="shrink-0 rounded-lg p-1.5 transition-colors hover:bg-muted">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/8">
          {thread.contextType === "PROJECT" ? (
            <FolderOpen className="h-4 w-4 text-primary" />
          ) : (
            <GraduationCap className="h-4 w-4 text-primary" />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{thread.title || `${thread.contextType === "PROJECT" ? "Projeto" : "Curso"} #${thread.contextId}`}</p>
          <p className="text-[10px] text-muted-foreground">{thread.messageCount} mensagens</p>
        </div>
      </div>

      {/* Messages */}
      <div className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-primary/40" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageCircle className="mb-2 h-8 w-8 text-muted-foreground/20" />
            <p className="text-xs text-muted-foreground">Nenhuma mensagem ainda. Inicia a conversa!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-2 rounded-lg px-2 py-1.5"
            >
              <UserAvatar name={msg.author.name} size="sm" className="mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-bold">{msg.author.name}</span>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(msg.createdAt)}</span>
                </div>
                <p className="text-[13px] leading-snug text-foreground/85">{msg.content}</p>
              </div>
            </motion.div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {getToken() && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-border/50 bg-white p-1.5 shadow-sm">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && input.trim()) void handleSend(); }}
            placeholder="Escreve uma mensagem..."
            className="h-9 min-w-0 flex-1 bg-transparent px-2.5 text-sm outline-none"
          />
          <Button size="sm" className="h-9 w-9 rounded-lg p-0" disabled={!input.trim() || sending} onClick={handleSend}>
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </motion.div>
  );
}

export default function CommunityMessages() {
  const base = useCommunityBase();
  const [threads, setThreads] = useState<CommunityChatThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeThread, setActiveThread] = useState<CommunityChatThread | null>(null);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api.community.threads().then(setThreads).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (!getToken()) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 bg-white p-8 text-center">
        <MessageCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground/20" />
        <p className="text-sm text-muted-foreground">
          <Link to={`${base}/login?redirect=/mensagens`} className="font-semibold text-primary hover:underline">
            Inicia sessão
          </Link>{" "}
          para ver as conversas.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary/40" />
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {activeThread ? (
        <ThreadChat key="chat" thread={activeThread} onBack={() => setActiveThread(null)} />
      ) : (
        <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <h1 className="mb-4 text-lg font-bold">Mensagens</h1>
          <ThreadList threads={threads} onSelect={setActiveThread} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
