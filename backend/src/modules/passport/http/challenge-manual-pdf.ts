import { escapeHtml, loadLogoDataUri, renderPdfFromHtml } from "../../reports/http/pdf-report.utils";

type ChallengeManualEventEnv = Partial<{
  UORCONNECT_EVENT_NAME: string | null;
  UORCONNECT_EVENT_DATE: string | null;
  UORCONNECT_EVENT_LOCATION: string | null;
}>;

function eventText(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed || fallback;
}

export function resolveChallengeManualEventInfo(env: ChallengeManualEventEnv = {}) {
  return {
    eventName: eventText(env.UORCONNECT_EVENT_NAME, "UOR Connect"),
    eventDate: eventText(env.UORCONNECT_EVENT_DATE, "Data a confirmar"),
    eventLocation: eventText(env.UORCONNECT_EVENT_LOCATION, "Universidade Óscar Ribas"),
  };
}

export async function renderChallengeManualPdf(
  student: { name: string | null; studentNumber: string; course: string | null },
  env: ChallengeManualEventEnv = {},
) {
  const { eventName, eventDate, eventLocation } = resolveChallengeManualEventInfo(env);
  const logoDataUri = await loadLogoDataUri();
  const generatedAt = new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium", timeStyle: "short" }).format(new Date());
  const studentLabel = student.name?.trim() || `Estudante ${student.studentNumber}`;

  const logoHtml = logoDataUri
    ? `<img src="${logoDataUri}" alt="UOR Connect" class="brand-logo" />`
    : `<div class="brand-fallback"><strong>UOR Connect</strong></div>`;

  const html = `<!doctype html>
<html lang="pt-AO">
<head>
<meta charset="utf-8" />
<title>Manual do Desafio · ${escapeHtml(eventName)}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { color: #152434; font-family: Inter, "SF Pro Text", "Helvetica Neue", Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  /* ── Page layout ── */
  .page { width: 210mm; min-height: 297mm; padding: 14mm 15mm 12mm; position: relative; overflow: hidden; background: linear-gradient(180deg, #fffdfa 0%, #fff 44%, #f8fbfa 100%); page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .page::before { content: ""; position: absolute; inset: 0 0 auto 0; height: 5mm; background: linear-gradient(90deg, #fd8305 0%, #223d42 72%, #4aa391 100%); }
  .page::after { content: ""; position: absolute; left: 15mm; right: 15mm; top: 11mm; height: 1px; background: rgba(34,61,66,.08); }
  .page-content { position: relative; z-index: 1; height: calc(297mm - 26mm); display: flex; flex-direction: column; }

  /* ── Header ── */
  .header { display: flex; align-items: flex-start; justify-content: space-between; gap: 10mm; padding-top: 6mm; }
  .brand-logo { width: 43mm; max-height: 20mm; object-fit: contain; display: block; }
  .brand-fallback { font-size: 18px; font-weight: 900; color: #223d42; }
  .doc-kicker { text-align: right; color: #61707f; font-size: 10px; line-height: 1.45; }
  .doc-kicker strong { display: block; color: #152434; font-size: 12px; font-weight: 750; }

  /* ── Typography ── */
  h1, h2, h3, p { margin: 0; }
  .eyebrow { margin: 0 0 3mm; color: #fd8305; font-size: 10px; font-weight: 800; letter-spacing: 0; text-transform: uppercase; }

  /* ── Hero ── */
  .hero-section { margin-top: 12mm; }
  .hero-section h1 { font-size: 26px; line-height: 1.12; font-weight: 830; color: #152434; }
  .hero-section .lead { margin-top: 4mm; color: #344958; font-size: 12px; line-height: 1.55; max-width: 155mm; }

  /* ── Info boxes ── */
  .info-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; margin-top: 8mm; }
  .info-box { border-top: 1.5px solid #dbe5e3; padding-top: 2.5mm; }
  .info-box span { display: block; color: #61707f; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
  .info-box strong { display: block; margin-top: 1mm; font-size: 11px; line-height: 1.3; font-weight: 730; color: #152434; word-break: break-word; }

  /* ── Section cards ── */
  .section-card { margin-top: 6mm; border: 1px solid #dbe5e3; border-radius: 4mm; padding: 4.5mm 5mm; background: #fbfdfc; }
  .section-card h2 { font-size: 14px; font-weight: 800; color: #152434; margin-bottom: 2.5mm; }
  .section-card h3 { font-size: 11px; font-weight: 750; color: #223d42; margin: 3mm 0 1.5mm; }
  .section-card p, .section-card li { color: #344958; font-size: 10px; line-height: 1.5; }
  .section-card ol, .section-card ul { margin: 1.5mm 0 0; padding-left: 5mm; }
  .section-card li { margin-bottom: 1mm; }

  /* ── Steps numbered ── */
  .step-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 2.5mm; margin-top: 3mm; }
  .step { border: .3mm solid rgba(34,61,66,.08); border-radius: 3.5mm; padding: 3.5mm; background: #fff; }
  .step-num { display: inline-block; width: 6mm; height: 6mm; line-height: 6mm; text-align: center; border-radius: 1.5mm; background: #223d42; color: #fff; font-size: 8px; font-weight: 900; margin-bottom: 1.5mm; }
  .step h3 { margin: 0 0 1mm; font-size: 11px; font-weight: 780; color: #152434; }
  .step p { margin: 0; color: #344958; font-size: 9.5px; line-height: 1.45; }

  /* ── Scoring table ── */
  .score-table { width: 100%; border-collapse: collapse; margin-top: 4mm; font-size: 10px; }
  .score-table th { text-align: left; padding: 2.5mm 3mm; background: #223d42; color: #fff; font-weight: 750; font-size: 9px; letter-spacing: .04em; text-transform: uppercase; }
  .score-table th:last-child { text-align: right; }
  .score-table td { padding: 2.5mm 3mm; border-bottom: 1px solid #e2ebe9; color: #344958; font-size: 10.5px; }
  .score-table td:last-child { text-align: right; font-weight: 750; color: #152434; }
  .score-table tr:last-child td { border-bottom: none; }
  .score-table .highlight td { background: #fff7ed; }
  .score-table .total td { background: #223d42; color: #fff; font-weight: 800; font-size: 11px; }
  .score-table .total td:last-child { color: #fd8305; }

  /* ── Footer ── */
  .page-footer { margin-top: auto; padding-top: 5mm; border-top: 1px solid #dbe5e3; display: flex; justify-content: space-between; align-items: flex-end; color: #61707f; font-size: 8.5px; }
  .page-footer strong { color: #152434; }

  /* ── Page 2 specifics ── */
  .rules-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 3.5mm; margin-top: 4mm; }
  .rule-card { border: .3mm solid rgba(34,61,66,.08); border-radius: 4mm; padding: 4mm; background: #fff; min-height: 28mm; }
  .rule-card .rule-label { display: block; color: #fd8305; font-size: 8px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; margin-bottom: 1.5mm; }
  .rule-card h3 { margin: 0 0 1.5mm; font-size: 12px; font-weight: 780; color: #152434; }
  .rule-card p { margin: 0; color: #344958; font-size: 10px; line-height: 1.5; }

  .important-box { margin-top: 6mm; border: 1px solid #fd830540; border-radius: 4mm; padding: 4.5mm 5mm; background: #fff7ed; }
  .important-box h3 { color: #9a3412; font-size: 12px; font-weight: 800; margin-bottom: 2mm; }
  .important-box p { color: #78350f; font-size: 10px; line-height: 1.55; }
  .important-box ul { margin: 2mm 0 0; padding-left: 4.5mm; }
  .important-box li { color: #78350f; font-size: 10px; line-height: 1.55; margin-bottom: 1mm; }
</style>
</head>
<body>

  <!-- ══════════ PAGE 1 — Visão Geral ══════════ -->
  <section class="page">
    <div class="page-content">
      <header class="header">
        <div>${logoHtml}</div>
        <div class="doc-kicker">
          <strong>Manual do Desafio</strong>
          Passaporte Digital UOR Connect
        </div>
      </header>

      <div class="hero-section">
        <p class="eyebrow">Guia oficial do participante</p>
        <h1>Desafio UOR Connect — Passaporte Digital</h1>
        <p class="lead">Este documento organiza a jornada por temas: sequência de participação, tipos de QR Code, pontuação, regras, normas de conduta e casos de dúvida. Usa-o para saber o que fazer em cada momento sem repetir ações desnecessárias.</p>
      </div>

      <div class="info-strip">
        <div class="info-box"><span>Participante</span><strong>${escapeHtml(studentLabel)}</strong></div>
        <div class="info-box"><span>Número</span><strong>${escapeHtml(student.studentNumber)}</strong></div>
        <div class="info-box"><span>Curso</span><strong>${escapeHtml(student.course || "Por confirmar")}</strong></div>
        <div class="info-box"><span>Evento</span><strong>${escapeHtml(eventName)}</strong></div>
      </div>

      <!-- Visão geral da jornada -->
      <div class="section-card">
        <p class="eyebrow">Visão geral</p>
        <h2>Sequência base da jornada</h2>
        <div class="step-grid">
          <div class="step">
            <div class="step-num">01</div>
            <h3>Aceita o desafio</h3>
            <p>Na Minha Área do UOR Connect, ativa o Passaporte Digital para entrar no ranking e receber os primeiros pontos.</p>
          </div>
          <div class="step">
            <div class="step-num">02</div>
            <h3>Faz check-in no evento</h3>
            <p>Na entrada da feira, escaneia o QR oficial. Este scan confirma a tua presença e desbloqueia as restantes missões.</p>
          </div>
          <div class="step">
            <div class="step-num">03</div>
            <h3>Participa em workshops</h3>
            <p>Escaneia o QR da sala quando participares num workshop ou palestra validada pela organização.</p>
          </div>
          <div class="step">
            <div class="step-num">04</div>
            <h3>Visita os stands</h3>
            <p>Escaneia o QR do stand para registar a visita ao projeto ou expositor correspondente.</p>
          </div>
          <div class="step">
            <div class="step-num">05</div>
            <h3>Responde aos desafios</h3>
            <p>Quando o expositor tiver desafio, lê a pergunta no ecrã e responde dentro das tentativas disponíveis.</p>
          </div>
          <div class="step">
            <div class="step-num">06</div>
            <h3>Faz networking</h3>
            <p>Escaneia o QR pessoal de um estudante de outro curso para validar a interação entre participantes.</p>
          </div>
        </div>
        <p style="margin-top: 3mm; color: #61707f; font-size: 9px; font-style: italic;">Nota: depois do check-in, as missões de workshop, stand, desafio e networking podem acontecer em qualquer ordem, desde que a aplicação confirme cada resultado.</p>
      </div>

      <div class="page-footer">
        <span>${escapeHtml(eventName)} · ${escapeHtml(eventDate)} · ${escapeHtml(eventLocation)}</span>
        <span>Página <strong>1</strong> de <strong>5</strong></span>
      </div>
    </div>
  </section>

  <!-- ══════════ PAGE 2 — Pontuação e Tipos de QR ══════════ -->
  <section class="page">
    <div class="page-content">
      <header class="header">
        <div>${logoHtml}</div>
        <div class="doc-kicker">
          <strong>Pontuação e QR Codes</strong>
          Passaporte Digital UOR Connect
        </div>
      </header>

      <!-- Tabela de pontuação -->
      <div class="section-card" style="margin-top: 14mm;">
        <p class="eyebrow">Pontuação oficial</p>
        <h2>Tabela de pontos por ação</h2>
        <table class="score-table">
          <thead><tr><th>Ação</th><th>Pontos</th></tr></thead>
          <tbody>
            <tr><td>Aceitar o desafio (ativar passaporte)</td><td>+10 pts</td></tr>
            <tr><td>Check-in geral no evento</td><td>+10 pts</td></tr>
            <tr><td>Check-in em workshop ou palestra</td><td>+20 pts</td></tr>
            <tr><td>Visita a stand / projeto</td><td>+10 pts</td></tr>
            <tr class="highlight"><td>Desafio do expositor (resposta correta)</td><td>+15 pts</td></tr>
            <tr><td>Networking com estudante de outro curso</td><td>+10 pts</td></tr>
            <tr class="highlight"><td>Jornada completa</td><td>+30 pts</td></tr>
            <tr><td>QR surpresa (efeito revelado no scan)</td><td>Variável</td></tr>
          </tbody>
        </table>
      </div>

      <!-- Tipos de QR -->
      <div class="section-card">
        <p class="eyebrow">Tipos de QR Code</p>
        <h2>O que cada QR faz na feira</h2>
        <div class="rules-grid">
          <div class="rule-card">
            <span class="rule-label">Entrada</span>
            <h3>QR do evento</h3>
            <p>Fica na receção principal. Confirma a tua presença geral e desbloqueia as missões do Passaporte. Pontua apenas uma vez.</p>
          </div>
          <div class="rule-card">
            <span class="rule-label">Workshop</span>
            <h3>QR de workshop / palestra</h3>
            <p>Fica na entrada do auditório ou sala. Pontua uma vez por atividade e pode ter janela de horário definida pela organização.</p>
          </div>
          <div class="rule-card">
            <span class="rule-label">Stand</span>
            <h3>QR do stand / projeto</h3>
            <p>Regista a visita ao stand. Não abre pergunta de quiz. Pontua uma vez por stand visitado.</p>
          </div>
          <div class="rule-card">
            <span class="rule-label">Desafio</span>
            <h3>QR do expositor</h3>
            <p>Abre a pergunta criada pelo expositor. Só ganhas pontos se a resposta estiver correta. As tentativas são limitadas.</p>
          </div>
          <div class="rule-card">
            <span class="rule-label">Networking</span>
            <h3>QR pessoal do estudante</h3>
            <p>Cada estudante tem um QR pessoal. Pontua se os dois estudantes forem de cursos diferentes. O mesmo par só pontua uma vez.</p>
          </div>
          <div class="rule-card">
            <span class="rule-label">Surpresa</span>
            <h3>QR surpresa pela feira</h3>
            <p>QR escondidos em locais estratégicos. O efeito só aparece depois da leitura no Passaporte Digital. Cada QR conta uma vez.</p>
          </div>
        </div>
      </div>

      <div class="page-footer">
        <span>${escapeHtml(eventName)} · ${escapeHtml(eventDate)} · ${escapeHtml(eventLocation)}</span>
        <span>Página <strong>2</strong> de <strong>5</strong></span>
      </div>
    </div>
  </section>

  <!-- ══════════ PAGE 3 — Regras, Mapa e Prémio ══════════ -->
  <section class="page">
    <div class="page-content">
      <header class="header">
        <div>${logoHtml}</div>
        <div class="doc-kicker">
          <strong>Regras e Prémio</strong>
          Passaporte Digital UOR Connect
        </div>
      </header>

      <!-- Regras importantes -->
      <div class="important-box" style="margin-top: 14mm;">
        <h3>Validação, ranking e segurança</h3>
        <ul>
          <li>Não podes escanear o teu próprio QR de networking.</li>
          <li>Scans repetidos no mesmo QR não dão pontos adicionais.</li>
          <li>O QR surpresa só revela o efeito depois do scan e nunca deixa a pontuação total abaixo de zero.</li>
          <li>Qualquer ajuste de QR surpresa incide na pontuação total do Passaporte, sem saldo paralelo.</li>
          <li>A organização pode pausar qualquer QR durante o evento.</li>
          <li>O ranking é auditável — toda pontuação tem registo com data e hora.</li>
        </ul>
      </div>

      <!-- Como ler o mapa -->
      <div class="section-card">
        <p class="eyebrow">Mapa da jornada</p>
        <h2>Como ler a rota na Minha Área</h2>
        <ol>
          <li><strong>Numeração</strong> — Cada missão tem um número de ordem. Segue a sequência para desbloqueares a jornada.</li>
          <li><strong>Missão ativa</strong> — O ícone laranja indica a próxima ação recomendada.</li>
          <li><strong>Missão concluída</strong> — O ícone escuro com visto confirma que já completaste essa etapa.</li>
          <li><strong>Missão bloqueada</strong> — Aparece desbotada. Depende de uma ação anterior ou de um QR ainda não validado.</li>
          <li><strong>Resumo de pontos</strong> — No final do mapa vês o total disponível, os pontos ganhos e os efeitos de QR surpresa.</li>
        </ol>
      </div>

      <!-- Prémio -->
      <div class="section-card">
        <p class="eyebrow">Prémio oficial</p>
        <h2>O que ganha o vencedor</h2>
        <p>O estudante com mais pontos no ranking final recebe o <strong>pagamento de 1 recurso no 2.º semestre</strong>, perfis de 1 mês de <strong style="color:#00A8E1;">Prime Video</strong>, <strong style="color:#7B2CBF;">HBO</strong> e <strong style="color:#58CC02;">Duolingo Super</strong>. O <strong>Certificado Top 3</strong> distingue os melhores classificados. Em caso de empate, o critério é: maior diversidade de missões, depois maior número de workshops, depois menor horário de conclusão.</p>
      </div>

      <div class="page-footer">
        <span>${escapeHtml(eventName)} · ${escapeHtml(eventDate)} · ${escapeHtml(eventLocation)}</span>
        <span>Página <strong>3</strong> de <strong>5</strong></span>
      </div>
    </div>
  </section>

  <!-- ══════════ PAGE 4 — Normas e Suporte ══════════ -->
  <section class="page">
    <div class="page-content">
      <header class="header">
        <div>${logoHtml}</div>
        <div class="doc-kicker">
          <strong>Normas e Suporte</strong>
          Passaporte Digital UOR Connect
        </div>
      </header>

      <div class="section-card" style="margin-top: 14mm;">
        <p class="eyebrow">Normas do participante</p>
        <h2>O que deves, podes e não deves fazer</h2>
        <div class="rules-grid">
          <div class="rule-card">
            <span class="rule-label">Deves</span>
            <h3>O que deves fazer</h3>
            <p>Participa presencialmente, respeita horários e filas, segue as instruções no ecrã e confirma a mensagem mostrada depois de cada scan.</p>
          </div>
          <div class="rule-card">
            <span class="rule-label">Podes</span>
            <h3>O que podes fazer</h3>
            <p>Usar o código manual quando a organização autorizar, pedir ajuda à equipa de apoio e alternar entre atividades depois do check-in.</p>
          </div>
          <div class="rule-card">
            <span class="rule-label">Não deves</span>
            <h3>O que não deves fazer</h3>
            <p>Escanear o teu próprio QR pessoal, partilhar códigos fora do contexto, usar QR de atividade não frequentada ou tentar alterar um QR.</p>
          </div>
          <div class="rule-card">
            <span class="rule-label">Suporte</span>
            <h3>Quando pedir apoio</h3>
            <p>Pede apoio se a aplicação mostrar resultado incoerente, se um QR oficial estiver ilegível ou se uma missão concluída não aparecer no mapa.</p>
          </div>
        </div>
      </div>

      <div class="important-box">
        <h3>Se algo falhar</h3>
        <ul>
          <li>Se a câmara não ler o QR, usa o campo manual quando a organização disponibilizar o código.</li>
          <li>Se o QR estiver pausado, fora do horário ou já usado, a aplicação mostra a razão e não atribui pontos adicionais.</li>
          <li>Se a tua internet falhar, espera a página confirmar o resultado antes de repetir a ação.</li>
          <li>Se a mensagem parecer incorreta, procura a equipa de apoio antes de abandonar a atividade.</li>
        </ul>
      </div>

      <div class="page-footer">
        <span>${escapeHtml(eventName)} · ${escapeHtml(eventDate)} · ${escapeHtml(eventLocation)}</span>
        <span>Página <strong>4</strong> de <strong>5</strong></span>
      </div>
    </div>
  </section>

  <!-- ══════════ PAGE 5 — Casos de Dúvida ══════════ -->
  <section class="page">
    <div class="page-content">
      <header class="header">
        <div>${logoHtml}</div>
        <div class="doc-kicker">
          <strong>Casos de Dúvida</strong>
          Passaporte Digital UOR Connect
        </div>
      </header>

      <div class="section-card" style="margin-top: 14mm;">
        <p class="eyebrow">Casos práticos</p>
        <h2>Casos que mais geram dúvida</h2>
        <div class="rules-grid">
          <div class="rule-card">
            <span class="rule-label">Stand</span>
            <h3>QR do stand e QR do expositor</h3>
            <p>O primeiro regista a visita ao stand; o segundo abre a pergunta do desafio criada pelo expositor.</p>
          </div>
          <div class="rule-card">
            <span class="rule-label">Desafio</span>
            <h3>Tentativas do desafio</h3>
            <p>Lê a indicação no ecrã antes de responder; ao esgotar tentativas, esse desafio deixa de pontuar.</p>
          </div>
          <div class="rule-card">
            <span class="rule-label">Networking</span>
            <h3>Interação entre cursos</h3>
            <p>Só conta com estudante de outro curso, e o mesmo par pontua apenas uma vez no ranking.</p>
          </div>
          <div class="rule-card">
            <span class="rule-label">Bloqueio</span>
            <h3>QR pausado ou usado</h3>
            <p>Se a aplicação bloquear a leitura, lê a razão indicada e pede apoio caso a situação pareça incorreta.</p>
          </div>
          <div class="rule-card">
            <span class="rule-label">Jornada</span>
            <h3>Jornada completa</h3>
            <p>A pontuação de jornada completa exige check-in, workshop, stand, desafio e networking concluídos com confirmação na aplicação.</p>
          </div>
          <div class="rule-card">
            <span class="rule-label">Surpresa</span>
            <h3>QR surpresa</h3>
            <p>Conta como efeito extra revelado no ecrã. Ele não valida presença, atividade frequentada nem interação obrigatória.</p>
          </div>
        </div>
      </div>

      <div class="important-box">
        <h3>Dúvidas rápidas</h3>
        <ul>
          <li><strong>Resultado no ecrã:</strong> missão concluída, pontos atribuídos ou motivo de bloqueio devem aparecer na aplicação.</li>
          <li><strong>Ranking:</strong> todos os pontos ficam associados ao participante, ao QR utilizado e à data da validação.</li>
          <li><strong>Apoio:</strong> procura a equipa no momento da atividade quando a leitura não corresponder ao que aconteceu.</li>
          <li><strong>QR surpresa não substitui:</strong> ele ajusta a pontuação no ecrã e não substitui check-in, workshop, stand, desafio nem networking.</li>
        </ul>
      </div>

      <div class="page-footer">
        <span>Gerado em ${escapeHtml(generatedAt)} · Este manual não substitui as regras oficiais publicadas pela organização.</span>
        <span>Página <strong>5</strong> de <strong>5</strong></span>
      </div>
    </div>
  </section>

</body>
</html>`;

  return renderPdfFromHtml(html, {
    preferCssPageSize: true,
    displayHeaderFooter: false,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
  });
}
