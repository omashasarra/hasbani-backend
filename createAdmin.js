import bcrypt from "bcrypt";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

// Load .env
dotenv.config();

console.log("=== Environment Check ===");
console.log("DB_USER:", process.env.DB_USER || "EMPTY - THIS IS THE PROBLEM!");
console.log("DB_HOST:", process.env.DB_HOST);
console.log("DB_PASSWORD:", process.env.DB_PASSWORD ? "SET" : "NOT SET");

// If DB_USER is empty, stop here
if (!process.env.DB_USER || !process.env.DB_PASSWORD) {
  console.error("\n❌ ERROR: DB_USER or DB_PASSWORD is empty in .env file!");
  console.error("Please check your .env file in backend folder:");
  console.error('1. Is the file named exactly ".env" (with dot)?');
  console.error("2. Are the values filled?");
  console.error("3. No spaces after = sign");
  process.exit(1);
}

async function createAdmin() {
  let connection;

  try {
    console.log("\n🔐 Creating admin user...");

    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: false, // Disable SSL for now
    });

    console.log("✅ Connected to database");

    // Create admin
    const password = "AdminPassword@25";
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if exists first
    const [existing] = await connection.execute(
      "SELECT id FROM admins WHERE email = ?",
      ["admin@example.com"]
    );

    if (existing.length > 0) {
      await connection.execute(
        "UPDATE admins SET password = ? WHERE email = ?",
        [hashedPassword, "admin@example.com"]
      );
      console.log("✅ Admin password updated");
    } else {
      const [result] = await connection.execute(
        "INSERT INTO admins (email, password, name, role) VALUES (?, ?, ?, ?)",
        ["admin@example.com", hashedPassword, "Admin", "superadmin"]
      );
      console.log("✅ Admin created. ID:", result.insertId);
    }

    console.log("\n📧 Email: admin@example.com");
    console.log("🔑 Password: AdminPassword@25");

    // Show all admins
    const [admins] = await connection.execute(
      "SELECT id, email, role FROM admins"
    );
    console.log("\n📋 All admins:");
    admins.forEach((a) => console.log(`  ${a.id}. ${a.email} (${a.role})`));

    await connection.end();
    console.log("\n🎉 Success!");
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error("Code:", error.code);

    // Try alternative username
    if (error.code === "ER_ACCESS_DENIED_ERROR") {
      console.log('\n🔄 Trying username "railway" instead of "root"...');
      try {
        const conn2 = await mysql.createConnection({
          host: process.env.DB_HOST,
          port: process.env.DB_PORT,
          user: "railway", // Alternative
          password: process.env.DB_PASSWORD,
          database: process.env.DB_NAME,
          ssl: false,
        });
        console.log('✅ Works with username "railway"!');
        console.log("Update .env: DB_USER=railway");
        await conn2.end();
      } catch (err2) {
        console.error("❌ Also failed:", err2.message);
      }
    }

    if (connection) await connection.end();
    process.exit(1);
  }
}

createAdmin();
