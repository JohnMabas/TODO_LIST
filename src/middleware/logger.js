const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const COLORS = {
  error: "\u001b[31m",
  warn: "\u001b[33m",
  info: "\u001b[36m",
  debug: "\u001b[35m",
};
const RESET = "\u001b[0m";

function currentLevel() {
  const configured = String(process.env.LOG_LEVEL || "info").toLowerCase();
  return configured in LEVELS ? LEVELS[configured] : LEVELS.info;
}

function write(level, message, error) {
  if (LEVELS[level] > currentLevel()) {
    return;
  }

  const timestamp = new Date().toISOString();
  const stream = level === "error" || level === "warn" ? console.error : console.log;
  const label = `${COLORS[level]}[${level.toUpperCase()}]${RESET}`;

  if (error) {
    stream(`${timestamp} ${label} ${message}`, error);
    return;
  }

  stream(`${timestamp} ${label} ${message}`);
}

module.exports = {
  error: (message, error) => write("error", message, error),
  warn: (message) => write("warn", message),
  info: (message) => write("info", message),
  debug: (message) => write("debug", message),
  request(req, res, durationMs) {
    write(
      "info",
      `${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(1)}ms - ${
        req.ip || "unknown"
      }`
    );
  },
};

