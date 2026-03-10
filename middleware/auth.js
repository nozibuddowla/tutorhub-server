const jwt = require("jsonwebtoken");

const verifyJWT = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "Unauthorized access" });
  }
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ success: false, message: "Invalid token" });
    }
    req.user = decoded;
    next();
  });
};

const verifyAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res
      .status(403)
      .json({ success: false, message: "Forbidden: Admin access required" });
  }
  next();
};

const verifyTutor = (req, res, next) => {
  if (req.user?.role !== "tutor") {
    return res
      .status(403)
      .json({ success: false, message: "Forbidden: Tutor access required" });
  }
  next();
};

const verifyStudent = (req, res, next) => {
  if (req.user?.role !== "student") {
    return res
      .status(403)
      .json({ success: false, message: "Forbidden: Student access required" });
  }
  next();
};

module.exports = { verifyJWT, verifyAdmin, verifyTutor, verifyStudent };
