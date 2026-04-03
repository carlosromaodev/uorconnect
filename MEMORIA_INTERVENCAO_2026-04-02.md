# Memoria de Intervencao

Data: 2026-04-02
Projeto: UOR Connect

## Objetivo desta sessao

- Reforcar a area administrativa do evento.
- Implementar uma central robusta de administracao de cookies no admin.
- Corrigir responsividade dos fluxos de submissao de expositores e cursos.
- Ativar validacao em tempo real nos campos.
- Corrigir quebra visual no preview de PDF e ficheiros longos.
- Alinhar tipografia e linguagem visual com `https://agendar.uorconnect.space/`.
- Garantir botao/atalho para o laboratorio.

## Comandos e etapas

1. Inicio da sessao de analise estrutural.
2. Leitura do skill `agent-browser` para inspecao visual de referencia.
3. Pesquisa no frontend por:
   - admin
   - analytics
   - cookies
   - formularios de submissao
   - recibos
   - componentes de documentos responsivos
4. Listagem de ficheiros em:
   - `frontend/src/components/admin`
   - `frontend/src/pages`
5. Leitura detalhada de:
   - `frontend/src/pages/Admin.tsx`
   - `frontend/src/components/admin/AdminAnalyticsTab.tsx`
   - `frontend/src/components/documents/ResponsiveDocumentViewer.tsx`
   - `frontend/src/pages/Submeter.tsx`
   - `frontend/src/pages/CursoInscricao.tsx`
   - `frontend/src/pages/submission-form.validation.ts`
6. Comparacao com o snapshot parcial:
   - `backups/submission-form-20260330-164005/frontend/src/pages/Submeter.tsx`
7. Captura da referencia visual de `https://agendar.uorconnect.space/`:
   - HTML inicial via `curl -s https://agendar.uorconnect.space`
   - CSS principal via `curl -s https://agendar.uorconnect.space/assets/index-DZt-tHx7.css`
8. Confirmacao da tipografia de referencia:
   - corpo: `DM Sans`
   - titulos: `Sora`
   - resultado: a base tipografica do `uorconnect` ja estava alinhada com o `agendar`

## Alteracoes implementadas

1. Reposicao do fluxo responsivo de expositores em `frontend/src/pages/Submeter.tsx` a partir do snapshot interno de `2026-03-30`, com:
   - auto-preenchimento da sessao do estudante
   - viewport controlado para PDF/imagem
   - links para recibo canonico
   - botao para o laboratorio
2. Validacao em tempo real durante digitacao em:
   - `frontend/src/pages/Submeter.tsx`
   - `frontend/src/pages/CursoInscricao.tsx`
3. Correcao de quebra visual de ficheiros longos e preview PDF em:
   - `frontend/src/components/documents/ResponsiveDocumentViewer.tsx`
4. Criacao das classes globais que faltavam e que varias paginas novas dependiam em:
   - `frontend/src/index.css`
   Classes adicionadas:
   - `page-section`
   - `page-shell`
   - `page-shell-narrow`
   - `surface-card`
   - `responsive-two-col`
   - `responsive-grid`
   - `surface-scroll-y`
   - `field-note`
   - `document-frame`
   - `document-frame__viewport`
5. Activacao da central de cookies e analytics no admin:
   - novas tipagens e metodos em `frontend/src/lib/api.ts`
   - nova aba `Cookies & Analytics` no `frontend/src/pages/Admin.tsx`
   - integracao da `AdminAnalyticsTab`
   - inventario de cookies e resumo de consentimentos em `frontend/src/components/admin/AdminAnalyticsTab.tsx`
6. Integracao da supervisao do laboratorio no admin:
   - nova aba `Laboratorio` no `frontend/src/pages/Admin.tsx`
   - integracao da `AdminContestTab`

## Validacao local

1. Build do frontend:
   - `npm run build`
2. Typecheck:
   - `npx tsc --noEmit`
3. Resultado:
   - build local concluida com sucesso
   - typecheck concluido com sucesso

## Publicacao na VPS

1. Empacotamento dos ficheiros alterados:
   - `tar -czf /tmp/uorconnect-admin-form-refresh-20260402.tgz -C /home/cr/Documentos/Documents/coding/uorProject frontend/src/index.css frontend/src/lib/api.ts frontend/src/components/documents/ResponsiveDocumentViewer.tsx frontend/src/pages/CursoInscricao.tsx frontend/src/pages/Submeter.tsx frontend/src/pages/Admin.tsx frontend/src/components/admin/AdminAnalyticsTab.tsx`
