const { Pool } = require("pg");
const AppError = require("../utils/AppError");
const logger = require("../middleware/logger");
const { poolConfig } = require("../config/database");

const pool = new Pool(poolConfig);

pool.on("error", (error) => {
  logger.error("Unexpected idle client error in Postgres pool", error);
});

async function query(text, params) {
  const startedAt = process.hrtime.bigint();

  try {
    return await pool.query(text, params);
  } catch (error) {
    if (error.code === "23505") {
      throw new AppError("A record with those values already exists.", 409);
    }

    if (error.code === "23503") {
      throw new AppError("Referenced resource does not exist.", 400);
    }

    throw error;
  } finally {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    logger.debug(`SQL query finished in ${durationMs.toFixed(2)}ms`);
  }
}

async function withTransaction(callback) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function verifyConnection() {
  const result = await pool.query("SELECT 1 AS ok");
  return result.rows[0].ok === 1;
}

async function closePool() {
  await pool.end();
}

module.exports = {
  pool,
  query,
  withTransaction,
  verifyConnection,
  closePool,
};