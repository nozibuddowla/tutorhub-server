const errorHandler = (err, req, res, next) => {
  console.error(
    `[${new Date().toISOString()}] ${req.method} ${req.path} —`,
    err.message,
  );

  // MongoDB duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    return res
      .status(409)
      .json({ success: false, message: `${field} already exists.` });
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({ success: false, message: "Invalid token." });
  }
  if (err.name === "TokenExpiredError") {
    return res.status(401).json({ success: false, message: "Token expired." });
  }

  // MongoDB bad ObjectId
  if (err.name === "BSONError" || err.message?.includes("ObjectId")) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid ID format." });
  }

  // Validation errors
  if (err.status === 400) {
    return res.status(400).json({ success: false, message: err.message });
  }

  // Default 500
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error.",
  });
};

// Wrap async route handlers — prevents unhandled promise rejections
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { errorHandler, asyncHandler };
