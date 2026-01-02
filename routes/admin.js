import express from "express";
import bcrypt from "bcrypt";
import db from "../db.js";
import { verifyAdmin, verifySuperadmin } from "../middleware/auth.js";

const router = express.Router();

// GET all admins
router.get("/", verifyAdmin, verifySuperadmin, async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, email, role, created_at FROM admins"
    );
    res.json(result[0] || []);
  } catch (err) {
    console.error("Get admins error:", err);
    res.status(500).json({ msg: "Internal server error" });
  }
});

// POST new admin
router.post("/", verifyAdmin, verifySuperadmin, async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password || !role) {
    return res
      .status(400)
      .json({ msg: "Email, password, and role are required" });
  }

  try {
    // Check if email already exists
    const [existing] = await db.query("SELECT id FROM admins WHERE email = ?", [
      email,
    ]);
    if (existing.length) {
      return res.status(409).json({ msg: "Email already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert admin
    const [result] = await db.query(
      "INSERT INTO admins (email, password, role) VALUES (?, ?, ?)",
      [email, hashedPassword, role]
    );

    res.json({ msg: "Admin created", id: result.insertId });
  } catch (err) {
    console.error("Create admin error:", err);
    res.status(500).json({ msg: "Internal server error" });
  }
});

// DELETE admin
router.delete("/:id", verifyAdmin, verifySuperadmin, async (req, res) => {
  try {
    const [result] = await db.query("DELETE FROM admins WHERE id = ?", [
      req.params.id,
    ]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ msg: "Admin not found" });
    }
    res.json({ msg: "Admin deleted" });
  } catch (err) {
    console.error("Delete admin error:", err);
    res.status(500).json({ msg: "Internal server error" });
  }
});

export default router;
