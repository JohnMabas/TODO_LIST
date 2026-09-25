module.exports = function logger(req, res, next) {
  res.on("finish", () => {
    console.log(
      `${req.method} ${req.originalUrl} - ${res.statusCode} - ${new Date().toISOString()}`
    );
  });

  next();
};
