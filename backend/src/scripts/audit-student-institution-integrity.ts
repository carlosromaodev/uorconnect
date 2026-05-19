import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../shared/prisma";
import {
  auditStudentInstitutionIntegrity,
  detectStudentInstitutionIssues,
  extractRawStudentNumber,
  resolveStudentInstitutionFlag,
  type StudentInstitutionAudit,
  type StudentInstitutionAuditRow,
  type StudentInstitutionIssue,
} from "../modules/auth/domain/student-institution-integrity";

type ScriptOptions = {
  includeDeleted: boolean;
  outputDir: string;
};

function parseArgs(argv: string[]): ScriptOptions {
  const includeDeleted = argv.includes("--include-deleted");
  const outputArg = argv.find((arg) => arg.startsWith("--output-dir="));
  const defaultOutputDir = process.cwd().endsWith(`${path.sep}backend`)
    ? path.resolve(process.cwd(), "..", "tmp")
    : path.resolve(process.cwd(), "tmp");

  return {
    includeDeleted,
    outputDir: outputArg ? path.resolve(outputArg.split("=").slice(1).join("=")) : defaultOutputDir,
  };
}

function severityWeight(issue: StudentInstitutionIssue) {
  if (issue.severity === "CRITICAL") return 0;
  if (issue.severity === "HIGH") return 1;
  if (issue.severity === "MEDIUM") return 2;
  return 3;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Luanda",
  }).format(value);
}

function escapeCell(value: unknown) {
  return String(value ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\|/g, "\\|")
    .trim() || "-";
}

function buildIssueRows(issues: StudentInstitutionIssue[], studentsById: Map<number, StudentInstitutionAuditRow>) {
  return issues
    .slice()
    .sort((left, right) => severityWeight(left) - severityWeight(right) || left.studentNumber.localeCompare(right.studentNumber, "pt"))
    .map((issue) => {
      const student = studentsById.get(issue.studentId);
      return [
        issue.severity,
        issue.code,
        issue.institutionFlag,
        issue.studentNumber,
        issue.expectedStudentNumber ?? "-",
        student?.name ?? "-",
        student?.university ?? "-",
        student?.registrationSource ?? "-",
        issue.message,
      ];
    });
}

function markdownTable(headers: string[], rows: unknown[][]) {
  if (rows.length === 0) return "_Nenhum registo encontrado._";
  return [
    `| ${headers.map(escapeCell).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(escapeCell).join(" | ")} |`),
  ].join("\n");
}

