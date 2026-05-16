import Decimal from "decimal.js";

export type ReportMetricSubmission = {
  statusLabel: string;
  paymentConfirmed: boolean;
  expectedAmount: number;
  collectedAmount: number;
  likesCount: number;
  votesCount: number;
  commentsCount: number;
};

export type ReportMetricCourse = {
  enrolledCount: number;
  confirmedCount: number;
  expectedTotal: number;
  totalCollected: number;
};

export type ChartInputRow = {
  label: string;
  amount: number;
  value: string;
  color: string;
};

function normalizeMoney(value: Decimal.Value) {
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

export function sumMoney(values: Decimal.Value[]) {
  const total = values.reduce<Decimal>((current, value) => current.plus(value), new Decimal(0));
  return normalizeMoney(total);
}

export function multiplyMoney(amount: Decimal.Value, quantity: number) {
  return normalizeMoney(new Decimal(amount).times(quantity));
}

export function percentOf(part: Decimal.Value, total: Decimal.Value) {
  const denominator = new Decimal(total);
  if (!denominator.isFinite() || denominator.lte(0)) return 0;

  const value = new Decimal(part)
    .div(denominator)
    .times(100)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

  return Decimal.max(0, Decimal.min(100, value)).toNumber();
}

export function parseReportMoney(value?: string | null) {
  const raw = (value ?? "")
    .replace(/AOA|KZ/gi, "")
    .replace(/\s+/g, "")
    .trim();

  if (!raw) return 0;

  const numeric = raw.replace(/[^\d,.-]/g, "");
  if (!numeric || numeric === "-" || numeric === "." || numeric === ",") return 0;

  const lastComma = numeric.lastIndexOf(",");
  const lastDot = numeric.lastIndexOf(".");
  const separator = Math.max(lastComma, lastDot);
  let normalized = numeric;

  if (separator >= 0) {
    const decimalDigits = numeric.length - separator - 1;
    const hasBothSeparators = lastComma >= 0 && lastDot >= 0;
    const isDecimalSeparator = decimalDigits > 0 && (decimalDigits <= 2 || hasBothSeparators);

    if (isDecimalSeparator) {
      normalized = `${numeric.slice(0, separator).replace(/[,.]/g, "")}.${numeric.slice(separator + 1)}`;
    } else {
      normalized = numeric.replace(/[,.]/g, "");
    }
  }

  try {
    const parsed = new Decimal(normalized.replace(/[^\d.-]/g, ""));
    return parsed.isFinite() ? normalizeMoney(parsed) : 0;
  } catch {
    return 0;
  }
}

export function buildBarChartRows(rows: ChartInputRow[]) {
  const maxAmount = rows.reduce(
    (max, row) => Decimal.max(max, new Decimal(row.amount || 0)),
    new Decimal(0),
  );

  return rows.map((row) => ({
    ...row,
    percent: row.amount > 0 ? Math.max(1, percentOf(row.amount, maxAmount)) : 0,
  }));
}

export function calculateOverviewReportMetrics(input: {
  submissions: ReportMetricSubmission[];
  courses: ReportMetricCourse[];
}) {
  const activeSubmissions = input.submissions.filter((submission) => submission.statusLabel !== "Recusado");
  const rejectedSubmissions = input.submissions.length - activeSubmissions.length;
  const paidSubmissions = activeSubmissions.filter((submission) => submission.paymentConfirmed).length;
  const approvedSubmissions = activeSubmissions.filter((submission) => submission.statusLabel === "Aprovado").length;
  const totalSubmissionExpected = sumMoney(activeSubmissions.map((submission) => submission.expectedAmount));
  const totalSubmissionCollected = sumMoney(activeSubmissions.map((submission) => submission.collectedAmount));
  const pendingFinancialCount = Math.max(0, activeSubmissions.length - paidSubmissions);
  const totalCourseEnrollments = input.courses.reduce((sum, course) => sum + course.enrolledCount, 0);
  const totalCourseConfirmed = input.courses.reduce((sum, course) => sum + course.confirmedCount, 0);
  const totalCourseExpected = sumMoney(input.courses.map((course) => course.expectedTotal));
  const totalCourseCollected = sumMoney(input.courses.map((course) => course.totalCollected));
  const totalInteractions = activeSubmissions.reduce(
    (sum, submission) => sum + submission.likesCount + submission.votesCount + submission.commentsCount,
    0,
  );
  const combinedExpected = sumMoney([totalSubmissionExpected, totalCourseExpected]);
  const combinedCollected = sumMoney([totalSubmissionCollected, totalCourseCollected]);

  return {
    activeSubmissions: activeSubmissions.length,
    rejectedSubmissions,
    paidSubmissions,
    approvedSubmissions,
    pendingFinancialCount,
    totalSubmissionExpected,
    totalSubmissionCollected,
    totalCourseEnrollments,
    totalCourseConfirmed,
    totalCourseExpected,
    totalCourseCollected,
    totalInteractions,
    combinedExpected,
    combinedCollected,
    approvalRatePercent: percentOf(approvedSubmissions, activeSubmissions.length),
    financialCoveragePercent: percentOf(combinedCollected, combinedExpected),
  };
}
