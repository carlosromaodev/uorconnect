import { describe, expect, it } from "vitest";
import {
  OFFICIAL_COURSE_OPTIONS,
  getOfficialCourseFieldValue,
  getOfficialCourseSelectOptions,
  normalizeOfficialCourse,
} from "./official-courses";

describe("official-courses", () => {
  it("normaliza aliases conhecidos para o nome oficial do curso", () => {
    expect(normalizeOfficialCourse("Eng. Informática")).toBe("Engenharia Informática e Comunicações");
    expect(normalizeOfficialCourse("Licenciatura em Arquitetura e Urbanismo")).toBe("Arquitectura e Urbanismo");
    expect(normalizeOfficialCourse("Contabilidade e Auditoria")).toBe("Contabilidade e Finanças");
  });

  it("mantém o nome oficial já normalizado no campo", () => {
    expect(getOfficialCourseFieldValue(" Engenharia Civil ")).toBe("Engenharia Civil");
  });

  it("preserva um valor desconhecido para não esconder o autofill antes da correção", () => {
    expect(getOfficialCourseFieldValue("Curso Inventado")).toBe("Curso Inventado");
    expect(getOfficialCourseSelectOptions("Curso Inventado")[0]).toBe("Curso Inventado");
  });

  it("não duplica opções quando o valor já pertence à lista oficial", () => {
    expect(getOfficialCourseSelectOptions("Eng. Informática")).toEqual([...OFFICIAL_COURSE_OPTIONS]);
  });
});
