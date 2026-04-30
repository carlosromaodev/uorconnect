import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  MessageCircle,
  Send,
  ImagePlus,
  Loader2,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/social/UserAvatar";
import { api, getToken, type CommunityPost, type CommunityComment } from "@/lib/api";
import { timeAgo } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";
import { Link } from "react-router-dom";
import { useCommunityBase } from "@/community/components/CommunityShell";

function PostComposer({ onPost }: { onPost: (post: CommunityPost) => void }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    try {
      const post = await api.community.createPost(trimmed);
      onPost(post);
      setContent("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    } catch {
      toast.error("Não foi possível publicar. Tenta novamente.");
    } finally {
      setLoading(false);
    }
  };

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const base = useCommunityBase();

  if (!getToken()) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-white p-4 text-center">
        <p className="text-sm text-muted-foreground">
          <Link to={`${base}/login?redirect=/`} className="font-semibold text-primary hover:underline">
            Inicia sessão
          </Link>{" "}
          para publicar na comunidade.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/50 bg-white shadow-sm">
      <div className="p-3">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            autoResize();
          }}
          placeholder="O que estás a pensar?"
          rows={2}
          maxLength={500}
          className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
        />
      </div>
      <div className="flex items-center justify-between border-t border-border/30 bg-muted/20 px-3 py-2">
        <button type="button" className="flex items-center gap-1.5 text-xs text-muted-foreground/60 transition-colors hover:text-muted-foreground" disabled>
          <ImagePlus className="h-4 w-4" />
          <span className="hidden sm:inline">Foto</span>
        </button>
        <div className="flex items-center gap-2">
          {content.length > 0 && (
            <span className="text-[10px] tabular-nums text-muted-foreground/50">{content.length}/500</span>
          )}
          <Button
            size="sm"
            className="h-7 gap-1.5 rounded-lg px-3 text-xs font-semibold"
            disabled={!content.trim() || loading}
            onClick={handleSubmit}
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            Publicar
          </Button>
        </div>
      </div>
    </div>
  );
}

