import rateLimit from "express-rate-limit";
import { Request } from "express";

/**
 * Resolves the real client IP.
 * Falls back to a fixed key so the server never crashes if IP is missing,
 * though a proper `trust proxy` setting in app.ts should prevent that.
 */
const keyGenerator = (req: Request): string => {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.ip ||
    "unknown"
  );
};

// Auth routes — prevent brute force & account spam
// 20 req / 15 min per real IP (raised from 10 to handle shared carrier NAT IPs)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  keyGenerator,
  message: { error: "Too many auth attempts. Please try again after 15 minutes." },
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: (req) => !req.ip && !req.headers["x-forwarded-for"], // never block if IP unresolvable
});

// Write operations (POST/PUT/DELETE) — prevents DB flooding
// 100 req / min per real IP
export const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  keyGenerator,
  message: { error: "Too many write requests. Please slow down." },
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

// General read/global fallback — broad protection
// 300 req / min per real IP
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  keyGenerator,
  message: { error: "Too many requests. Please slow down." },
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