2. Copia para a VPS:
   - `scp -o BatchMode=yes -o StrictHostKeyChecking=accept-new /tmp/uorconnect-admin-form-refresh-20260402.tgz root@135.181.47.46:/tmp/uorconnect-admin-form-refresh-20260402.tgz`
3. Extracao e rebuild do frontend na VPS:
   - `ssh root@135.181.47.46 "cd /opt/uorconnect && tar -xzf /tmp/uorconnect-admin-form-refresh-20260402.tgz && docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env up -d --build frontend && docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env ps frontend"`
4. Verificacoes finais:
   - `curl -I https://uorconnect.space`
   - `curl -s https://uorconnect.space`
   - `curl -I https://laboratorio.uorconnect.space`
   - `ssh root@135.181.47.46 "docker exec deploy-frontend-1 sh -lc 'grep -R -n \"Cookies & Analytics\\|Abrir laboratorio\\|Submeter Exposicao\\|Controla a tua privacidade\" /usr/share/nginx/html/assets /usr/share/nginx/html/index.html'"`

## Estado final desta sessao

1. `deploy-frontend-1` ficou `healthy`.
2. `uorconnect.space` respondeu `HTTP 200` com os assets novos:
   - `index-Dj2iL7R0.js`
   - `index-DTppx2RO.css`
3. O bundle publicado contem sinais directos de que a actualizacao entrou:
   - `Cookies & Analytics`
   - `Controla a tua privacidade`
   - `Abrir laboratorio`
   - `Submeter Exposicao`

## Proximas etapas previstas

1. Validar visualmente no browser os breakpoints mais sensiveis:
   - admin
   - submeter
   - cursos/inscricao
2. Se necessario, aprofundar a central de cookies com politica versionada e comandos administrativos adicionais no backend.

## Sessao Adicional (Restauracao Local e Design)

**1. Correcao de falhas de base de dados local (Erros HTTP 500)**
   - O ambiente de desenvolvimento local reportava erros 500 para todos os endpoints (`api/stats`, `api/home-content`, etc.) devido ah ausencia de tabelas na base de dados SQLite (`dev.db`).
   - Foi criado o ficheiro `.env` em `backend/` definindo a `DATABASE_URL`.
   - Executada a forca a criacao de schema via `npx prisma db push --force-reset`, resolvendo a inicializacao.

**2. Polimento visual com base em agendar.uorconnect.space**
   - Melhoria do Header/Hero Section em `Index.tsx` com instalacao de mesh gradients (`hero-mesh`) e layout duas colunas em desktop.
   - Refinamento de card shadows e atalhos na HomePage (Acesso Rapido expandido para 8 itens).
   - Introducao de classes globais e helpers para inputs (`.input-valid`, `.input-invalid`, `.input-warning`) via `index.css`.

**3. Validacao Visual de Cores nos Formularios**
   - Implementadas funcoes `inputCls()` em `Submeter.tsx` e `CursoInscricao.tsx`.
   - Elementos de input recebem formaticamente a cor **Vermelha** (com ponto de erro) ou **Verde** em tempo real conformem vao sendo preenchidos correta ou incorretamente.

**4. Limitacao Local**
   - Todas estas alteracoes foram estritamente validadas localmente no `localhost:8080` com o subagente de browser gerando provas visuais, e nao foram efetuados pushes para a producao VPS, respeitando as instrucoes da sessao.

## Sessao 2026-04-03 (responsividade + remoção do laboratório)

- Submeter: removido o campo de email, adicionados ids de erro/aria nos campos principais, estado `touched`, drag-and-drop do comprovativo com feedback visual, botão de remover ficheiro e limpeza de mensagens duplicadas.
- App/Admin/Receipt: retiradas rotas e tab do Laboratorio; removido CTA "Entrar no Laboratório" no recibo de submissao; admin deixa de mostrar aba Contest.
- Hero/Home: manteve badge e CTA Ao Vivo diferenciados (sem ligação ao laboratório); sem referencias restantes ao laboratorio no header.
- Nota: build/typecheck ainda nao executados nesta sessao.

