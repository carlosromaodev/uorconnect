import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Trophy,
  Code,
  Terminal,
  Clock,
  Users,
  GitBranch,
  Play,
  ChevronRight,
  Award,
  Zap,
  CheckCircle,
  FileCode,
  ListChecks,
  ScrollText,
  Calendar,
} from "lucide-react";

const DESAFIOS = [
  {
    id: 1,
    titulo: "Hello World",
    descricao: "Crie seu primeiro programa que exibe 'Hello, World!' na tela.",
    pontos: 50,
    dificuldade: "Muito Fácil",
    tempo: "~15 min",
    codigoPreview: "print('Hello, World!')",
    comentarioPreview: "// Saída: Hello, World!",
  },
  {
    id: 2,
    titulo: "Soma Básica",
    descricao: "Some dois números inteiros e retorne o resultado correto.",
    pontos: 75,
    dificuldade: "Muito Fácil",
    tempo: "~20 min",
    codigoPreview: "def soma(a, b):\n    return a + b",
    comentarioPreview: "",
  },
  {
    id: 3,
    titulo: "Par ou Ímpar",
    descricao: "Determine se um número é par ou ímpar usando condicionais.",
    pontos: 100,
    dificuldade: "Fácil",
    tempo: "~25 min",
    codigoPreview: "if n % 2 == 0:\n    return 'par'",
    comentarioPreview: "",
  },
  {
    id: 4,
    titulo: "FizzBuzz",
    descricao: "O clássico desafio de programação com múltiplos de 3 e 5.",
    pontos: 100,
    dificuldade: "Fácil",
    tempo: "~30 min",
    codigoPreview: "for i in range(1, 16):\n    # FizzBuzz logic",
    comentarioPreview: "",
  },
  {
    id: 5,
    titulo: "Contagem de Vogais",
    descricao: "Conte quantas vogais existem numa string.",
    pontos: 75,
    dificuldade: "Fácil",
    tempo: "~20 min",
    codigoPreview: "vogais = 'aeiouAEIOU'\ncount = sum(1 for c in s)",
    comentarioPreview: "",
  },
  {
    id: 6,
    titulo: "Palíndromo",
    descricao: "Verifique se uma palavra é um palíndromo.",
    pontos: 100,
    dificuldade: "Fácil",
    tempo: "~25 min",
    codigoPreview: "return s == s[::-1]\n# 'radar' == 'radar' ✓",
    comentarioPreview: "",
  },
];

const LEADERBOARD_DATA = [
  { posicao: 1, nome: "Maria Silva", pontos: 400, desafios: 5, avatar: "MS", cor: "bg-green-500" },
  { posicao: 2, nome: "João Santos", pontos: 300, desafios: 4, avatar: "JS", cor: "bg-cyan-500" },
  { posicao: 3, nome: "Ana Costa", pontos: 225, desafios: 3, avatar: "AC", cor: "bg-purple-500" },
  { posicao: 4, nome: "Pedro Lima", pontos: 175, desafios: 2, avatar: "PL", cor: "bg-orange-500" },
  { posicao: 5, nome: "Lucas Ferreira", pontos: 150, desafios: 2, avatar: "LF", cor: "bg-emerald-500" },
];

const REGRAS = [
  {
    titulo: "Apenas 1º Ano",
    descricao: "Este concurso é exclusivo para estudantes do primeiro ano. Mostre que está pronto!",
    icone: Users,
    cor: "text-green-400",
    fundo: "bg-green-500/10",
    borda: "border-green-500/30",
  },
  {
    titulo: "Tempo Limitado",
    descricao: "48 horas para completar todos os desafios. Gestão de tempo é crucial!",
    icone: Clock,
    cor: "text-purple-400",
    fundo: "bg-purple-500/10",
    borda: "border-purple-500/30",
  },
  {
    titulo: "Linguagens Livres",
    descricao: "Python, JavaScript, C, Java... Use a linguagem que dominar melhor!",
    icone: Code,
    cor: "text-cyan-400",
    fundo: "bg-cyan-500/10",
    borda: "border-cyan-500/30",
  },
  {
    titulo: "GitHub Obrigatório",
    descricao: "Submeta seu código via link do GitHub. Commits contam!",
    icone: GitBranch,
    cor: "text-orange-400",
    fundo: "bg-orange-500/10",
    borda: "border-orange-500/30",
  },
];

