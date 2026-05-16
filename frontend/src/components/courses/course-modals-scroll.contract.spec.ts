import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("course modals scroll behavior", () => {
  it("keeps course payment and certificate dialogs scrollable on short screens", () => {
    const paymentModal = readSource("src/components/courses/CoursePaymentModal.tsx");
    const certificateModal = readSource("src/components/admin/CourseCertificateAction.tsx");

    expect(paymentModal).toContain("max-h-[calc(100dvh-2rem)]");
    expect(paymentModal).toContain("overflow-y-auto");
    expect(paymentModal).toContain("overscroll-contain");
    expect(certificateModal).toContain("max-h-[calc(100dvh-2rem)]");
    expect(certificateModal).toContain("overflow-y-auto");
  });
});
