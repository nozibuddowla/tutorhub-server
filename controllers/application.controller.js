const { getDB } = require("../config/db");
const { ObjectId } = require("mongodb");

// POST /applications
const create = async (req, res) => {
  const db = getDB();
  const result = await db.collection("applications").insertOne({
    ...req.body,
    status: "pending",
    createdAt: new Date(),
  });
  res.status(201).json({ success: true, insertedId: result.insertedId });
};

// GET /tutor/applications/:email
const getTutorApplications = async (req, res) => {
  const db = getDB();
  const apps = await db
    .collection("applications")
    .find({ tutorEmail: req.params.email })
    .sort({ createdAt: -1 })
    .toArray();
  res.json(apps);
};

// GET /student/applications/:email
const getStudentApplications = async (req, res) => {
  const db = getDB();
  if (req.user.email !== req.params.email)
    return res.status(403).json({ message: "Forbidden." });

  const studentTuitions = await db
    .collection("tuitions")
    .find({ studentEmail: req.params.email })
    .toArray();
  const tuitionIds = studentTuitions.map((t) => t._id.toString());

  const applications = await db
    .collection("applications")
    .find({ tuitionId: { $in: tuitionIds } })
    .sort({ createdAt: -1 })
    .toArray();
  res.json(applications);
};

// PATCH /applications/:id
const update = async (req, res) => {
  const db = getDB();
  const result = await db
    .collection("applications")
    .updateOne({ _id: new ObjectId(req.params.id) }, { $set: req.body });
  res.json(result);
};

// PATCH /applications/:id/approve
const approve = async (req, res) => {
  const db = getDB();
  const id = req.params.id;
  await db
    .collection("applications")
    .updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: "approved", approvedAt: new Date() } },
    );
  // Reject all other pending apps for same tuition
  const app = await db
    .collection("applications")
    .findOne({ _id: new ObjectId(id) });
  if (app) {
    await db
      .collection("applications")
      .updateMany(
        {
          tuitionId: app.tuitionId,
          _id: { $ne: new ObjectId(id) },
          status: "pending",
        },
        {
          $set: {
            status: "rejected",
            rejectedAt: new Date(),
            rejectionReason: "Another tutor was selected.",
          },
        },
      );
  }
  res.json({ success: true, message: "Application approved." });
};

// PATCH /applications/:id/reject
const reject = async (req, res) => {
  const db = getDB();
  await db
    .collection("applications")
    .updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { status: "rejected", rejectedAt: new Date() } },
    );
  res.json({ success: true, message: "Application rejected." });
};

// DELETE /applications/:id
const remove = async (req, res) => {
  const db = getDB();
  const result = await db
    .collection("applications")
    .deleteOne({ _id: new ObjectId(req.params.id) });
  res.json(result);
};

module.exports = {
  create,
  getTutorApplications,
  getStudentApplications,
  update,
  approve,
  reject,
  remove,
};
