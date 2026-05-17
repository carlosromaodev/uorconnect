import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderQrDataUri } from "../shared/qr";
import { loadLogoDataUri, renderPdfFromHtml } from "../modules/reports/http/pdf-report.utils";
import {
  buildCredentialPassBatchHtml,
  credentialThemeForMember,
  type CredentialPassOptions,
  type EventTeamCredentialRecord,
} from "../modules/team-credentials/http/team-credentials.routes";

type SamplePassInput = {
  category: string;
  team: string;
  role: string;
  accessLevel: string;
  name: string;
  organization?: string | null;
  course?: string | null;
  sourceSubmissionName?: string | null;
  sourceSubmissionType?: string | null;
  sourceSubmissionArea?: string | null;
};

function parseArgs(argv: string[]) {
  const outputArg = argv.find((arg) => arg.startsWith("--output="));
  const printModeArg = argv.find((arg) => arg.startsWith("--print-mode="));
  const layoutArg = argv.find((arg) => arg.startsWith("--layout="));
  const limitArg = argv.find((arg) => arg.startsWith("--limit="));
  const output = outputArg?.split("=")[1] ?? "storage/samples/passes-modelo-categorias-areas.pdf";
  const printMode = printModeArg?.split("=")[1] === "black-white" ? "black-white" : "color";
  const requestedLayout = layoutArg?.split("=")[1];
  const layout = requestedLayout === "a4-2up-landscape"
    ? "a4-2up-landscape"
    : requestedLayout === "a4-4up"
      ? "a4-4up"
      : requestedLayout === "a4-3up"
        ? "a4-3up"
        : "single";
  const limit = Math.max(1, Math.min(100, Number(limitArg?.split("=")[1] ?? 100)));
  return { output, printMode, layout, limit } as const;
}

function sampleMember(input: SamplePassInput, index: number): EventTeamCredentialRecord {
  const issuedAt = new Date("2026-05-09T10:00:00.000Z");
  const expiresAt = new Date("2026-12-31T23:59:59.000Z");
  const slug = `amostra-${input.category.toLowerCase()}-${String(index).padStart(2, "0")}`;

  return {
    id: index,
    teamMembershipId: null,
    token: `sample-token-${index}`,
    publicSlug: slug,
    category: input.category,
    team: input.team,
    role: input.role,
    accessLevel: input.accessLevel,
    permissions: "",
    status: "PROFILE_READY",
    name: input.name,
    email: null,
    phone: null,
    course: input.course ?? "Engenharia Informática",
    organization: input.organization ?? "Universidade Óscar Ribas",
    bio: null,
    photoUrl: null,
    address: null,
    instagramUrl: null,
    facebookUrl: null,
    linkedinUrl: null,
    githubUrl: null,
    websiteUrl: null,
    consentPhotoCredential: true,
    consentPublicProfile: true,
    consentSocialLinks: false,
    consentSms: false,
    consentWhatsapp: false,
    sourceSubmissionId: input.category === "EXPOSITOR" ? index : null,
    sourceSubmissionRef: input.category === "EXPOSITOR" ? `EXP-${String(index).padStart(3, "0")}` : null,
    sourceSubmissionName: input.sourceSubmissionName ?? null,
    sourceSubmissionType: input.sourceSubmissionType ?? null,
    sourceSubmissionArea: input.sourceSubmissionArea ?? null,
    notes: "Amostra visual gerada para validação de design.",
    createdByStudentNumber: "000000000000",
    issuedAt,
    issuedByStudentNumber: "000000000000",
    issuedSnapshotJson: null,
    invitationExpiresAt: null,
    expiresAt,
    revokedAt: null,
    revokedReason: null,
    version: 1,
    reissuedFromId: null,
    submittedAt: issuedAt,
    lastPassIssuedAt: null,
    lastPassSnapshotJson: null,
    createdAt: issuedAt,
    updatedAt: issuedAt,
  };
}

