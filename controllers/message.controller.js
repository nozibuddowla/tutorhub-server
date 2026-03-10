const { getDB } = require("../config/db");
const { ObjectId } = require("mongodb");

// GET /conversations/:email
const getConversations = async (req, res) => {
  const db = getDB();
  if (req.user.email !== req.params.email)
    return res.status(403).json({ message: "Forbidden." });
  const convos = await db
    .collection("conversations")
    .find({ participants: req.params.email })
    .sort({ lastMessageAt: -1 })
    .toArray();
  res.json(convos);
};

// POST /conversations
const createConversation = async (req, res) => {
  const db = getDB();
  const {
    studentEmail,
    tutorEmail,
    tuitionId,
    tuitionTitle,
    studentName,
    tutorName,
    studentPhoto,
    tutorPhoto,
  } = req.body;

  const existing = await db.collection("conversations").findOne({
    tuitionId,
    participants: { $all: [studentEmail, tutorEmail] },
  });
  if (existing) return res.json({ success: true, conversation: existing });

  const conversation = {
    participants: [studentEmail, tutorEmail],
    studentEmail,
    tutorEmail,
    tuitionId,
    tuitionTitle,
    studentName,
    tutorName,
    studentPhoto: studentPhoto || "",
    tutorPhoto: tutorPhoto || "",
    lastMessage: "",
    lastMessageAt: new Date(),
    unreadCount: { [studentEmail]: 0, [tutorEmail]: 0 },
    createdAt: new Date(),
  };
  const result = await db.collection("conversations").insertOne(conversation);
  conversation._id = result.insertedId;
  res.status(201).json({ success: true, conversation });
};

// GET /messages/unread/:email
const getUnreadCount = async (req, res) => {
  const db = getDB();
  if (req.user.email !== req.params.email)
    return res.status(403).json({ message: "Forbidden." });
  const convos = await db
    .collection("conversations")
    .find({ participants: req.params.email })
    .toArray();
  const total = convos.reduce(
    (sum, c) => sum + (c.unreadCount?.[req.params.email] || 0),
    0,
  );
  res.json({ unread: total });
};

// GET /messages/:conversationId
const getMessages = async (req, res) => {
  const db = getDB();
  const convo = await db
    .collection("conversations")
    .findOne({ _id: new ObjectId(req.params.conversationId) });
  if (!convo)
    return res.status(404).json({ message: "Conversation not found." });
  if (!convo.participants.includes(req.user.email))
    return res.status(403).json({ message: "Forbidden." });

  const messages = await db
    .collection("messages")
    .find({ conversationId: req.params.conversationId })
    .sort({ createdAt: 1 })
    .toArray();

  await db
    .collection("messages")
    .updateMany(
      {
        conversationId: req.params.conversationId,
        receiverEmail: req.user.email,
        read: false,
      },
      { $set: { read: true } },
    );
  await db
    .collection("conversations")
    .updateOne(
      { _id: new ObjectId(req.params.conversationId) },
      { $set: { [`unreadCount.${req.user.email}`]: 0 } },
    );
  res.json(messages);
};

module.exports = {
  getConversations,
  createConversation,
  getUnreadCount,
  getMessages,
};
