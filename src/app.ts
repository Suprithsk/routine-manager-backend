import express from "express";
import authRoutes from "./routes/authRoutes";
import challengeRoutes from "./routes/challengeRoutes";
import userChallengeRoutes from "./routes/userChallengeRoutes";
import habitRoutes from "./routes/habitRoutes";
import userHabitRoutes from "./routes/userHabitRoutes";
import userRoutes from "./routes/userRoutes";
import cors from "cors";
import { generalLimiter } from "./middleware/rateLimiter";

// Middleware

const app = express();

// Trust the first proxy hop so req.ip resolves to the real client IP
// (required for rate limiting to work correctly behind Nginx, cloud LBs, etc.)
app.set("trust proxy", 1);

app.use(express.json());
app.use(cors());
app.use("/api", generalLimiter);
// Routes
app.use("/api/auth", authRoutes);
app.use("/api/challenges", challengeRoutes);
app.use("/api/my-challenges", userChallengeRoutes);
app.use("/api/habits", habitRoutes);
app.use("/api/user-habits", userHabitRoutes);
app.use("/api/users", userRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

export default app;