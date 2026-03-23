import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, ArrowRight, Clock, User, MapPin, FolderOpen, HelpCircle } from "lucide-react";

type SearchItem = {
  type: "sessão" | "palestrante" | "projeto" | "página";
  title: string;
  subtitle?: string;
  path: string;
};

const searchData: SearchItem[] = [
  { type: "sessão", title: "Inovação nas Telecomunicações em Angola", subtitle: "Dia 1 · 09:30 · Dr. Manuel Santos", path: "/agenda" },
  { type: "sessão", title: "Workshop: Introdução ao 5G e IoT", subtitle: "Dia 1 · 11:00 · Eng. Ana Ferreira", path: "/agenda" },
  { type: "sessão", title: "Apresentação de Projetos — Bloco 1", subtitle: "Dia 1 · 14:00", path: "/agenda" },
  { type: "sessão", title: "Marca Pessoal na Era Digital", subtitle: "Dia 2 · 09:00 · Dra. Carla Mendes", path: "/agenda" },
  { type: "sessão", title: "Workshop: GitHub, LinkedIn e Portfólio", subtitle: "Dia 2 · 10:30 · Eng. Pedro Lopes", path: "/agenda" },
  { type: "sessão", title: "Encerramento & Premiação", subtitle: "Dia 2 · 15:30", path: "/agenda" },
  { type: "palestrante", title: "Dr. Manuel Santos", subtitle: "Telecomunicações & Infraestrutura", path: "/palestrantes" },
  { type: "palestrante", title: "Eng. Ana Ferreira", subtitle: "5G & Internet das Coisas", path: "/palestrantes" },
  { type: "palestrante", title: "Dra. Carla Mendes", subtitle: "Marca Pessoal & Comunicação", path: "/palestrantes" },
  { type: "palestrante", title: "Eng. Pedro Lopes", subtitle: "Desenvolvimento & Mentoria", path: "/palestrantes" },
  { type: "página", title: "Agenda", subtitle: "Programação completa do evento", path: "/agenda" },
  { type: "página", title: "Submeter Projeto", subtitle: "Formulário de submissão", path: "/submeter" },
  { type: "página", title: "Projetos", subtitle: "Projetos submetidos", path: "/projetos" },
  { type: "página", title: "Cursos", subtitle: "Cursos e top por estudantes cadastrados", path: "/cursos" },
  { type: "página", title: "Regras", subtitle: "Regulamento do evento", path: "/regras" },
  { type: "página", title: "FAQ", subtitle: "Perguntas frequentes", path: "/faq" },
  { type: "página", title: "Guia do Participante", subtitle: "Como participar", path: "/guia" },
  { type: "página", title: "Palestrantes", subtitle: "Perfis dos oradores", path: "/palestrantes" },
  { type: "página", title: "Sobre", subtitle: "Sobre o evento", path: "/sobre" },
];

const typeIcons: Record<string, typeof Clock> = {
  sessão: Clock,
  palestrante: User,
  projeto: FolderOpen,
  página: ArrowRight,
};

export default function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const results = query.length > 0
    ? searchData.filter(
        (item) =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          (item.subtitle && item.subtitle.toLowerCase().includes(query.toLowerCase()))
      ).slice(0, 8)
    : [];

  const handleSelect = (path: string) => {
    navigate(path);
    setQuery("");
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg mx-4 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          <input
            autoFocus
            type="text"
            placeholder="Pesquisar palestras, palestrantes, projetos e cursos..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Results */}
        {query.length > 0 && (
          <div className="max-h-80 overflow-y-auto p-2">
            {results.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Nenhum resultado para "{query}"
              </div>
            ) : (
              results.map((item, i) => {
                const Icon = typeIcons[item.type] || ArrowRight;
                return (
                  <button
                    key={i}
                    onClick={() => handleSelect(item.path)}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-secondary/70 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      {item.subtitle && (
                        <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                      )}
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-secondary px-2 py-0.5 rounded-full shrink-0">
                      {item.type}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* Hint */}
        {query.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <HelpCircle className="w-5 h-5 mx-auto mb-2 opacity-40" />
            Começa a escrever para pesquisar...
          </div>
        )}
      </div>
    </div>
  );
}
