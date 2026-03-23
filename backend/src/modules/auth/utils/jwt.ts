import jwt from "jsonwebtoken";
import { type Env } from "../../../config/env";

type JwtPayload = {
  sub: number;
  studentNumber: string;
};

export function signStudentToken(studentId: number, studentNumber: string, env: Env) {
  const payload: JwtPayload = { sub: studentId, studentNumber };
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "7d" });
}

export function verifyStudentToken(token: string, env: Env): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as unknown as JwtPayload;
}
