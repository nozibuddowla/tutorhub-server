const jwt = require("jsonwebtoken");
const { getDB } = require("../config/db");

// POST /jwt — generate token on login
const generateToken = async (req, res) => {
  const { email } = req.body;
  if (!email)
    return res.status(400).json({ success: false, message: "Email required." });

  const db = getDB();
  const user = await db.collection("users").findOne({ email });
  if (!user)
    return res.status(404).json({ success: false, message: "User not found." });

  const token = jwt.sign({ email, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  const isProd = process.env.NODE_ENV === "production";
  res
    .cookie("token", token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "strict",
    })
    .json({ success: true, role: user.role, message: "Token generated." });
};

// POST /logout — clear token
const logout = (req, res) => {
  const isProd = process.env.NODE_ENV === "production";
  res
    .clearCookie("token", {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "strict",
    })
    .json({ success: true, message: "Logged out." });
};

module.exports = { generateToken, logout };
