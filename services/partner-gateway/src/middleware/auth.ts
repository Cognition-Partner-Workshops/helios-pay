import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const jwtSecret = process.env.HELIOS_JWT_SECRET ?? "local-development-only";

export function requireAuth(request: Request, response: Response, next: NextFunction): void {
  const authorization = request.header("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
  if (!token) {
    response.status(401).json({ error: "authentication required" });
    return;
  }
  try {
    jwt.verify(token, jwtSecret, { algorithms: ["HS256"], audience: "helios" });
    next();
  } catch {
    response.status(401).json({ error: "invalid authentication credentials" });
  }
}
