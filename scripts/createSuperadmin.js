import bcrypt from "bcrypt";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

async function createSuperadmin() {
  const db = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "hasbani"
  });

  const email = "superadmin@example.com";  
  const password = "StrongPassword123";   
  const hashedPassword = await bcrypt.hash(password, 10);

  await db.execute(
    "INSERT INTO admins (email, password, role) VALUES (?, ?, 'superadmin')",
    [email, hashedPassword]
  );

  console.log("Superadmin created!");
  process.exit();  
}

createSuperadmin();
