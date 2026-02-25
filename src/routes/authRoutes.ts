import { Router } from "express";
import {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  adminGetUsers,
} from "../controllers/authController";
import { validate } from "../middleware/validate";
import { authenticate, adminOnly } from "../middleware/auth";
import { authLimiter } from "../middleware/rateLimiter";
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  adminCreateUserSchema,
} from "../schemas/auth.schema";

const router = Router();

// Public routes (auth limiter: 10 req / 15 min)
router.post("/register", authLimiter, validate(registerSchema), register);
router.post("/login", authLimiter, validate(loginSchema), login);

// Protected routes (any authenticated user)
router.get("/me", authenticate, getMe);
router.put("/me", authenticate, validate(updateProfileSchema), updateProfile);
router.put("/change-password", authenticate, validate(changePasswordSchema), changePassword);

// Admin-only routes
// router.post("/admin/create-user", authenticate, adminOnly, validate(adminCreateUserSchema), adminCreateUser);
router.get("/admin/users", authenticate, adminOnly, adminGetUsers);

export default router;