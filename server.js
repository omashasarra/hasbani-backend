import express from "express";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import { fileURLToPath } from "url";

import productsRoutes from "./routes/products.js";
import adminRoutes from "./routes/admin.js";
import authRoutes from "./routes/auth.js";

dotenv.config();

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const corsOptions = {
  origin: [
    "https://hasbani-frontend-production.up.railway.app",
    "https://hasbani-frontend.up.railway.app",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "https://hasbani-backend-production.up.railway.app",
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

app.use(cors(corsOptions));

// JSON body parser
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Create uploads directory if it doesn't exist
const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  console.log("📁 Created uploads directory");
}

// Routes
app.use("/auth", authRoutes);
app.use("/products", productsRoutes);
app.use("/admin", adminRoutes);

app.get("/", (req, res) => {
  res.redirect("/health");
});

// Serve uploaded files
app.use("/uploads", express.static(UPLOADS_DIR));

// Health check endpoint for Railway
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    database: process.env.DB_NAME,
    environment: process.env.NODE_ENV,
  });
});

// Simple backend alive check
app.get("/debug", (req, res) => {
  res.json({
    message: "Backend is alive!",
    database: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      name: process.env.DB_NAME,
      connected: true,
    },
  });
});

// List uploads folder
app.get("/debug/uploads", (req, res) => {
  if (!fs.existsSync(UPLOADS_DIR)) {
    return res.json({ message: "Uploads folder does NOT exist!" });
  }

  const files = fs.readdirSync(UPLOADS_DIR);
  res.json({ message: "Uploads folder exists", files });
});

// Serve single image for debug
app.get("/debug/image/:filename", (req, res) => {
  const filePath = path.join(UPLOADS_DIR, req.params.filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send("File not found!");
  }

  res.sendFile(filePath);
});

// Railway requires listening on 0.0.0.0
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
});
