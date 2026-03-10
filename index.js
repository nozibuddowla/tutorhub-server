require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const http = require("http");
const { Server } = require("socket.io");
const { ObjectId } = require("mongodb");

const { connectDB, getDB } = require("./config/db");
const { errorHandler, asyncHandler } = require("./middleware/errorHandler");

// ── Route imports ─────────────────────────────────────────────────────────────
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const tuitionRoutes = require("./routes/tuition.routes");
const tutorRoutes = require("./routes/tutor.routes"); // handles /tutors/*  AND /tutor/applications, /tutor/ongoing, /tutor/revenue
const applicationRoutes = require("./routes/application.routes");
const paymentRoutes = require("./routes/payment.routes");
const reviewRoutes = require("./routes/review.routes");
const messageRoutes = require("./routes/message.routes");
const sessionRoutes = require("./routes/session.routes");
const contactRoutes = require("./routes/contact.routes");
const adminRoutes = require("./routes/admin.routes");
const adminCtrl = require("./controllers/admin.controller");

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 5000;

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://tutorhub-nozib.netlify.app",
];

// ── Socket.io ─────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGINS, credentials: true },
});

// ── Core middleware ───────────────────────────────────────────────────────────
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/", authRoutes); // POST /jwt, POST /logout
app.use("/users", userRoutes); // POST /users, GET /users/role/:email ...

// ⚠️  /tutor/* routes (applications, ongoing, revenue) MUST come before /tutors/:id
// tutorRoutes handles BOTH /tutors/... AND /tutor/... paths:
app.use("/tutor", tutorRoutes); // GET /tutor/applications/:email, /tutor/ongoing/:email, /tutor/revenue/:email
app.use("/tutors", tutorRoutes); // GET /tutors, /tutors/all, /tutors/:id

app.use("/tuitions", tuitionRoutes); // GET /tuitions, /tuitions/all, /tuitions/:id ...
app.use("/applications", applicationRoutes); // POST /applications, PATCH /applications/:id ...
app.use("/", paymentRoutes); // POST /create-payment-intent, POST /payments ...
app.use("/reviews", reviewRoutes); // POST /reviews, GET /reviews/:email
app.use("/", messageRoutes); // GET /conversations/:email, /messages/...
app.use("/sessions", sessionRoutes); // GET/POST/PATCH/DELETE /sessions/...
app.use("/contact", contactRoutes); // POST /contact
app.use("/admin", adminRoutes); // GET /admin/users, /admin/tuitions ...

// Student tuitions — standalone route (not in tuitionRoutes to avoid conflict)
app.get(
  "/student/tuitions/:email",
  require("./middleware/auth").verifyJWT,
  require("./middleware/auth").verifyStudent,
  asyncHandler(require("./controllers/tuition.controller").getStudentTuitions),
);

// Student applications
app.get(
  "/student/applications/:email",
  require("./middleware/auth").verifyJWT,
  require("./middleware/auth").verifyStudent,
  asyncHandler(
    require("./controllers/application.controller").getStudentApplications,
  ),
);

// Student payments
app.get(
  "/student/payments/:email",
  require("./middleware/auth").verifyJWT,
  require("./middleware/auth").verifyStudent,
  asyncHandler(require("./controllers/payment.controller").getStudentPayments),
);

// Public stats
app.get("/stats", asyncHandler(adminCtrl.getStats));
app.get("/", (req, res) => res.send("TutorHub API running ✅"));

// ── Centralized error handler (MUST be last) ──────────────────────────────────
app.use(errorHandler);

// ── Socket.io events ──────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  socket.on("join_conversation", (id) => socket.join(id));

  socket.on("send_message", async (data) => {
    try {
      const db = getDB();
      const message = {
        conversationId: data.conversationId,
        senderEmail: data.senderEmail,
        senderName: data.senderName,
        senderPhoto: data.senderPhoto || "",
        receiverEmail: data.receiverEmail,
        text: data.text,
        read: false,
        createdAt: new Date(),
      };
      const result = await db.collection("messages").insertOne(message);
      message._id = result.insertedId;

      await db.collection("conversations").updateOne(
        { _id: new ObjectId(data.conversationId) },
        {
          $set: { lastMessage: data.text, lastMessageAt: new Date() },
          $inc: { [`unreadCount.${data.receiverEmail}`]: 1 },
        },
      );
      io.to(data.conversationId).emit("receive_message", message);
    } catch (err) {
      console.error("Socket error:", err.message);
    }
  });

  socket.on("disconnect", () => {});
});

// ── Start ─────────────────────────────────────────────────────────────────────
const start = async () => {
  await connectDB();
  server.listen(port, () => console.log(`🚀 Server running on port ${port}`));
};

start().catch(console.error);