### Pendentes / feedback recente
- Home (hero): em mobile o título e os botões ainda não quebram nem refluem como esperado; falta ajustar `text-balance`/largura máxima do H1, reforçar `gap` vertical e centralizar melhor o bloco de sessão ativa.
- Submeter: mesmo com PDF selecionado alguns utilizadores ainda veem “⚠ Seleccione um ficheiro válido”; vou revalidar após o ajuste de estado funcional no upload e, se necessário, flexibilizar a regex ou o momento de validação.

### Sessao 2026-04-03 (CSRF + ajustes finais)
- Ajuste CSRF: `src/lib/api.ts` agora lê o cookie `uor_csrf` e envia `x-csrf-token` automaticamente quando não há header Authorization, evitando o erro “CSRF token inválido ou ausente” em chamadas autenticadas via cookies.
- Home: aplicado `text-balance/text-pretty` e limite `max-w-[32ch]` no H1 para melhorar quebra em mobile; CTAs já centralizados com tamanho responsivo.
- Build: `npm run build` passou (apenas aviso de Browserslist desatualizado).

### Continuação 2026-04-03 (CSRF ainda falha + responsividade hero)
- CSRF: forcei `credentials: \"include\"` em todas as requisições e envio do `x-csrf-token` sempre que o cookie `uor_csrf` existir (mesmo havendo Authorization). Precisamos testar novamente em ambiente real para confirmar se o erro persiste.
- Hero mobile: reduzi base do H1 para `text-2xl` em <640px e mantive escala nos breakpoints; CTAs continuam full-width e com padding menor (`px-6`) para não colarem ao título. Build voltou a passar.

### Ajuste extra 2026-04-03 (Hero ainda apertada)
- H1 agora usa escala fluida (`text-[clamp(1.7rem,6vw,3rem)]`) e `max-w-[30ch]` para quebrar mais cedo em 320–375px.
- CTAs: altura 44px (`h-11`), padding `px-5/7` para dar respiro do título; espaçamento vertical aumentado (`mb-10`).
- Build ok após ajuste.

### Reestruturação 2026-04-03 (Hero mobile-first de verdade)
- A hero deixou de depender do alinhamento desktop no mobile:
  - container refeito com `max-w-screen-xl` e paddings explícitos por breakpoint;
  - coluna principal com `min-w-0`;
  - branding (`logo + divisor + universidade`) passa a empilhar no mobile e só vira linha em `sm+`;
  - badge com `flex-wrap`;
  - H1 e subtítulo com largura máxima menor em mobile;
  - grupo de CTAs limitado a `max-w-sm` no mobile;
  - cards de login/sessão ativa passam a empilhar e o botão ocupa largura total no mobile.
- Objetivo desta intervenção: impedir que uma linha longa force overflow horizontal e faça o topo da home parecer renderizado em resolução desktop dentro do viewport mobile.
- Build validado após a reestruturação.

implementa tudo isso : Você é um frontend developer sênior especializado em responsividade perfeita, interfaces premium, Tailwind CSS, Framer Motion e design systems consistentes.
No projeto UOR Connect, precisamos resolver dois grandes problemas de uma só vez em todo o frontend:

Responsividade quebrada em todo o site (especialmente em formulários, inputs, exibição de dados, tabelas, PDFs e talões).
Falta grave de detalhes visuais, cores, gradientes e animações que condizem com a identidade premium do projeto.

Além disso, queremos fazer uma separação total entre o sistema principal (UOR Connect) e o Laboratório (que é um sistema completamente à parte).
Requisitos obrigatórios:
1. Responsividade Definitiva (Mobile-First e 100% Adaptativa)

Garanta que todo o site, independentemente da resolução (320px a 4K), se adapte perfeitamente.
Nunca permita zoom automático ao focar em qualquer <input>, <select> ou <textarea>.
Textos, tabelas, cards, listas, PDFs, talões de embarque e modais nunca devem quebrar o layout.
Use max-width, overflow-auto, word-break, line-clamp e container queries onde necessário.
Formulários, inputs e botões devem ter tamanho mínimo de toque e permanecer usáveis em qualquer tela.

2. Detalhes Visuais Premium, Cores e Animações

