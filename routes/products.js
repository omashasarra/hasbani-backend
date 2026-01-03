import express from "express";
import multer from "multer";
import fs from "fs";
import db from "../db.js";
import { verifyAdmin } from "../middleware/auth.js";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const UPLOADS_DIR = path.join(__dirname, "../uploads");
try {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
} catch (err) {
  console.warn("Uploads folder not created:", err);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    cb(
      null,
      file.originalname + "_" + Date.now() + path.extname(file.originalname)
    );
  },
});

const upload = multer({ storage });

router.get("/categories/:lang", verifyAdmin, async (req, res) => {
  const { lang } = req.params;
  const q = `
    SELECT c.id, ct.name
    FROM categories c
    LEFT JOIN category_translations ct
      ON c.id = ct.category_id AND ct.language = ?
  `;
  try {
    const [data] = await db.query(q, [lang]);
    res.json(data || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Database error", error: err });
  }
});

// GET PRODUCTS
router.get("/:lang", async (req, res) => {
  try {
    const { lang } = req.params;

    const [data] = await db.query(
      `
      SELECT p.id, p.image, p.category_id,
             en_pt.name AS enName, en_pt.description AS enDescription,
             ar_pt.name AS arName, ar_pt.description AS arDescription,
             ct.name AS category
      FROM products p
      LEFT JOIN product_translations en_pt
        ON p.id = en_pt.product_id AND en_pt.language = 'en'
      LEFT JOIN product_translations ar_pt
        ON p.id = ar_pt.product_id AND ar_pt.language = 'ar'
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN category_translations ct
        ON c.id = ct.category_id AND ct.language = ?
      `,
      [lang]
    );

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Database error", error: err });
  }
});

// ===== GET SINGLE PRODUCT =====
router.get("/:id/:lang", verifyAdmin, (req, res) => {
  const { id, lang } = req.params;
  const q = `
    SELECT p.id, p.image, p.category_id,
           pt.name, pt.description,
           ct.name AS category
    FROM products p
    JOIN product_translations pt
      ON p.id = pt.product_id AND pt.language = ?
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN category_translations ct
      ON c.id = ct.category_id AND ct.language = ?
    WHERE p.id = ?
  `;
  db.query(q, [lang, lang, id], (err, data) => {
    if (err) return res.status(500).json(err);
    if (!data.length)
      return res.status(404).json({ message: "Product not found" });
    res.json(data[0]);
  });
});

// ===== ADD CATEGORY =====
router.post("/categories/create", verifyAdmin, async (req, res) => {
  try {
    const { translations } = req.body;
    if (!translations || !translations.length) {
      return res.status(400).json({ message: "Translations required" });
    }

    // Insert new category (async/await)
    const [categoryResult] = await db.query(
      "INSERT INTO categories () VALUES ()"
    );
    const categoryId = categoryResult.insertId;

    // Prepare translations
    const translationValues = translations.map((t) => [
      categoryId,
      t.language,
      t.name,
    ]);

    // Insert translations
    await db.query(
      "INSERT INTO category_translations (category_id, language, name) VALUES ?",
      [translationValues]
    );

    res.json({ message: "Category added successfully", categoryId });
  } catch (err) {
    console.error("Add Category Error:", err);
    res.status(500).json({ message: "Failed to add category", error: err });
  }
});

// ===== ADD PRODUCT =====
router.post(
  "/create",
  verifyAdmin,
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "Image required" });

      const image = req.file.filename;
      const { category_id, translations } = req.body;
      const translationsData =
        typeof translations === "string"
          ? JSON.parse(translations)
          : translations;

      // Insert product
      const [result] = await db.query(
        "INSERT INTO products (image, category_id) VALUES (?, ?)",
        [image, category_id]
      );

      const productId = result.insertId;

      // Insert translations
      for (const t of translationsData) {
        await db.query(
          "INSERT INTO product_translations (product_id, language, name, description) VALUES (?, ?, ?, ?)",
          [productId, t.language, t.name, t.description]
        );
      }

      res.json({ message: "Product added", productId });
    } catch (err) {
      console.error("Add Product Error:", err);
      res.status(500).json({ message: "Database error", error: err });
    }
  }
);

