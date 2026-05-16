import jwt from "jsonwebtoken";
import { type Env } from "../../../config/env";

type StudentJwtPayload = {
  sub: number;
  studentNumber: string;
  role: "student";
};

type JuryJwtPayload = {
  sub: number;
  juryPhone: string;
  role: "jury";
};

type TrainerJwtPayload = {
  sub: number;
  trainerPhone: string;
  role: "trainer";
};

type JwtPayload = StudentJwtPayload | JuryJwtPayload | TrainerJwtPayload;

export function signStudentToken(studentId: number, studentNumber: string, env: Env) {
  const payload: StudentJwtPayload = { sub: studentId, studentNumber, role: "student" };
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "7d" });
}

export function signJuryToken(juryMemberId: number, juryPhone: string, env: Env) {
  const payload: JuryJwtPayload = { sub: juryMemberId, juryPhone, role: "jury" };
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "7d" });
}

export function signTrainerToken(trainerRequestId: number, trainerPhone: string, env: Env) {
  const payload: TrainerJwtPayload = { sub: trainerRequestId, trainerPhone, role: "trainer" };
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "7d" });
}

export function verifyAuthToken(token: string, env: Env): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as unknown as JwtPayload;
}

export function verifyStudentToken(token: string, env: Env): StudentJwtPayload {
  const payload = verifyAuthToken(token, env);
  if (payload.role !== "student" || !("studentNumber" in payload)) {
    throw new Error("Invalid student token");
  }
  return payload;
}

export function verifyJuryToken(token: string, env: Env): JuryJwtPayload {
  const payload = verifyAuthToken(token, env);
  if (payload.role !== "jury" || !("juryPhone" in payload)) {
    throw new Error("Invalid jury token");
  }
  return payload;
}

export function verifyTrainerToken(token: string, env: Env): TrainerJwtPayload {
  const payload = verifyAuthToken(token, env);
  if (payload.role !== "trainer" || !("trainerPhone" in payload)) {
    throw new Error("Invalid trainer token");
  }
  return payload;
}