Aplique detalhes visuais ricos em todo o projeto, especialmente em:
Campos preenchidos automaticamente (background sutil com gradiente suave, borda colorida com a cor principal do projeto #FF5E00 ou #00B894, ícone colorido e animado).
Ícones de “Preenchido automaticamente” com cor vibrante e pequena animação de check-in.
Gradientes suaves nos cards, botões e hero sections (usando as cores da marca: laranja vibrante, azul escuro #0A3D62, verde neon #00B894 e toques de roxo).
Hover states com glow neon sutil e scale leve.
Animações fluidas com Framer Motion (fade-in, slide-up, stagger, confetti controlado no talão, animação ao auto-preencher campos).

Todo o site deve transmitir profissionalismo e modernidade através de detalhes visuais caprichados.

3. Separação Total do Laboratório

Remova completamente qualquer referência ao Laboratório em todo o site, exceto o botão de atalho na Home (se ainda for desejado).
Especificamente:
Remova o botão “< LABORATÓRIO / DESAFIO >” da Home e de todas as outras páginas.
Remova qualquer menção ou link para Laboratório nas páginas de submissão, expositores, administração, Ao Vivo, Cursos, etc.
Os expositores não têm nada a ver com Laboratório — limpe qualquer vestígio disso.

O Laboratório deve ser tratado como um sistema totalmente separado.

Sua tarefa:

Primeiro faça uma análise rápida dos problemas atuais (responsividade + falta de detalhes visuais + mistura com Laboratório).
Depois proponha a estratégia global de responsividade, paleta de cores/gradientes e padrão de animações.
Por fim, forneça o código completo e atualizado para os principais ficheiros afetados:
globals.css (regras globais de responsividade e estilos)
Submeter.tsx (formulário com auto-preenchimento visual rico)
Página de conclusão / talão de embarque (com animações e detalhes premium)
Admin.tsx (aba de submissões e expositores limpa)
Home (header superior limpo, sem laboratório)
Qualquer componente de input, card ou tabela usado em todo o site


Seja extremamente caprichoso nos detalhes visuais, animações e consistência de cores. O objetivo é que o site fique visualmente impressionante, 100% responsivo e com identidade forte do UOR Connect, sem qualquer vestígio do Laboratório fora do seu lugar.
Comece agora.

Trajectory ID: e8eb95f8-6949-402d-bc27-2cd94dfa8ca3
Error: HTTP 503 Service Unavailable
Sherlog: 
TraceID: 0x737b1db2fa1a15c7
Headers: {"Alt-Svc":["h3=\":443\"; ma=2592000,h3-29=\":443\"; ma=2592000"],"Content-Length":["415"],"Content-Type":["text/event-stream"],"Date":["Fri, 03 Apr 2026 09:01:23 GMT"],"Server":["ESF"],"Server-Timing":["gfet4t7; dur=2227"],"Vary":["Origin","X-Origin","Referer"],"X-Cloudaicompanion-Trace-Id":["737b1db2fa1a15c7"],"X-Content-Type-Options":["nosniff"],"X-Frame-Options":["SAMEORIGIN"],"X-Xss-Protection":["0"]}

{
  "error": {
    "code": 503,
    "details": [
      {
        "@type": "type.googleapis.com/google.rpc.ErrorInfo",
        "domain": "cloudcode-pa.googleapis.com",
        "metadata": {
          "model": "claude-sonnet-4-6"
        },
        "reason": "MODEL_CAPACITY_EXHAUSTED"
      }
    ],
    "message": "No capacity available for model claude-sonnet-4-6 on the server",
    "status": "UNAVAILABLE"
  }
}

## Sessao 2026-04-03 (toastify + home + CTA + deploy)

### Objetivo
- Atualizar o sistema de notificacoes para `react-toastify` com feedback visual consistente por status (sem fundo branco).
- Ajustar o bloco `Tipos de Exposicao` para escala menor e melhor legibilidade em todos os dispositivos.
- Reestruturar os CTAs da hero em grelha responsiva lado-a-lado tambem em mobile.
- Adicionar CTA verde `Agendar evento` e CTA `Desafios` com estetica hacker/checkerboard.

### Alteracoes implementadas
1. Migracao das notificacoes para React Toastify:
   - dependencia adicionada em `frontend/package.json` e `frontend/package-lock.json`.
   - refactor completo de `frontend/src/components/ui/sonner.tsx` para wrapper compativel em cima do `react-toastify`.
   - padronizacao de tipos:
     - sucesso: gradiente verde
     - aviso: gradiente amarelo
     - erro: gradiente vermelho
     - informacao/default: azul escuro + verde
   - todas as chamadas existentes `toast.success/error/warning/info` foram preservadas sem quebrar API interna.

2. Estilos globais de notificacao:
   - novas classes em `frontend/src/index.css`:
     - `.uor-toast*` para container/corpo/close button
     - `.uor-toast--success`, `.uor-toast--warning`, `.uor-toast--error`, `.uor-toast--info`, `.uor-toast--default`
   - garantido que nao existe fundo branco para estados de notificacao.

3. Hero / Home:
   - `frontend/src/pages/Index.tsx`:
     - CTAs da hero convertidos para grelha:
       - `grid-cols-2` no mobile
       - `md:grid-cols-3`
       - `xl:grid-cols-5`
     - botoes atualizados:
       - `Votar Projetos`
       - `Submeter Projeto`
       - `Ao Vivo`
       - `Agendar evento` (verde, `https://agendar.uorconnect.space/`)
       - `Desafios` (`https://laboratorio.uorconnect.space/`) com visual hacker.
     - texto do badge alterado de:
       - `Exposição UOR Connect`
       para:
       - `Exposição na 3ª edição da Feira do Dia das Telecomunicações`
     - escala do bloco de titulo/descricao reduzida para nao ficar gigante em mobile/tablet/desktop.

4. App:
   - `frontend/src/App.tsx` atualizado para usar `<Toaster />` (wrapper `react-toastify`).

### Validacao local
1. Frontend build:
   - `npm run build` (OK)
2. Frontend testes:
   - `npm run test` (falhou em testes existentes de `Submeter.*.spec.tsx` por `ResizeObserver is not defined`, nao relacionado com a migracao de toastify)
3. Backend build:
   - `npm run build` (OK)
4. Backend testes:
   - `npm run test` (OK)

### Publicacao (GitHub + VPS)
- Commit criado com os ficheiros desta intervencao.
- Push para `origin/main`.
- Deploy frontend na VPS via pacote + `docker compose up -d --build frontend`.
- Verificacao final com `curl` e inspeccao de bundle.

### Execucao real na VPS (2026-04-03)
1. GitHub:
   - commit: `aeec7e8`
   - push concluido para `main`.
2. VPS:
   - o repositório remoto estava com muitas alteracoes locais, por isso o deploy foi feito por `scp` dos ficheiros alterados em vez de `git pull`.
   - ficheiros enviados:
     - `frontend/package.json`
     - `frontend/package-lock.json`
     - `frontend/src/components/ui/sonner.tsx`
     - `frontend/src/index.css`
     - `frontend/src/pages/Index.tsx`
     - `frontend/src/lib/phosphor-icons.tsx`
     - `frontend/src/lib/home-content.ts`
3. Build/Release:
   - comando: `docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env up -d --build frontend`
   - primeira tentativa falhou por ficheiro em falta (`src/lib/phosphor-icons`); corrigido com envio do ficheiro.
   - segunda tentativa falhou por export em falta de `defaultHeroSponsors`; corrigido com envio de `src/lib/home-content.ts`.
   - terceira tentativa concluiu com sucesso e container ficou `healthy`.
4. Verificacao:
   - `deploy-frontend-1` em estado `Up ... (healthy)`.
   - `https://uorconnect.space` a responder `HTTP 200`.

### Ajuste complementar de compatibilidade (2026-04-03 18:52)
1. Problema identificado apos simplificacao de dependencias:
   - ao remover `sonner` do `package.json`, o build remoto falhava porque existem modulos legados (ex.: `frontend/src/pages/Projetos.tsx`) que ainda importam `sonner` diretamente.
2. Correcao aplicada:
   - restaurada a dependencia `sonner` no frontend para manter compatibilidade durante a migracao gradual para `react-toastify`.
   - commit de correcao: `2d8f849` (`fix(frontend): restore sonner dependency for remote compatibility`).
   - push realizado para `origin/main`.
3. Deploy final:
   - sincronizados `frontend/package.json` e `frontend/package-lock.json` via `scp`.
   - executado novamente:
     - `docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env up -d --build frontend`
   - resultado:
     - imagem reconstruida sem erro.
     - `deploy-frontend-1` em `Up ... (healthy)`.
     - verificacao publica: `curl -I https://uorconnect.space` -> `HTTP/2 200` (Fri, 03 Apr 2026 18:52:39 GMT).
