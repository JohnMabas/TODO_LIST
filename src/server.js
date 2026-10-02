const app = require("./app");
const logger = require("./middleware/logger");
const { port, nodeEnv } = require("./config/env");
const { verifyConnection, closePool } = require("./db/pool");

async function start() {
  try {
    const databaseUp = await verifyConnection();
    logger.info(`Postgres connection ${databaseUp ? "established" : "failed"}`);
  } catch (error) {
    logger.error("Cannot reach Postgres. Check your database settings.", error);
    process.exit(1);
  }

  const server = app.listen(port, () => {
    logger.info(`Server running in ${nodeEnv} mode at http://localhost:${port}`);
  });

  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down.`);
    server.close(async () => {
      await closePool().catch(() => {});
      process.exit(0);
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

start();