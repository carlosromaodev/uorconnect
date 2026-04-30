import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Heart, LogOut, FileText, Loader2, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/social/UserAvatar";
import { api, getToken, setToken, type CommunityProfile } from "@/lib/api";
import { Link, useNavigate } from "react-router-dom";
import { useCommunityBase } from "@/community/components/CommunityShell";

function StatCard({ value, label, icon: Icon }: { value: number; label: string; icon: React.ElementType }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-border/50 bg-white p-3 shadow-sm">
      <Icon className="h-4 w-4 text-primary/60" />
      <span className="text-xl font-bold tabular-nums">{value}</span>
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
    </div>
  );
}

export default function CommunityProfilePage() {
  const navigate = useNavigate();
  const base = useCommunityBase();
  const [profile, setProfile] = useState<CommunityProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api.community.profile().then(setProfile).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    setToken(null);
    navigate(`${base}/login?redirect=/perfil`);
  };

  if (!getToken()) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <UserAvatar name="?" size="lg" className="mb-4" />
        <p className="text-sm text-muted-foreground">
          <Link to={`${base}/login?redirect=/perfil`} className="font-semibold text-primary hover:underline">
            Inicia sessão
          </Link>{" "}
          para ver o teu perfil.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary/40" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 bg-white p-8 text-center">
        <p className="text-sm text-muted-foreground">Não foi possível carregar o perfil.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Profile card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-2xl border border-border/50 bg-white shadow-sm"
      >
        {/* Banner */}
        <div className="h-20 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent" />
        <div className="-mt-8 px-5 pb-5">
          <UserAvatar name={profile.name} size="lg" className="h-16 w-16 border-4 border-white text-lg shadow-sm" />
          <h1 className="mt-3 text-lg font-bold">{profile.name}</h1>
          {profile.course && (
            <span
              className="mt-1 inline-flex rounded-md px-2 py-0.5 text-xs font-semibold"
              style={{
                backgroundColor: profile.courseColor ? `${profile.courseColor}18` : "rgba(100,116,139,0.1)",
                color: profile.courseColor || "#64748b",
              }}
            >
              {profile.course}
            </span>
          )}
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="h-3 w-3" />
            Membro desde {new Date(profile.joinedAt).toLocaleDateString("pt-PT", { month: "long", year: "numeric" })}
          </p>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 gap-3"
      >
        <StatCard value={profile.postsCount} label="Publicações" icon={FileText} />
        <StatCard value={profile.likesReceived} label="Gostos" icon={Heart} />
      </motion.div>

      {/* Quick links */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-2"
      >
        <Button asChild variant="outline" className="h-11 w-full justify-start gap-2.5 rounded-xl font-medium">
          <Link to={`${base}/minha-area`}>
            <FileText className="h-4 w-4 text-primary" />
            Minha Área (Submissões, Cursos)
          </Link>
        </Button>
        <Button
          variant="ghost"
          className="h-11 w-full justify-start gap-2.5 rounded-xl font-medium text-destructive hover:bg-destructive/5 hover:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Terminar sessão
        </Button>
      </motion.div>
    </div>
  );
}
