const rateLimit = require("express-rate-limit");

function buildLimiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        message,
      });
    },
  });
}

const MINUTE = 60 * 1000;

function createLimiters(options = {}) {
  return {
    generalLimiter: buildLimiter({
      windowMs: options.generalWindowMs || 15 * MINUTE,
      max: options.generalMax ?? 100,
      message: "Too many requests. Please try again later.",
    }),
    authLimiter: buildLimiter({
      windowMs: options.authWindowMs || 15 * MINUTE,
      max: options.authMax ?? 10,
      message: "Too many attempts. Please try again later.",
    }),
    sensitiveLimiter: buildLimiter({
      windowMs: options.sensitiveWindowMs || 15 * MINUTE,
      max: options.sensitiveMax ?? 20,
      message: "Too many sensitive requests. Please try again later.",
    }),
  };
}

module.exports = {
  ...createLimiters(),
  createLimiters,
};