import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderUorEstudantePaymentReferencesPdf } from "../modules/secretaria/http/uor-estudante-finance-pdf";

async function main() {
  const outputDirectory = path.resolve(process.cwd(), "../docs/samples");
  const outputPath = path.join(outputDirectory, "uor-estudante-referencias-pagamento.pdf");
  const pdf = await renderUorEstudantePaymentReferencesPdf({
    student: {
      displayName: "Amélia Manuel da Silva",
      studentNumber: "20240000",
      course: "Engenharia Informática",
      academicYear: "2025/2026",
    },
    references: [
      {
        label: "Propina · Julho",
        description: "Prestação mensal do ano académico 2025/2026",
        entity: "00541",
        reference: "923 456 789",
        amount: "35 000,00 Kz",
        dueDate: "31 jul. 2026",
        issuedAt: "22 jul. 2026",
        state: "ACTIVE",
      },
      {
        label: "Recurso · Programação II",
        description: "Inscrição em exame de recurso",
        entity: "00541",
        reference: "814 052 397",
        amount: "7 500,00 Kz",
        dueDate: "25 jul. 2026",
        issuedAt: "22 jul. 2026",
        state: "ACTIVE",
      },
    ],
    generatedAt: "22 jul. 2026, 14:30",
    documentId: "UE-PAY-20260722-0001",
    totalLabel: "42 500,00 Kz",
    sourceLabel: "Secretaria Académica da Universidade Oscar Ribas",
  });

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputPath, pdf);
  pdf.fill(0);
  process.stdout.write(`${outputPath}\n`);
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
