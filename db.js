import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

// Try different SSL configurations
let db;
let connectionSuccessful = false;

const connectionConfigs = [
  {
    name: "SSL with rejectUnauthorized: false",
    ssl: { rejectUnauthorized: false },
  },
  {
    name: "SSL with rejectUnauthorized: true",
    ssl: { rejectUnauthorized: true },
  },
  { name: "SSL enabled", ssl: "Amazon RDS" }, // Common for cloud DBs
  { name: "No SSL", ssl: false },
];

for (const config of connectionConfigs) {
  try {
    console.log(`Trying connection: ${config.name}...`);

    db = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: Number(process.env.DB_PORT),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 5000,
      ssl: config.ssl,
    });

    const [rows] = await db.query("SELECT 1");
    console.log(`✅ Success with ${config.name}!`);
    connectionSuccessful = true;
    break;
  } catch (err) {
    console.log(`❌ Failed with ${config.name}: ${err.message}`);
  }
}

if (!connectionSuccessful) {
  console.error("❌ All connection attempts failed.");
  console.log("\nTroubleshooting steps:");
  console.log("1. Check Railway MySQL service is running");
  console.log("2. Verify credentials in .env file");
  console.log("3. Try connecting with MySQL Workbench");
  console.log("4. Check Railway documentation for SSL requirements");

  // Create a dummy pool to prevent app crash
  db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT),
    waitForConnections: true,
    connectionLimit: 1,
    queueLimit: 0,
  });
}

export default db;
