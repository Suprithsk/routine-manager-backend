import express from "express";
import authRoutes from "./routes/authRoutes";
import challengeRoutes from "./routes/challengeRoutes";
import userChallengeRoutes from "./routes/userChallengeRoutes";
import habitRoutes from "./routes/habitRoutes";

const app = express();
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/challenges", challengeRoutes);
app.use("/api/my-challenges", userChallengeRoutes);
app.use("/api/habits", habitRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

export default app;