function PostComments({ postId }: { postId: number }) {
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.community.comments(postId).then(setComments).catch(() => {}).finally(() => setLoading(false));
  }, [postId]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      const comment = await api.community.addComment(postId, input.trim());
      setComments((prev) => [...prev, comment]);
      setInput("");
    } catch {
      toast.error("Erro ao comentar.");
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="border-t border-border/30 bg-muted/10 px-3.5 py-3">
        {loading ? (
          <div className="flex justify-center py-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/40" />
          </div>
        ) : (
          <div className="space-y-2">
            {comments.map((c) => (
              <div key={c.id} className="flex gap-2">
                <UserAvatar name={c.author.name} size="sm" className="mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <span className="text-xs font-bold">{c.author.name}</span>
                  <span className="ml-1.5 text-[10px] text-muted-foreground">{timeAgo(c.createdAt)}</span>
                  <p className="text-xs text-foreground/80">{c.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        {getToken() && (
          <div className="mt-2 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && input.trim()) void handleSend(); }}
              placeholder="Escreve um comentário..."
              className="h-8 min-w-0 flex-1 rounded-lg border border-border/50 bg-white px-2.5 text-xs outline-none focus:ring-1 focus:ring-primary/30"
            />
            <Button size="sm" className="h-8 w-8 rounded-lg p-0" disabled={!input.trim() || sending} onClick={handleSend}>
              <Send className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function PostCard({ post, onLikeUpdate }: { post: CommunityPost; onLikeUpdate: (id: number, liked: boolean, count: number) => void }) {
  const [showComments, setShowComments] = useState(false);
  const [liking, setLiking] = useState(false);

  const handleLike = async () => {
    if (liking || !getToken()) return;
    setLiking(true);
    try {
      const result = await api.community.likePost(post.id);
      onLikeUpdate(post.id, result.liked, result.likesCount);
    } catch {
      toast.error("Erro ao reagir.");
    } finally {
      setLiking(false);
    }
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-xl border border-border/50 bg-white shadow-sm"
    >
      {/* Author header */}
      <div className="flex items-center gap-2.5 px-3.5 pt-3.5">
        <UserAvatar name={post.author.name} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13px] font-bold">{post.author.name}</span>
            <span className="text-[10px] text-muted-foreground">{timeAgo(post.createdAt)}</span>
          </div>
          {post.author.course && (
            <span
              className="inline-flex rounded-md px-1.5 py-0.5 text-[9px] font-semibold leading-none"
              style={{
                backgroundColor: post.author.courseColor ? `${post.author.courseColor}18` : "rgba(100,116,139,0.1)",
                color: post.author.courseColor || "#64748b",
              }}
            >
              {post.author.course}
            </span>
          )}
        </div>
        <button className="shrink-0 p-1 text-muted-foreground/40 hover:text-muted-foreground">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="px-3.5 py-2.5">
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/90">{post.content}</p>
      </div>

      {/* Image */}
      {post.imageUrl && (
        <div className="px-3.5 pb-2">
          <img src={post.imageUrl} alt="" className="w-full rounded-lg object-cover" style={{ maxHeight: 300 }} />
        </div>
      )}

      {/* Stats row */}
      {(post.likesCount > 0 || post.commentsCount > 0) && (
        <div className="flex items-center gap-3 px-3.5 pb-1.5 text-[11px] text-muted-foreground">
          {post.likesCount > 0 && <span>{post.likesCount} {post.likesCount === 1 ? "gosto" : "gostos"}</span>}
          {post.commentsCount > 0 && (
            <button onClick={() => setShowComments(!showComments)} className="hover:underline">
              {post.commentsCount} {post.commentsCount === 1 ? "comentário" : "comentários"}
            </button>
          )}
        </div>
      )}

      {/* Action bar */}
      <div className="flex border-t border-border/30">
        <button
          onClick={handleLike}
          className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
            post.liked ? "text-red-500" : "text-muted-foreground hover:text-red-500"
          }`}
        >
          <Heart className={`h-4 w-4 ${post.liked ? "fill-current" : ""}`} />
          Gosto
        </button>
        <div className="w-px bg-border/30" />
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          <MessageCircle className="h-4 w-4" />
          Comentar
        </button>
      </div>

      {/* Comments section */}
      <AnimatePresence>
        {showComments && <PostComments postId={post.id} />}
      </AnimatePresence>
    </motion.article>
  );
}

export default function CommunityFeed() {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadFeed = useCallback(async (cursor?: number) => {
    try {
      const data = await api.community.feed(cursor);
      if (data.length < 20) setHasMore(false);
      setPosts((prev) => cursor ? [...prev, ...data] : data);
    } catch {
      if (!cursor) setPosts([]);
    }
  }, []);

  useEffect(() => {
    loadFeed().finally(() => setLoading(false));
  }, [loadFeed]);

  // Infinite scroll
  useEffect(() => {
    if (!hasMore || loadingMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && posts.length > 0) {
          setLoadingMore(true);
          const lastId = posts[posts.length - 1].id;
          loadFeed(lastId).finally(() => setLoadingMore(false));
        }
      },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, posts, loadFeed]);

  const handleNewPost = (post: CommunityPost) => {
    setPosts((prev) => [post, ...prev]);
  };

  const handleLikeUpdate = (id: number, liked: boolean, count: number) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, liked, likesCount: count } : p)),
    );
  };

  return (
    <div className="space-y-4">
      <PostComposer onPost={handleNewPost} />

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary/40" />
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/50 bg-white p-8 text-center">
          <MessageCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground/20" />
          <p className="text-sm font-medium text-muted-foreground">Nenhuma publicação ainda.</p>
          <p className="mt-1 text-xs text-muted-foreground/60">Sê o primeiro a partilhar algo com a comunidade!</p>
        </div>
      ) : (
        <>
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onLikeUpdate={handleLikeUpdate} />
          ))}
          <div ref={sentinelRef} className="h-4" />
          {loadingMore && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary/40" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
