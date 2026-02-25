import rateLimit from "express-rate-limit";

// Auth routes — strict to prevent brute force & account spam
// 10 requests per 15 minutes per IP
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { error: "Too many auth attempts. Please try again after 15 minutes." },
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

// Write operations (POST/PUT/DELETE) — prevents DB flooding
// 60 requests per minute per IP
export const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  message: { error: "Too many write requests. Please slow down." },
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

// General read/global fallback — broad protection
// 200 requests per minute per IP
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 200,
  message: { error: "Too many requests. Please slow down." },
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
