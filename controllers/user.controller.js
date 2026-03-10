const { getDB } = require("../config/db");
const { ObjectId } = require("mongodb");

// POST /users — register/upsert user
const createUser = async (req, res) => {
  const db = getDB();
  const userInfo = req.body;

  const existing = await db
    .collection("users")
    .findOne({ email: userInfo.email });
  if (existing) {
    return res.json({
      success: true,
      message: "User already exists.",
      insertedId: existing._id,
      role: existing.role,
    });
  }

  const result = await db.collection("users").insertOne({
    ...userInfo,
    createdAt: new Date(),
  });
  res
    .status(201)
    .json({
      success: true,
      message: "User created.",
      insertedId: result.insertedId,
      role: userInfo.role || "student",
    });
};

// GET /users/role/:email — get role
const getUserRole = async (req, res) => {
  const db = getDB();
  const user = await db
    .collection("users")
    .findOne({ email: req.params.email });
  if (!user)
    return res.status(404).json({ success: false, message: "User not found." });
  res.json({
    success: true,
    role: user.role || "student",
    name: user.name,
    photoURL: user.photoURL,
  });
};

// PUT /users/role/:email — update role
const updateUserRole = async (req, res) => {
  const db = getDB();
  const { role } = req.body;
  if (!["student", "tutor", "admin"].includes(role)) {
    return res.status(400).json({ success: false, message: "Invalid role." });
  }
  const result = await db
    .collection("users")
    .updateOne(
      { email: req.params.email },
      { $set: { role, updatedAt: new Date() } },
    );
  if (!result.modifiedCount)
    return res.status(404).json({ success: false, message: "User not found." });
  res.json({ success: true, message: "Role updated." });
};

// PATCH /users/:email — update profile
const updateProfile = async (req, res) => {
  const db = getDB();
  const { email } = req.params;
  if (req.user.email !== email)
    return res.status(403).json({ message: "Forbidden." });

  const { name, photoURL } = req.body;
  const result = await db
    .collection("users")
    .updateOne({ email }, { $set: { name, photoURL, updatedAt: new Date() } });
  if (!result.modifiedCount)
    return res.status(404).json({ success: false, message: "User not found." });
  res.json({ success: true, message: "Profile updated." });
};

module.exports = { createUser, getUserRole, updateUserRole, updateProfile };
