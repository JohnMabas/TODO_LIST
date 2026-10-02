const fs = require("fs");
const path = require("path");
const logger = require("../middleware/logger");
const { pool, verifyConnection, closePool } = require("./pool");

const SCHEMA_PATH = path.join(__dirname, "schema.sql");

async function runMigrations() {
  await verifyConnection();
  const sql = fs.readFileSync(SCHEMA_PATH, "utf8");

  await pool.query(sql);

  const users = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_name = 'users'"
  );
  const todos = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_name = 'todos'"
  );

  if (users.rowCount !== 1 || todos.rowCount !== 1) {
    throw new Error("Migration finished but the expected tables are missing.");
  }

  logger.info("Database schema is up to date.");
}

async function resetSchema() {
  await pool.query("DROP TABLE IF EXISTS todos, users CASCADE");
  await runMigrations();
}

if (require.main === module) {
  runMigrations()
    .then(() => closePool())
    .then(() => process.exit(0))
    .catch(async (error) => {
      logger.error("Migration failed", error);
      await closePool().catch(() => {});
      process.exit(1);
    });
}

module.exports = {
  runMigrations,
  resetSchema,
};