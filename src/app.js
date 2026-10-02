const express = require("express");
const helmet = require("helmet");
const AppError = require("./utils/AppError");
const logger = require("./middleware/logger");
const errorHandler = require("./middleware/errorHandler");
const createAuthRoutes = require("./routes/authRoutes");
const createUserRoutes = require("./routes/userRoutes");
const createTodoRoutes = require("./routes/todoRoutes");

function createApp(options = {}) {
  const limiterOptions = options.limiters || {};
  const { generalLimiter } = require("./middleware/rateLimiter").createLimiters(limiterOptions);
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(express.json({ limit: "10kb" }));
  app.use(requestLogger);
  app.use(generalLimiter);

  app.get("/health", async (_req, res, next) => {
    try {
      const { verifyConnection } = require("./db/pool");
      const database = (await verifyConnection()) ? "up" : "down";

      res.status(200).json({
        success: true,
        message: "API is running.",
        data: { database },
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/", (_req, res) => {
    res.json({ success: true, message: "API is running.", data: null });
  });

  app.use("/api/auth", createAuthRoutes(limiterOptions));
  app.use("/api/users", createUserRoutes(limiterOptions));
  app.use("/api/todos", createTodoRoutes());

  app.use((req, _res, next) => {
    next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
  });

  app.use(errorHandler);

  return app;
}

function requestLogger(req, res, next) {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    logger.request(req, res, durationMs);
  });

  next();
}

module.exports = createApp();
module.exports.createApp = createApp;