const optionalUpload = (req, res, next) => {
  if (
    req.headers["content-type"] &&
    req.headers["content-type"].includes("multipart/form-data")
  ) {
    upload.single("image")(req, res, (err) => {
      if (err) {
        console.error("File upload error:", err);
        return res
          .status(400)
          .json({ message: "File upload error", error: err.message });
      }
      next();
    });
  } else {
    next();
  }
};

router.post("/modify/:id", verifyAdmin, optionalUpload, async (req, res) => {
  try {
    const { id } = req.params;
    const { category_id, translations } = req.body;
    const translationsData =
      typeof translations === "string"
        ? JSON.parse(translations)
        : translations;

    const [existing] = await db.query(
      "SELECT image FROM products WHERE id = ?",
      [id]
    );
    if (!existing.length)
      return res.status(404).json({ message: "Product not found" });

    const oldImage = existing[0].image;
    const newImage = req.file ? req.file.filename : oldImage;

    // Update product
    await db.query(
      "UPDATE products SET category_id = ?, image = ? WHERE id = ?",
      [category_id, newImage, id]
    );

    // Delete old image if new one uploaded
    if (req.file) {
      const oldImagePath = path.join(UPLOADS_DIR, oldImage);
      if (fs.existsSync(oldImagePath)) fs.unlinkSync(oldImagePath);
    }

    // Update translations
    for (const t of translationsData) {
      await db.query(
        "UPDATE product_translations SET name=?, description=? WHERE product_id=? AND language=?",
        [t.name, t.description, id, t.language]
      );
    }

    res.json({ message: "Product updated" });
  } catch (err) {
    console.error("Update Product Error:", err);
    res.status(500).json({ message: "Database error", error: err });
  }
});

router.delete("/delete/:id", verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await db.query(
      "SELECT image FROM products WHERE id = ?",
      [id]
    );
    if (!existing.length)
      return res.status(404).json({ message: "Product not found" });

    const oldImage = existing[0].image;
    const oldImagePath = path.join(UPLOADS_DIR, oldImage);

    // Delete image from filesystem
    if (fs.existsSync(oldImagePath)) fs.unlinkSync(oldImagePath);

    // Delete product translations
    await db.query("DELETE FROM product_translations WHERE product_id = ?", [
      id,
    ]);

    // Delete the product
    await db.query("DELETE FROM products WHERE id = ?", [id]);

    res.json({ message: "Product deleted" });
  } catch (err) {
    console.error("Delete Product Error:", err);
    res.status(500).json({ message: "Database error", error: err });
  }
});

// ===== DELETE CATEGORY + PRODUCTS =====
router.delete("/categories/delete/:id", verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Get all products in this category
    const [products] = await db.query(
      "SELECT id, image FROM products WHERE category_id = ?",
      [id]
    );

    // Delete product images
    for (const p of products) {
      if (p.image) {
        const imagePath = path.join(UPLOADS_DIR, p.image);
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
      }
    }

    const productIds = products.map((p) => p.id);

    // Delete product translations and products
    if (productIds.length) {
      await db.query(
        "DELETE FROM product_translations WHERE product_id IN (?)",
        [productIds]
      );
      await db.query("DELETE FROM products WHERE id IN (?)", [productIds]);
    }

    // Delete category translations and category
    await db.query("DELETE FROM category_translations WHERE category_id = ?", [
      id,
    ]);
    await db.query("DELETE FROM categories WHERE id = ?", [id]);

    res.json({ message: "Category and its products deleted" });
  } catch (err) {
    console.error("Delete Category Error:", err);
    res.status(500).json({ message: "Database error", error: err });
  }
});

export default router;