export default function ConcursoPrimeiroAno() {
  const [tempoRestante, setTempoRestante] = useState({
    dias: 2,
    horas: 14,
    minutos: 35,
    segundos: 48,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setTempoRestante((prev) => {
        let { dias, horas, minutos, segundos } = prev;
        segundos--;
        if (segundos < 0) {
          segundos = 59;
          minutos--;
        }
        if (minutos < 0) {
          minutos = 59;
          horas--;
        }
        if (horas < 0) {
          horas = 23;
          dias--;
        }
        if (dias < 0) {
          return { dias: 0, horas: 0, minutos: 0, segundos: 0 };
        }
        return { dias, horas, minutos, segundos };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const getCorDificuldade = (dificuldade: string) => {
    if (dificuldade === "Muito Fácil") return "bg-green-500 text-black";
    if (dificuldade === "Fácil") return "bg-purple-500 text-white";
    return "bg-orange-500 text-white";
  };

  const getCorNumero = (id: number) => {
    const cores = ["bg-green-500", "bg-cyan-500", "bg-purple-500", "bg-orange-500", "bg-emerald-500", "bg-pink-500"];
    return cores[(id - 1) % cores.length];
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white overflow-x-hidden">
      {/* Código decorativo de fundo */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] overflow-hidden">
        <pre className="font-mono text-xs text-green-400 p-8 leading-relaxed">
          {`import { Contest } from '@/types';
const challenge = await getNext();
// Competition starts in...
function solve(problem) {
  return solution;
}
while (true) {
  code();
  learn();
  improve();
}`}
        </pre>
      </div>

      {/* Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#1A1A1A] rounded-full border border-[#2D2D2D] mb-8"
          >
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-gray-400 font-mono">// CONCURSO EXCLUSIVO 1º ANO</span>
          </motion.div>

          {/* Título */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold font-mono mb-6"
          >
            <span className="text-white">&lt;Concurso de</span>
            <br />
            <span className="text-green-400">
              Programação_
              <span className="animate-pulse text-green-400">|</span>
            </span>
          </motion.h1>

          {/* Subtítulo */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto"
          >
            Prove que está pronto para ser o próximo coder estrela!
          </motion.p>

          {/* Countdown */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex justify-center gap-4 sm:gap-6 mb-12"
          >
            {[
              { valor: tempoRestante.dias, label: "DIAS", cor: "text-green-400" },
              { valor: tempoRestante.horas, label: "HORAS", cor: "text-cyan-400" },
              { valor: tempoRestante.minutos, label: "MIN", cor: "text-purple-400" },
              { valor: tempoRestante.segundos, label: "SEG", cor: "text-orange-400" },
            ].map((item, index) => (
              <div key={index} className="flex flex-col items-center">
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-[#1A1A1A] rounded-2xl flex flex-col items-center justify-center border border-[#2D2D2D]">
                  <span className={`text-3xl sm:text-4xl font-bold font-mono ${item.cor}`}>
                    {String(item.valor).padStart(2, "0")}
                  </span>
                </div>
                <span className="text-xs text-gray-500 font-mono mt-2">{item.label}</span>
              </div>
            ))}
          </motion.div>

          {/* Botões CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link
              to="/concurso/desafio/1"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-green-400 text-black font-mono font-semibold rounded-xl hover:bg-green-300 transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(34,197,94,0.4)]"
            >
              <Play className="w-5 h-5" />
              Participar Agora
            </Link>
            <button className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#1A1A1A] text-white font-mono font-semibold rounded-xl border border-[#2D2D2D] hover:border-gray-600 transition-all">
              <ScrollText className="w-5 h-5" />
              Ver Regulamento
            </button>
          </motion.div>
        </div>
      </section>

      {/* Prémios Banner */}
      <section className="px-4 sm:px-6 lg:px-8 mb-16">
        <div className="max-w-7xl mx-auto">
          <div className="bg-[#1A1A1A] rounded-2xl p-6 border border-[#2D2D2D] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Trophy className="w-8 h-8 text-green-400" />
              <div>
                <p className="text-white font-mono font-semibold">
                  Prémios: 1º lugar = 500€ | 2º lugar = 300€ | 3º lugar = 150€
                </p>
                <p className="text-green-400 text-sm font-mono">+ Certificados para todos os participantes</p>
              </div>
            </div>
            <Link
              to="/concurso/certificados"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#212121] text-white font-mono rounded-lg hover:bg-[#2D2D2D] transition-colors"
            >
              <Award className="w-4 h-4" />
              Saiba Mais
            </Link>
          </div>
        </div>
      </section>

      {/* Regras Section */}
      <section className="px-4 sm:px-6 lg:px-8 mb-16">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <ScrollText className="w-7 h-7 text-cyan-400" />
            <h2 className="text-2xl sm:text-3xl font-bold font-mono text-white">{`{ Regras do Concurso }`}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {REGRAS.map((regra, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className={`p-6 bg-[#1A1A1A] rounded-2xl border ${regra.borda} hover:border-opacity-60 transition-colors`}
              >
                <div className={`w-12 h-12 ${regra.fundo} rounded-xl flex items-center justify-center mb-4`}>
                  <regra.icone className={`w-6 h-6 ${regra.cor}`} />
                </div>
                <h3 className="text-lg font-mono font-semibold text-white mb-2">{regra.titulo}</h3>
                <p className="text-sm text-gray-400">{regra.descricao}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Desafios Section */}
      <section className="px-4 sm:px-6 lg:px-8 mb-16">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-3">
              <ListChecks className="w-7 h-7 text-green-400" />
              <h2 className="text-2xl sm:text-3xl font-bold font-mono text-white">&lt;Desafios/&gt;</h2>
            </div>
            <span className="inline-flex items-center px-4 py-2 bg-[#1A1A1A] rounded-full text-sm font-mono text-gray-400 border border-[#2D2D2D]">
              6 questões | 500 XP totais
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {DESAFIOS.map((desafio, index) => (
              <motion.div
                key={desafio.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-[#1A1A1A] rounded-2xl border border-[#2D2D2D] overflow-hidden hover:border-green-500/50 transition-all group"
              >
                {/* Header */}
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-10 h-10 ${getCorNumero(desafio.id)} rounded-lg flex items-center justify-center`}>
                      <span className="text-black font-mono font-bold text-sm">Q{desafio.id}</span>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-mono font-semibold ${getCorDificuldade(desafio.dificuldade)}`}>
                      {desafio.pontos} XP
                    </span>
                  </div>
                  <h3 className="text-xl font-mono font-bold text-white mb-2 group-hover:text-green-400 transition-colors">
                    {desafio.titulo}
                  </h3>
                  <p className="text-sm text-gray-400 mb-4">{desafio.descricao}</p>

                  {/* Code Preview */}
                  <div className="bg-[#0A0A0A] rounded-lg p-4 font-mono text-sm mb-4">
                    <pre className="text-orange-400 whitespace-pre-wrap">{desafio.codigoPreview}</pre>
                    {desafio.comentarioPreview && (
                      <pre className="text-gray-500 mt-1">{desafio.comentarioPreview}</pre>
                    )}
                  </div>

                  {/* Meta */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-gray-500">
                      <Clock className="w-4 h-4" />
                      <span className="text-xs font-mono">{desafio.tempo}</span>
                    </div>
                    <Link
                      to={`/concurso/desafio/${desafio.id}`}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 text-black text-sm font-mono font-semibold rounded-lg hover:bg-emerald-400 transition-all hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                    >
                      Ver Desafio
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Leaderboard Section */}
      <section className="px-4 sm:px-6 lg:px-8 mb-16">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-3">
              <Trophy className="w-7 h-7 text-green-400" />
              <h2 className="text-2xl sm:text-3xl font-bold font-mono text-white">{`{ Leaderboard }`}</h2>
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-green-400 text-black text-sm font-mono font-semibold rounded-lg">
                Ao Vivo
              </button>
              <button className="px-4 py-2 bg-[#1A1A1A] text-gray-400 text-sm font-mono font-semibold rounded-lg border border-[#2D2D2D]">
                Final
              </button>
            </div>
          </div>

          <div className="bg-[#1A1A1A] rounded-2xl border border-[#2D2D2D] overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-12 gap-4 p-4 border-b border-[#2D2D2D] text-xs font-mono text-gray-500 uppercase">
              <div className="col-span-1">#</div>
              <div className="col-span-5">Estudante</div>
              <div className="col-span-2 text-center">Q1-Q6</div>
              <div className="col-span-2 text-center">Desafios</div>
              <div className="col-span-2 text-right">Total</div>
            </div>

            {/* Rows */}
            {LEADERBOARD_DATA.map((item, index) => (
              <motion.div
                key={item.posicao}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className={`grid grid-cols-12 gap-4 p-4 items-center ${
                  index === 0 ? "bg-[#212121]" : ""
                } hover:bg-[#212121] transition-colors`}
              >
                <div className="col-span-1">
                  <div
                    className={`w-10 h-8 flex items-center justify-center rounded-lg font-mono font-bold text-sm ${
                      item.posicao === 1
                        ? "bg-green-500 text-black"
                        : item.posicao === 2
                        ? "bg-cyan-500 text-black"
                        : item.posicao === 3
                        ? "bg-purple-500 text-white"
                        : "bg-[#2D2D2D] text-gray-400"
                    }`}
                  >
                    {item.posicao}
                  </div>
                </div>
                <div className="col-span-5 flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full ${item.cor} flex items-center justify-center text-xs font-bold text-white`}>
                    {item.avatar}
                  </div>
                  <span className="font-mono font-semibold text-white">{item.nome}</span>
                </div>
                <div className="col-span-2 flex justify-center gap-1">
                  {[50, 75, 100, 100, 75].slice(0, Math.ceil(item.pontos / 100)).map((pontos, i) => (
                    <div
                      key={i}
                      className="w-6 h-6 bg-green-500/20 rounded flex items-center justify-center"
                    >
                      <CheckCircle className="w-3 h-3 text-green-400" />
                    </div>
                  ))}
                </div>
                <div className="col-span-2 text-center font-mono text-gray-400">{item.desafios}</div>
                <div className="col-span-2 text-right">
                  <span className="font-mono font-bold text-green-400">{item.pontos} XP</span>
                </div>
              </motion.div>
            ))}
          </div>

          {/* View All Button */}
          <div className="mt-6 text-center">
            <Link
              to="/concurso/leaderboard"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#1A1A1A] text-green-400 font-mono font-semibold rounded-xl border border-[#2D2D2D] hover:border-green-500/50 transition-all"
            >
              Ver Ranking Completo
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Como Participar Section */}
      <section className="px-4 sm:px-6 lg:px-8 mb-16">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <Zap className="w-7 h-7 text-yellow-400" />
            <h2 className="text-2xl sm:text-3xl font-bold font-mono text-white">Como Participar</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { passo: 1, titulo: "Login", descricao: "Acede com a tua conta de estudante UOR Connect" },
              { passo: 2, titulo: "Escolhe", descricao: "Seleciona um desafio e lê as instruções" },
              { passo: 3, titulo: "Resolve", descricao: "Escreve o teu código no editor" },
              { passo: 4, titulo: "Submete", descricao: "Envia o link do GitHub e reflection" },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="relative"
              >
                <div className="bg-[#1A1A1A] rounded-2xl p-6 border border-[#2D2D2D]">
                  <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center mb-4">
                    <span className="text-black font-mono font-bold text-xl">{item.passo}</span>
                  </div>
                  <h3 className="text-lg font-mono font-semibold text-white mb-2">{item.titulo}</h3>
                  <p className="text-sm text-gray-400">{item.descricao}</p>
                </div>
                {index < 3 && (
                  <div className="hidden md:block absolute top-1/2 -right-3 transform -translate-y-1/2">
                    <ChevronRight className="w-6 h-6 text-gray-600" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="px-4 sm:px-6 lg:px-8 pb-20">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-gradient-to-r from-green-500/10 via-purple-500/10 to-cyan-500/10 rounded-3xl p-12 border border-[#2D2D2D]">
            <FileCode className="w-16 h-16 text-green-400 mx-auto mb-6" />
            <h2 className="text-3xl sm:text-4xl font-bold font-mono text-white mb-4">
              Pronto para codar?
            </h2>
            <p className="text-gray-400 mb-8 max-w-xl mx-auto">
              Junta-te aos teus colegas do primeiro ano nesta competição divertida e aprende programação de forma prática!
            </p>
            <Link
              to="/concurso/desafio/1"
              className="inline-flex items-center gap-3 px-10 py-5 bg-green-400 text-black font-mono font-bold text-lg rounded-xl hover:bg-green-300 transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(34,197,94,0.5)]"
            >
              <Play className="w-6 h-6" />
              Começar Primeiro Desafio
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
