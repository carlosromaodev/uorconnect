import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FeaturedCourseCard } from "./FeaturedCourseCard";
import type { Course } from "@/lib/api";

const baseCourse: Course = {
  id: 9,
  name: "Engenharia Informática e Comunicações",
  description: "Curso oficial com foco em software e sistemas.",
  preview: "Prévia do curso",
  communityUrl: "https://chat.whatsapp.com/teste",
  companyName: "Parceiro Tech AO",
  companyCategory: "Tecnologia",
  companyLogoUrl: null,
  companyWebsite: "https://example.com",
  companyInstagram: null,
  companyLinkedin: null,
  isPaid: false,
  priceLabel: "Gratuito",
  studentCount: 42,
  likesCount: 7,
  accentColor: "#2563eb",
  accentColorSecondary: "#38bdf8",
  courseColor: "#2563eb",
  sortOrder: 0,
  isPublished: true,
  createdAt: "",
  updatedAt: "",
};

describe("FeaturedCourseCard", () => {
  it("desativa a inscrição quando a administração fecha o fluxo", () => {
    render(
      <FeaturedCourseCard
        course={baseCourse}
        liked={false}
        enrolled={false}
        enrollmentDisabled
        onEnroll={vi.fn()}
        onCommunity={vi.fn()}
        onLike={vi.fn()}
        onOpenExternal={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Inscrições fechadas" })).toBeDisabled();
    expect(screen.getByText("As inscrições neste momento foram desativadas pela administração.")).toBeInTheDocument();
  });

  it("mostra o recibo para quem já está inscrito", () => {
    const onEnroll = vi.fn();

    render(
      <FeaturedCourseCard
        course={baseCourse}
        liked
        enrolled
        enrollmentStatusLabel="Confirmado"
        onEnroll={onEnroll}
        onCommunity={vi.fn()}
        onLike={vi.fn()}
        onOpenExternal={vi.fn()}
      />
    );

    expect(screen.getByText("Confirmado")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver inscrição" }));
    expect(onEnroll).toHaveBeenCalledTimes(1);
  });
});
