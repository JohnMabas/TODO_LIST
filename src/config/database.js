const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

const databaseUrl = process.env.DATABASE_URL;
const dbUser = process.env.PGUSER;
const dbPassword = process.env.PGPASSWORD;
const dbName = process.env.PGDATABASE;
const dbHost = process.env.PGHOST || "127.0.0.1";
const dbPort = Number(process.env.PGPORT || 5432);

if (!databaseUrl && (!dbUser || !dbName)) {
  throw new Error(
    "Database configuration missing. Set DATABASE_URL, or both PGUSER and PGDATABASE."
  );
}

if (!Number.isInteger(dbPort) || dbPort < 1 || dbPort > 65535) {
  throw new Error("PGPORT must be an integer between 1 and 65535.");
}

const poolConfig = databaseUrl
  ? {
      connectionString: databaseUrl,
      max: Number(process.env.PGPOOL_MAX || 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    }
  : {
      user: dbUser,
      password: dbPassword,
      database: dbName,
      host: dbHost,
      port: dbPort,
      max: Number(process.env.PGPOOL_MAX || 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    };

if (process.env.PGSSL === "true") {
  poolConfig.ssl = {
    rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== "false",
  };
}

const isTest = process.env.NODE_ENV === "test";

module.exports = {
  poolConfig,
  databaseUrl,
  dbUser: databaseUrl ? undefined : dbUser,
  dbName,
  dbHost,
  dbPort,
  isTest,
};