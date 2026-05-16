import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, BadgeCheck, Download, FileBadge2, Globe2, Home, Loader2, Mail, Phone, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { api, type PublicTeamCredentialMember } from "@/lib/api";
import { downloadBlobFile } from "@/lib/student-documents";

function initials(value?: string | null) {
  const parts = value?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return "UC";
  return `${parts[0]?.[0] ?? "U"}${parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : ""}`.toUpperCase();
}

function fileNameFromMember(member: PublicTeamCredentialMember) {
  return `Passe_${(member.name || member.publicSlug).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_")}.pdf`;
}

function socialLabel(key: string) {
  const labels: Record<string, string> = {
    instagram: "Instagram",
    facebook: "Facebook",
    linkedin: "LinkedIn",
    github: "GitHub",
    website: "Website",
  };
  return labels[key] ?? key;
}

export default function TeamMemberProfile() {
  const { slug = "" } = useParams();
  const [member, setMember] = useState<PublicTeamCredentialMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Perfil da equipa | UOR Connect";
    return () => {
      document.title = previousTitle;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    api.teamCredentials.profile(slug)
      .then((payload) => {
        if (!active) return;
        setMember(payload);
        document.title = `${payload.name ?? "Membro"} | UOR Connect`;
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Perfil não encontrado.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [slug]);

  const handleDownload = async () => {
    if (!member) return;
    setDownloading(true);
    try {
      const blob = await api.teamCredentials.downloadPass(member.publicSlug);
      downloadBlobFile(blob, fileNameFromMember(member));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível baixar o passe.");
    } finally {
      setDownloading(false);
    }
  };

  const displayAddress = member?.address ?? null;
  const socialLinks = Object.entries({
    instagram: member?.instagramUrl,
    facebook: member?.facebookUrl,
    linkedin: member?.linkedinUrl,
    github: member?.githubUrl,
    website: member?.websiteUrl,
  }).filter((entry): entry is [string, string] => Boolean(entry[1]));

  if (loading) {
    return (
      <div className="page-section">
        <div className="page-shell flex min-h-[54vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error || !member) {
    return (
      <div className="page-section">
        <div className="page-shell">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
            <AlertTriangle className="h-6 w-6" />
            <h1 className="mt-3 text-xl font-semibold">Perfil indisponível</h1>
            <p className="mt-2 text-sm">{error ?? "Este perfil não está disponível."}</p>
            <Button asChild className="mt-5">
              <Link to="/">Voltar ao UOR Connect</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-section">
      <div className="page-shell">
        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <div className="grid gap-0 lg:grid-cols-[360px_1fr]">
            <aside className="bg-slate-950 p-6 text-white sm:p-8">
              <Badge className="border-white/15 bg-white/10 text-white hover:bg-white/10">
                <FileBadge2 className="mr-1.5 h-3.5 w-3.5" />
                {member.categoryLabel}
              </Badge>
              <div className="mt-8 flex flex-col items-center text-center">
                <div className="flex h-36 w-36 items-center justify-center overflow-hidden rounded-full border-4 border-white/20 bg-white/10 text-3xl font-bold">
                  {member.photoUrl ? <img src={member.photoUrl} alt={member.name ?? "Membro"} className="h-full w-full object-cover" /> : initials(member.name)}
                </div>
                <h1 className="mt-5 font-heading text-3xl font-bold leading-tight">{member.name ?? "Membro UOR Connect"}</h1>
                <p className="mt-2 text-sm text-white/65">{member.role}</p>
              </div>
            </aside>

            <div className="p-6 sm:p-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                    <ShieldCheck className="h-4 w-4" />
                    Credencial validada
                  </p>
                  <h2 className="mt-2 text-2xl font-bold">{member.team}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{member.accessLevel}</p>
                </div>
                <Button disabled={downloading} onClick={() => void handleDownload()}>
                  {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  Baixar passe
                </Button>
              </div>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Função</span>
                  <p className="mt-2 font-semibold">{member.role}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Categoria</span>
                  <p className="mt-2 font-semibold">{member.categoryLabel}</p>
                </div>
                {member.course ? (
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Área</span>
                    <p className="mt-2 font-semibold">{member.course}</p>
                  </div>
                ) : null}
                {member.organization ? (
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Instituição</span>
                    <p className="mt-2 font-semibold">{member.organization}</p>
                  </div>
                ) : null}
                {displayAddress ? (
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                    <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      <Home className="h-3.5 w-3.5" />
                      Morada
                    </span>
                    <p className="mt-2 font-semibold">{displayAddress}</p>
                  </div>
                ) : null}
              </div>

              {member.bio ? (
                <div className="mt-5 rounded-xl border border-border/60 p-4">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Perfil</span>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{member.bio}</p>
                </div>
              ) : null}

              {socialLinks.length > 0 ? (
                <div className="mt-5 rounded-xl border border-border/60 p-4">
                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    <Globe2 className="h-3.5 w-3.5" />
                    Redes sociais
                  </span>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {socialLinks.map(([key, url]) => (
                      <a
                        key={key}
                        className="inline-flex min-h-10 items-center rounded-full border border-border/60 px-3 py-1.5 text-sm font-semibold transition hover:border-primary/40 hover:text-primary"
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {socialLabel(key)}
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-2 text-sm">
                {member.email ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-border/60 px-3 py-1.5">
                    <Mail className="h-4 w-4 text-primary" />
                    {member.email}
                  </span>
                ) : null}
                {member.phone ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-border/60 px-3 py-1.5">
                    <Phone className="h-4 w-4 text-primary" />
                    {member.phone}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-emerald-700">
                  <BadgeCheck className="h-4 w-4" />
                  {member.statusLabel}
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
