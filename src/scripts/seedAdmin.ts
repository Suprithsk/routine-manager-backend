import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import User from "../models/User";

// Load environment variables
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/routine_manager";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_NAME = process.env.ADMIN_NAME || "Admin";

async function seedAdmin() {
  try {
    // Validate env variables
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      console.error("Error: ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env");
      process.exit(1);
    }

    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    const existingAdmin = await User.findOne({ email: ADMIN_EMAIL });

    if (existingAdmin) {
      console.log("Admin already exists");
      process.exit(0);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, salt);

    await User.create({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: hashedPassword,
      role: "admin",
    });

    console.log("Admin created successfully");
    console.log(`Email: ${ADMIN_EMAIL}`);
    console.log("Password: [hidden]");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

seedAdmin();