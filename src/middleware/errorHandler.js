module.exports = function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  let statusCode = error.statusCode || error.status;
  let message = error.message;
  let exposeMessage = error.isOperational === true;

  if (error.type === "entity.parse.failed") {
    statusCode = 400;
    message = "Request body must contain valid JSON.";
    exposeMessage = true;
  }

  if (error.type === "entity.too.large") {
    statusCode = 413;
    message = "Request body is too large.";
    exposeMessage = true;
  }

  if (!Number.isInteger(statusCode) || statusCode < 400 || statusCode > 599) {
    statusCode = 500;
  }

  if (!exposeMessage || statusCode >= 500) {
    console.error(`[ERROR] ${req.method} ${req.originalUrl}`, error);
    message = "Something went wrong.";
    exposeMessage = false;
  }

  return res.status(statusCode).json({
    success: false,
    message,
  });
};
