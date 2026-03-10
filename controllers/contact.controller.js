const { getDB } = require("../config/db");
const { ObjectId } = require("mongodb");

// POST /contact
const sendMessage = async (req, res) => {
  const db = getDB();
  const { name, email, subject, message } = req.body;
  const doc = {
    name: name.trim(),
    email: email.trim().toLowerCase(),
    subject: subject?.trim() || "General Inquiry",
    message: message.trim(),
    status: "unread",
    createdAt: new Date(),
  };
  const result = await db.collection("contacts").insertOne(doc);
  res
    .status(201)
    .json({
      success: true,
      insertedId: result.insertedId,
      message: "Message received!",
    });
};

// GET /admin/contacts
const getAll = async (req, res) => {
  const db = getDB();
  const messages = await db
    .collection("contacts")
    .find()
    .sort({ createdAt: -1 })
    .toArray();
  res.json(messages);
};

// PATCH /admin/contacts/:id
const updateStatus = async (req, res) => {
  const db = getDB();
  const { status } = req.body;
  if (!["unread", "read", "replied"].includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid status." });
  }
  await db
    .collection("contacts")
    .updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { status, updatedAt: new Date() } },
    );
  res.json({ success: true });
};

module.exports = { sendMessage, getAll, updateStatus };