const nucleusAreaSamples: SamplePassInput[] = [
  { category: "NUCLEO", team: "Presidência e Governança", role: "Presidente", accessLevel: "Direção", name: "Ana Governança" },
  { category: "NUCLEO", team: "Secretaria Geral", role: "Secretário(a)-geral", accessLevel: "Secretaria", name: "Bruno Secretaria" },
  { category: "NUCLEO", team: "Tesouraria e Património", role: "Tesoureiro(a)", accessLevel: "Tesouraria", name: "Carla Tesouraria" },
  { category: "NUCLEO", team: "Assuntos Académicos e Formação", role: "Coordenador(a) de área", accessLevel: "Coordenação", name: "Daniel Formação" },
  { category: "NUCLEO", team: "Tecnologia, Sistemas e Dados", role: "Coordenador técnico", accessLevel: "Coordenação técnica", name: "Elisa Tecnologia" },
  { category: "NUCLEO", team: "Comunicação, Imagem e Media", role: "Coordenador(a) de comunicação", accessLevel: "Comunicação", name: "Fábio Media" },
  { category: "NUCLEO", team: "Eventos, Projetos e Inovação", role: "Líder de projeto", accessLevel: "Liderança operacional", name: "Graça Eventos" },
  { category: "NUCLEO", team: "Relações Institucionais e Parcerias", role: "Representante externo", accessLevel: "Representação externa", name: "Hugo Parcerias" },
  { category: "NUCLEO", team: "Logística, Protocolo e Operações", role: "Coordenador(a) de operações", accessLevel: "Operação do evento", name: "Inês Logística" },
  { category: "NUCLEO", team: "Apoio Operacional", role: "Membro de apoio", accessLevel: "Operação pontual", name: "João Apoio" },
];

const categorySamples: SamplePassInput[] = [
  {
    category: "EXPOSITOR",
    team: "Expositores",
    role: "Projeto",
    accessLevel: "Expositor",
    name: "Lara Expositora",
    organization: "Smart Campus Lab",
    sourceSubmissionName: "SmartCampus Demo",
    sourceSubmissionType: "PROJECT",
    sourceSubmissionArea: "IoT",
  },
  { category: "JURI", team: "Júri", role: "Avaliador técnico", accessLevel: "Júri", name: "Miguel Júri", organization: "Painel de Avaliação" },
  { category: "PALESTRANTE", team: "Palestrantes", role: "Orador convidado", accessLevel: "Palco", name: "Nádia Palestrante", organization: "Tech Angola" },
  { category: "MESTRE_CERIMONIA", team: "Cerimónia", role: "Mestre de cerimónia", accessLevel: "Palco", name: "Otávio Cerimónia" },
  { category: "PROTOCOLO", team: "Protocolo", role: "Acolhimento", accessLevel: "Receção", name: "Paula Protocolo" },
  { category: "MARKETING", team: "Marketing", role: "Cobertura digital", accessLevel: "Media", name: "Quénia Marketing" },
  { category: "LOGISTICA", team: "Logística", role: "Operações", accessLevel: "Backstage", name: "Rui Logística" },
  { category: "RELACOES_INTERNAS", team: "Relações Internas", role: "Coordenação interna", accessLevel: "Equipa", name: "Sofia Internas" },
  { category: "RELACOES_EXTERNAS", team: "Relações Externas", role: "Parceiros", accessLevel: "Representação", name: "Tomás Externas" },
  { category: "EXPLICADORES", team: "Explicadores", role: "Mentor académico", accessLevel: "Apoio académico", name: "Úrsula Explicadora" },
  { category: "STAFF", team: "Staff", role: "Operação geral", accessLevel: "Staff", name: "Valter Staff" },
  { category: "OUTRO", team: "Operação UOR Connect", role: "Convidado operacional", accessLevel: "Acesso controlado", name: "Wanda Operação" },
];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputPath = path.resolve(process.cwd(), args.output);
  const options: CredentialPassOptions = {
    printMode: args.printMode,
    side: "both",
    layout: args.layout,
    duplexMode: "long-edge",
    marginMm: 18,
    bleedMm: 4,
    laminationMarginMm: 3,
  };

  const samples = [...nucleusAreaSamples, ...categorySamples].slice(0, args.limit).map(sampleMember);
  const siteUrl = "https://uorconnect.space";
  const [logoDataUri, frontQrDataUri] = await Promise.all([
    loadLogoDataUri(),
    renderQrDataUri(siteUrl, 720, { transparentBackground: true }),
  ]);
  const items = await Promise.all(samples.map(async (member) => {
    const profileUrl = `https://uorconnect.space/equipa/perfil/${encodeURIComponent(member.publicSlug)}`;
    return {
      member,
      siteUrl,
      profileUrl,
      template: credentialThemeForMember(member, null, options.printMode),
      frontQrDataUri,
      backQrDataUri: await renderQrDataUri(profileUrl, 720, { transparentBackground: true }),
      frontQrLabel: "QR do site UOR Connect",
      backQrLabel: "Perfil Público",
    };
  }));

  const html = buildCredentialPassBatchHtml({ items, logoDataUri, options });
  const buffer = await renderPdfFromHtml(html, {
    preferCssPageSize: true,
    displayHeaderFooter: false,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
  });

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, buffer);

  console.log(`PDF de amostra gerado: ${outputPath}`);
  console.log(`${samples.length} modelos · frente e verso · layout ${args.layout}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    process.exit(process.exitCode ?? 0);
  });
