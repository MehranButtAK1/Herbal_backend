module.exports = function errorHandler(err, req, res, next) {
  console.error("❌ Error:", err);
  const code = err.status || 500;
  res.status(code).json({
    error: err.message || "Server error",
  });
};
