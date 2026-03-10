const { getDB } = require("../config/db");
const { ObjectId } = require("mongodb");

const isMember = (session, email) =>
  session.tutorEmail === email || session.studentEmail === email;

// GET /sessions/:email
const getSessions = async (req, res) => {
  const db = getDB();
  if (req.user.email !== req.params.email)
    return res.status(403).json({ message: "Forbidden." });
  const sessions = await db
    .collection("sessions")
    .find({
      $or: [
        { studentEmail: req.params.email },
        { tutorEmail: req.params.email },
      ],
    })
    .sort({ startTime: 1 })
    .toArray();
  res.json(sessions);
};

// GET /sessions/upcoming/:email
const getUpcoming = async (req, res) => {
  const db = getDB();
  if (req.user.email !== req.params.email)
    return res.status(403).json({ message: "Forbidden." });
  const sessions = await db
    .collection("sessions")
    .find({
      $or: [
        { studentEmail: req.params.email },
        { tutorEmail: req.params.email },
      ],
      startTime: { $gte: new Date() },
      status: { $ne: "cancelled" },
    })
    .sort({ startTime: 1 })
    .limit(10)
    .toArray();
  res.json(sessions);
};

// POST /sessions
const create = async (req, res) => {
  const db = getDB();
  const { studentEmail, tutorEmail, startTime, endTime } = req.body;
  if (req.user.email !== tutorEmail && req.user.email !== studentEmail) {
    return res.status(403).json({ message: "Forbidden." });
  }
  const session = {
    ...req.body,
    startTime: new Date(startTime),
    endTime: new Date(endTime),
    status: "scheduled",
    createdBy: req.user.email,
    createdAt: new Date(),
  };
  const result = await db.collection("sessions").insertOne(session);
  session._id = result.insertedId;
  res.status(201).json({ success: true, session });
};

// PATCH /sessions/:id
const updateStatus = async (req, res) => {
  const db = getDB();
  const session = await db
    .collection("sessions")
    .findOne({ _id: new ObjectId(req.params.id) });
  if (!session) return res.status(404).json({ message: "Not found." });
  if (!isMember(session, req.user.email))
    return res.status(403).json({ message: "Forbidden." });

  const { status, notes } = req.body;
  const updates = { status };
  if (notes !== undefined) updates.notes = notes;
  if (status === "completed") updates.completedAt = new Date();
  if (status === "cancelled") updates.cancelledAt = new Date();

  await db
    .collection("sessions")
    .updateOne({ _id: new ObjectId(req.params.id) }, { $set: updates });
  res.json({ success: true, message: "Session updated." });
};

// DELETE /sessions/:id
const remove = async (req, res) => {
  const db = getDB();
  const session = await db
    .collection("sessions")
    .findOne({ _id: new ObjectId(req.params.id) });
  if (!session) return res.status(404).json({ message: "Not found." });
  if (!isMember(session, req.user.email))
    return res.status(403).json({ message: "Forbidden." });

  await db
    .collection("sessions")
    .deleteOne({ _id: new ObjectId(req.params.id) });
  res.json({ success: true, message: "Session deleted." });
};

module.exports = { getSessions, getUpcoming, create, updateStatus, remove };