function buildMarkdownReport(audit: StudentInstitutionAudit, students: StudentInstitutionAuditRow[]) {
  const studentsById = new Map(students.map((student) => [student.id, student]));
  const issueRows = buildIssueRows(audit.issues, studentsById);
  const sharedRows = audit.sharedIdentifiers.map((item) => [
    item.status,
    item.rawStudentNumber,
    item.institutions.join(" + "),
    item.studentNumbers.join(", "),
    item.studentIds.join(", "),
  ]);
  const sampleRows = students
    .slice()
    .sort((left, right) => {
      const leftFlag = resolveStudentInstitutionFlag(left);
      const rightFlag = resolveStudentInstitutionFlag(right);
      return leftFlag.localeCompare(rightFlag, "pt") || left.studentNumber.localeCompare(right.studentNumber, "pt");
    })
    .slice(0, 80)
    .map((student) => [
      resolveStudentInstitutionFlag(student),
      student.studentNumber,
      extractRawStudentNumber(student.studentNumber) ?? "-",
      student.name ?? "-",
      student.course ?? "-",
      student.university ?? "-",
      student.registrationSource ?? "-",
    ]);

  return `# Auditoria de Integridade Institucional dos Estudantes

Gerado em: ${formatDate(audit.generatedAt)}

## Resumo

- Total analisado: ${audit.totals.students}
- UOR: ${audit.totals.byInstitution.UOR}
- ISPTEC: ${audit.totals.byInstitution.ISPTEC}
- Desconhecidos: ${audit.totals.byInstitution.UNKNOWN}
- Problemas encontrados: ${audit.totals.issues}
- Críticos: ${audit.totals.criticalIssues}
- Altos: ${audit.totals.highIssues}
- Números partilhados entre instituições: ${audit.totals.sharedIdentifiers}
- Partilhados e separados corretamente: ${audit.totals.sharedIdentifiersSeparated}
- Partilhados que precisam de revisão: ${audit.totals.sharedIdentifiersNeedingReview}

## Regra de Separação Aplicada

- UOR oficial mantém o número académico cru, por exemplo \`20200477\`.
- ISPTEC oficial recebe escopo obrigatório, por exemplo \`ISPTEC-20200477\`.
- A origem institucional vem primeiro de \`registrationSource\`: \`SECRETARIA\` para UOR e \`ISPTEC_OFFICIAL\` para ISPTEC.
- A universidade e a flag \`isUorStudent\` servem como validação cruzada para detectar dados misturados.

## Problemas Encontrados

${markdownTable(
  ["Severidade", "Código", "Bandeira", "Número atual", "Número esperado", "Nome", "Universidade", "Origem", "Mensagem"],
  issueRows,
)}

## Números Iguais em Instituições Diferentes

Estes casos não são automaticamente erro. Quando aparecem como \`SEPARATED\`, significa que UOR e ISPTEC têm o mesmo número cru, mas as contas estão separadas por bandeira institucional.

${markdownTable(
  ["Estado", "Número cru", "Instituições", "Números na base", "IDs"],
  sharedRows,
)}

## Amostra Classificada

${markdownTable(
  ["Bandeira", "Número", "Número cru", "Nome", "Curso", "Universidade", "Origem"],
  sampleRows,
)}

## Próximo Passo Recomendado

1. Corrigir primeiro todos os itens \`CRITICAL\`, porque podem misturar identidades reais entre UOR e ISPTEC.
2. Rever \`HIGH\`, porque indicam contradição entre origem oficial, universidade e flag interna.
3. Tratar \`MEDIUM\` e \`LOW\` como limpeza de dados para melhorar filtros, relatórios e ODIN.
4. Não juntar contas só porque têm o mesmo número cru. A chave operacional deve ser sempre número + instituição.
`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const students = await prisma.student.findMany({
    where: options.includeDeleted ? undefined : { deletedAt: null },
    select: {
      id: true,
      studentNumber: true,
      name: true,
      course: true,
      university: true,
      registrationSource: true,
      isUorStudent: true,
      academicSyncedAt: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  const audit = auditStudentInstitutionIntegrity(students);
  const report = {
    ...audit,
    students: students.map((student) => ({
      ...student,
      rawStudentNumber: extractRawStudentNumber(student.studentNumber),
      institutionFlag: resolveStudentInstitutionFlag(student),
      issues: detectStudentInstitutionIssues(student).map((issue) => issue.code),
    })),
  };

  await mkdir(options.outputDir, { recursive: true });
  const jsonPath = path.join(options.outputDir, "student-institution-integrity-audit.json");
  const markdownPath = path.join(options.outputDir, "student-institution-integrity-audit.md");
  await Promise.all([
    writeFile(jsonPath, JSON.stringify(report, null, 2)),
    writeFile(markdownPath, buildMarkdownReport(audit, students)),
  ]);

  console.log(JSON.stringify({
    total: audit.totals.students,
    byInstitution: audit.totals.byInstitution,
    issues: audit.totals.issues,
    criticalIssues: audit.totals.criticalIssues,
    highIssues: audit.totals.highIssues,
    sharedIdentifiers: audit.totals.sharedIdentifiers,
    sharedIdentifiersNeedingReview: audit.totals.sharedIdentifiersNeedingReview,
    jsonPath,
    markdownPath,
  }, null, 2));
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("table `main.Student` does not exist") || message.includes("TableDoesNotExist")) {
      console.error(
        "Falha ao auditar integridade institucional dos estudantes: a base de dados configurada não tem a tabela Student. "
          + "Confirma DATABASE_URL/DATABASE_PROVIDER ou executa a auditoria apontando para a base local real.",
      );
    } else {
      console.error("Falha ao auditar integridade institucional dos estudantes.", error);
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
