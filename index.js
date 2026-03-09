const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { ObjectId } = require("mongodb");
const http = require("http");
const { Server } = require("socket.io");

require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const app = express();
const port = process.env.PORT || 5000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "https://tutorhub-nozib.netlify.app"],
    credentials: true,
  },
});

// middleware
app.use(
  cors({
    origin: ["http://localhost:5173", "https://tutorhub-nozib.netlify.app"],
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = `${process.env.MONGODB_URI}`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// JWT Middleware to verify token
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

// Verify Admin role
const verifyAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Forbidden: Admin access required",
    });
  }
  next();
};

// Verify Tutor role
const verifyTutor = (req, res, next) => {
  if (req.user?.role !== "tutor") {
    return res.status(403).json({
      success: false,
      message: "Forbidden: Tutor access required",
    });
  }
  next();
};

// Verify Student role
const verifyStudent = (req, res, next) => {
  if (req.user?.role !== "student") {
    return res.status(403).json({
      success: false,
      message: "Forbidden: Student access required",
    });
  }
  next();
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const database = client.db("tutorhubDB");
    const userCollections = database.collection("users");
    const tuitionCollections = database.collection("tuitions");
    const paymentCollections = database.collection("payments");
    const applicationsCollection = database.collection("applications");
    const reviewsCollection = database.collection("reviews");
    const messagesCollection = database.collection("messages");
    const conversationsCollection = database.collection("conversations");
    const sessionsCollection = database.collection("sessions");

    // ─── PUBLIC DATA ENDPOINTS ──────────────────────────────────────────────────

    // Get Latest 6 Tuitions for Home Page
    app.get("/tuitions", async (req, res) => {
      const result = await tuitionCollections
        .find()
        .sort({ createdAt: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    // ADD THIS: Post New Tuition (Student creates tuition request)
    app.post("/tuitions", verifyJWT, async (req, res) => {
      try {
        const tuitionData = req.body;
        const result = await tuitionCollections.insertOne({
          ...tuitionData,
          status: "pending",
          createdAt: new Date(),
        });
        res.json({
          success: true,
          insertedId: result.insertedId,
          message: "Tuition posted successfully",
        });
      } catch (error) {
        console.error("Error posting tuition:", error);
        res.status(500).json({
          success: false,
          message: "Failed to post tuition",
        });
      }
    });

    // Get student's tuitions
    app.get(
      "/student/tuitions/:email",
      verifyJWT,
      verifyStudent,
      async (req, res) => {
        try {
          const email = req.params.email;

          // Only allow users to view their own tuitions
          if (req.user.email !== email) {
            return res.status(403).json({ message: "Forbidden access" });
          }

          const tuitions = await tuitionCollections
            .find({ studentEmail: email })
            .sort({ createdAt: -1 })
            .toArray();
          res.send(tuitions);
        } catch (error) {
          console.error("Error fetching student tuitions:", error);
          res.status(500).json({ message: "Failed to fetch tuitions" });
        }
      },
    );

    // ─── STUDENT APPLICATION ROUTES ─────────────────────────────────────────

    // Get applications for student's tuitions
    app.get(
      "/student/applications/:email",
      verifyJWT,
      verifyStudent,
      async (req, res) => {
        try {
          const email = req.params.email;

          // Only allow users to view applications for their own tuitions
          if (req.user.email !== email) {
            return res.status(403).json({ message: "Forbidden access" });
          }

          // First, get all tuitions posted by the student
          const studentTuitions = await tuitionCollections
            .find({ studentEmail: email })
            .toArray();

          // Get tuition IDs
          const tuitionIds = studentTuitions.map((t) => t._id.toString());

          // Find all applications for these tuitions
          const applications = await applicationsCollection
            .find({ tuitionId: { $in: tuitionIds } })
            .sort({ createdAt: -1 })
            .toArray();

          res.send(applications);
        } catch (error) {
          console.error("Error fetching student applications:", error);
          res.status(500).json({ message: "Failed to fetch applications" });
        }
      },
    );

    // Get student's payments
    app.get(
      "/student/payments/:email",
      verifyJWT,
      verifyStudent,
      async (req, res) => {
        try {
          const email = req.params.email;

          if (req.user.email !== email) {
            return res.status(403).json({ message: "Forbidden access" });
          }

          const payments = await paymentCollections
            .find({ studentEmail: email })
            .sort({ createdAt: -1 })
            .toArray();

          res.send(payments);
        } catch (error) {
          res.status(500).json({ message: "Failed to fetch payments" });
        }
      },
    );

    app.post(
      "/create-payment-intent",
      verifyJWT,
      verifyStudent,
      async (req, res) => {
        const { amount } = req.body;

        try {
          console.log("Creating payment intent for amount:", amount);

          const paymentIntent = await stripe.paymentIntents.create({
            amount: amount * 100,
            currency: "usd",
            payment_method_types: ["card"],
          });

          res.send({
            clientSecret: paymentIntent.client_secret,
          });
        } catch (error) {
          console.error("Stripe error:", error.message);
          res.status(500).send({ error: error.message });
        }
      },
    );

    // Get Latest 6 Tutors for Home Page
    app.get("/tutors", async (req, res) => {
      const result = await userCollections
        .find({ role: "tutor" })
        .sort({ createdAt: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    // Get ALL Tutors (no limit) — for the tutors listing page
    app.get("/tutors/all", async (req, res) => {
      try {
        const {
          search,
          subject,
          minRating,
          sort,
          page = 1,
          limit = 9,
        } = req.query;

        let query = { role: "tutor" };

        // Search by name OR subjects
        if (search) {
          query.$or = [
            { name: { $regex: search, $options: "i" } },
            { subjects: { $regex: search, $options: "i" } },
          ];
        }

        // Filter by specific subject
        if (subject && subject !== "All" && subject !== "") {
          query.subjects = { $regex: subject, $options: "i" };
        }

        // Filter by minimum rating
        if (minRating && parseFloat(minRating) > 0) {
          query.averageRating = { $gte: String(parseFloat(minRating)) };
          // averageRating is stored as string "4.00" so we need numeric comparison:
          // Use $expr for numeric comparison
          delete query.averageRating;
          query.$expr = {
            $gte: [
              { $toDouble: { $ifNull: ["$averageRating", "0"] } },
              parseFloat(minRating),
            ],
          };
        }

        // Sort options
        let sortOptions = { createdAt: -1 };
        if (sort === "ratingHigh") sortOptions = { averageRating: -1 };
        if (sort === "ratingLow") sortOptions = { averageRating: 1 };
        if (sort === "reviewsHigh") sortOptions = { reviewCount: -1 };

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const tutors = await userCollections
          .find(query)
          .sort(sortOptions)
          .skip(skip)
          .limit(parseInt(limit))
          .toArray();

        const total = await userCollections.countDocuments(query);

        res.send({
          tutors,
          total,
          totalPages: Math.ceil(total / parseInt(limit)),
          currentPage: parseInt(page),
        });
      } catch (error) {
        console.error("Error fetching tutors:", error);
        res.status(500).json({ message: "Failed to fetch tutors" });
      }
    });

    // Get single tutor by ID — for the tutor profile page
    app.get("/tutors/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const tutor = await userCollections.findOne({
          _id: new ObjectId(id),
          role: "tutor",
        });

        if (!tutor) {
          return res.status(404).json({ message: "Tutor not found" });
        }

        res.send(tutor);
      } catch (error) {
        console.error("Error fetching tutor:", error);
        res.status(500).json({ message: "Failed to fetch tutor" });
      }
    });

    // ─── ADMIN: USER MANAGEMENT ──────────────────────────────────────────────

    // Get all users (Admin only)
    app.get("/admin/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await userCollections.find().toArray();
      res.send(result);
    });

    // Delete a user
    app.delete("/admin/users/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const result = await userCollections.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // Update User (Generic - Info or Role)
    app.patch("/admin/users/:id", verifyJWT, verifyAdmin, async (req, res) => {
      if (req.user.role !== "admin") {
        return res.status(403).send({ message: "Forbidden access" });
      }
      const id = req.params.id;
      const updatedData = req.body;
      const result = await userCollections.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedData },
      );
      res.send(result);
    });

    // Get all tuitions (Admin only)
    app.get("/admin/tuitions", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await tuitionCollections.find().toArray();
      res.send(result);
    });

    // Approve/Reject tuition requests (Admin only)
    app.patch(
      "/admin/tuitions/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        if (req.user.role !== "admin") {
          return res.status(403).send({ message: "Forbidden access" });
        }
        const id = req.params.id;
        const { status } = req.body; // "approved" or "rejected"
        const result = await tuitionCollections.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status, approvedAt: new Date() } },
        );
        res.send(result);
      },
    );

    // Get all transactions/payments (Admin only)
    app.get("/admin/payments", verifyJWT, verifyAdmin, async (req, res) => {
      if (req.user.role !== "admin") {
        return res.status(403).send({ message: "Forbidden access" });
      }
      const result = await paymentCollections.find().toArray();
      res.send(result);
    });

    // Update User Profile (Any authenticated user)
    app.patch("/users/:email", verifyJWT, async (req, res) => {
      try {
        const email = req.params.email;
        const { name, photoURL } = req.body;

        // Only allow users to update their own profile
        if (req.user.email !== email) {
          return res.status(403).json({ message: "Forbidden access" });
        }

        const result = await userCollections.updateOne(
          { email: email },
          { $set: { name, photoURL, updatedAt: new Date() } },
        );

        if (result.modifiedCount > 0) {
          res.json({
            success: true,
            message: "Profile updated successfully",
          });
        } else {
          res.status(404).json({
            success: false,
            message: "User not found",
          });
        }
      } catch (error) {
        console.error("Error updating profile:", error);
        res.status(500).json({
          success: false,
          message: "Failed to update profile",
        });
      }
    });

    // ============= AUTH ROUTES =============

    // Generate JWT Token on Login
    app.post("/jwt", async (req, res) => {
      try {
        const userEmail = req.body.email;

        // Find user in database to get role
        const user = await userCollections.findOne({ email: userEmail });

        if (!user) {
          return res.status(404).json({
            success: false,
            message: "User not found",
          });
        }

        const token = jwt.sign(
          {
            email: userEmail,
            role: user.role,
          },
          process.env.JWT_SECRET,
          { expiresIn: "7d" },
        );

        res
          .cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          })
          .json({
            success: true,
            role: user.role,
            message: "Token generated successfully",
          });
      } catch (error) {
        console.error("Error generating token:", error);
        res.status(500).json({
          success: false,
          message: "Failed to generate token",
        });
      }
    });

    // Clear JWT Token on Logout
    app.post("/logout", (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .json({ success: true, message: "Logged out successfully" });
    });

    // ============= USER ROUTES =============

    // Register/Create User
    app.post("/users", async (req, res) => {
      try {
        const userInfo = req.body;

        // console.log("Received user data:", userInfo);

        // Check if user already exists
        const existingUser = await userCollections.findOne({
          email: userInfo.email,
        });

        if (existingUser) {
          // console.log("User already exists:", existingUser.email);
          return res.json({
            success: true,
            message: "User already exists",
            insertedId: existingUser._id,
            role: existingUser.role,
          });
        }

        // Insert new user
        const result = await userCollections.insertOne(userInfo);

        // console.log("User saved to MongoDB:", result.insertedId);

        res.json({
          success: true,
          message: "User created successfully",
          insertedId: result.insertedId,
          role: userInfo.role || "No role assigned",
        });
      } catch (error) {
        console.error("Error saving user:", error);
        res.status(500).json({
          success: false,
          message: "Failed to save user",
          error: error.message,
        });
      }
    });

    // Get User Role
    app.get("/users/role/:email", async (req, res) => {
      try {
        const email = req.params.email;

        const query = { email: email };
        const user = await userCollections.findOne(query);

        if (user) {
          res.json({
            success: true,
            role: user.role || "student",
            name: user.name,
            photoURL: user.photoURL,
          });
        } else {
          res.status(404).json({
            success: false,
            message: "User not found",
          });
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
        res.status(500).json({
          success: false,
          message: "Failed to fetch user role",
          error: error.message,
        });
      }
    });

    // Update User Role
    app.put("/users/role/:email", verifyJWT, async (req, res) => {
      try {
        const email = req.params.email;
        const { role } = req.body;

        const result = await userCollections.updateOne(
          { email: email },
          { $set: { role: role } },
        );

        if (result.modifiedCount > 0) {
          res.json({
            success: true,
            message: "Role updated successfully",
          });
        } else {
          res.status(404).json({
            success: false,
            message: "User not found",
          });
        }
      } catch (error) {
        console.error("Error updating user role:", error);
        res.status(500).json({
          success: false,
          message: "Failed to update user role",
          error: error.message,
        });
      }
    });

    // ─── TUTOR APPLICATION ROUTES ─────────────────────────────────────────

    // Create new tuition application
    app.post("/applications", verifyJWT, async (req, res) => {
      try {
        const applicationData = req.body;

        const tutor = await userCollections.findOne({
          email: applicationData.tutorEmail,
        });

        const result = await database.collection("applications").insertOne({
          ...applicationData,
          status: "pending",
          createdAt: new Date(),
        });
        res.json({ success: true, insertedId: result.insertedId });
      } catch (error) {
        res
          .status(500)
          .json({ success: false, message: "Failed to submit application" });
      }
    });

    // Get tutor's applications
    app.get(
      "/tutor/applications/:email",
      verifyJWT,
      verifyTutor,
      async (req, res) => {
        try {
          const email = req.params.email;
          const applications = await database
            .collection("applications")
            .find({ tutorEmail: email })
            .sort({ createdAt: -1 })
            .toArray();
          res.send(applications);
        } catch (error) {
          res.status(500).send({ message: "Failed to fetch applications" });
        }
      },
    );

    // Get tutor's ongoing tuitions (approved applications)
    app.get(
      "/tutor/ongoing/:email",
      verifyJWT,
      verifyTutor,
      async (req, res) => {
        const email = req.params.email;
        const ongoing = await database
          .collection("applications")
          .find({ tutorEmail: email, status: "approved" })
          .toArray();
        res.send(ongoing);
      },
    );

    // Get tutor's revenue/payments
    app.get(
      "/tutor/revenue/:email",
      verifyJWT,
      verifyTutor,
      async (req, res) => {
        const email = req.params.email;
        const payments = await paymentCollections
          .find({ tutorEmail: email, status: "success" })
          .toArray();
        res.send(payments);
      },
    );

    // Update application
    app.patch("/applications/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const updates = req.body;
      const result = await database
        .collection("applications")
        .updateOne({ _id: new ObjectId(id) }, { $set: updates });
      res.send(result);
    });

    // Update tuition (Student can update their own tuition)
    app.patch("/tuitions/:id", verifyJWT, async (req, res) => {
      try {
        const id = req.params.id;
        const { subject, location, salary, description } = req.body;

        // Check if tuition belongs to the user
        const tuition = await tuitionCollections.findOne({
          _id: new ObjectId(id),
        });
        if (!tuition) {
          return res.status(404).json({ message: "Tuition not found" });
        }

        if (tuition.studentEmail !== req.user.email) {
          return res.status(403).json({ message: "Forbidden access" });
        }

        const result = await tuitionCollections.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              subject,
              location,
              salary,
              description,
              updatedAt: new Date(),
            },
          },
        );

        res.json({
          success: true,
          message: "Tuition updated successfully",
        });
      } catch (error) {
        console.error("Error updating tuition:", error);
        res.status(500).json({
          success: false,
          message: "Failed to update tuition",
        });
      }
    });

    // Delete application
    app.delete("/applications/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const result = await database.collection("applications").deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // Delete tuition (Student can delete their own tuition)
    app.delete("/tuitions/:id", verifyJWT, async (req, res) => {
      try {
        const id = req.params.id;

        // Check if tuition belongs to the user
        const tuition = await tuitionCollections.findOne({
          _id: new ObjectId(id),
        });
        if (!tuition) {
          return res.status(404).json({ message: "Tuition not found" });
        }

        if (tuition.studentEmail !== req.user.email) {
          return res.status(403).json({ message: "Forbidden access" });
        }

        const result = await tuitionCollections.deleteOne({
          _id: new ObjectId(id),
        });

        res.json({
          success: true,
          message: "Tuition deleted successfully",
        });
      } catch (error) {
        console.error("Error deleting tuition:", error);
        res.status(500).json({
          success: false,
          message: "Failed to delete tuition",
        });
      }
    });

    // Reject application
    app.patch("/applications/:id/reject", verifyJWT, async (req, res) => {
      try {
        const id = req.params.id;

        const result = await applicationsCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              status: "rejected",
              rejectedAt: new Date(),
            },
          },
        );

        res.json({
          success: true,
          message: "Application rejected successfully",
        });
      } catch (error) {
        console.error("Error rejecting application:", error);
        res.status(500).json({
          success: false,
          message: "Failed to reject application",
        });
      }
    });

    // Approve application (called after successful payment)
    app.patch("/applications/:id/approve", verifyJWT, async (req, res) => {
      try {
        const id = req.params.id;

        const result = await applicationsCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              status: "approved",
              approvedAt: new Date(),
            },
          },
        );

        // Optional: Reject all other pending applications for the same tuition
        const application = await applicationsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (application) {
          await applicationsCollection.updateMany(
            {
              tuitionId: application.tuitionId,
              _id: { $ne: new ObjectId(id) },
              status: "pending",
            },
            {
              $set: {
                status: "rejected",
                rejectedAt: new Date(),
                rejectionReason: "Another tutor was selected",
              },
            },
          );
        }

        res.json({
          success: true,
          message: "Application approved successfully",
        });
      } catch (error) {
        console.error("Error approving application:", error);
        res.status(500).json({
          success: false,
          message: "Failed to approve application",
        });
      }
    });

    // Save payment record
    app.post("/payments", verifyJWT, async (req, res) => {
      try {
        const paymentData = req.body;
        const result = await paymentCollections.insertOne(paymentData);
        res.json({ success: true, insertedId: result.insertedId });
      } catch (error) {
        res
          .status(500)
          .json({ success: false, message: "Failed to save payment" });
      }
    });

    // Get all approved tuitions (for listing page)
    app.get("/tuitions/all", async (req, res) => {
      try {
        const {
          search,
          subject,
          location,
          status,
          salaryMin,
          salaryMax,
          sort,
          page = 1,
          limit = 8,
        } = req.query;

        let query = {};

        if (status) query.status = status;

        if (search) {
          query.$or = [
            { subject: { $regex: search, $options: "i" } },
            { location: { $regex: search, $options: "i" } },
          ];
        }

        if (subject && subject !== "All" && subject !== "") {
          query.subject = { $regex: subject, $options: "i" };
        }

        if (location) {
          query.location = { $regex: location, $options: "i" };
        }

        // Salary range filter
        if (salaryMin || salaryMax) {
          query.salary = {};
          if (salaryMin) query.salary.$gte = Number(salaryMin);
          if (salaryMax) query.salary.$lte = Number(salaryMax);
        }

        let sortOptions = { createdAt: -1 };
        if (sort === "salaryLow") sortOptions = { salary: 1 };
        if (sort === "salaryHigh") sortOptions = { salary: -1 };

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const tuitions = await tuitionCollections
          .find(query)
          .sort(sortOptions)
          .skip(skip)
          .limit(parseInt(limit))
          .toArray();

        const total = await tuitionCollections.countDocuments(query);

        res.send({
          tuitions,
          total,
          totalPages: Math.ceil(total / parseInt(limit)),
          currentPage: parseInt(page),
        });
      } catch (error) {
        console.error("Fetch error:", error);
        res.status(500).json({ message: "Failed to fetch tuitions" });
      }
    });

    // Get single tuition by ID (for details page)
    app.get("/tuitions/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const tuition = await tuitionCollections.findOne({
          _id: new ObjectId(id),
        });

        if (!tuition) {
          return res.status(404).json({ message: "Tuition not found" });
        }

        res.send(tuition);
      } catch (error) {
        console.error("Error fetching tuition:", error);
        res.status(500).json({ message: "Failed to fetch tuition" });
      }
    });

    // Get all reviews for a specific tuition
    app.post("/reviews", verifyJWT, verifyStudent, async (req, res) => {
      try {
        const review = req.body;
        const reviewDoc = {
          ...review,
          rating: parseFloat(review.rating),
          comment: review.comment,
          createdAt: new Date(),
        };

        const result = await reviewsCollection.insertOne(reviewDoc);

        const stats = await reviewsCollection
          .aggregate([
            { $match: { tutorEmail: review.tutorEmail } },
            {
              $group: {
                _id: "$tutorEmail",
                avgRating: { $avg: "$rating" },
                totalReviews: { $sum: 1 },
              },
            },
          ])
          .toArray();

        if (stats.length > 0) {
          await userCollections.updateOne(
            { email: review.tutorEmail },
            {
              $set: {
                averageRating: stats[0].avgRating.toFixed(2),
                reviewCount: stats[0].totalReviews,
              },
            },
          );
        }

        res.json({ success: true, message: "Review submitted successfully!" });
      } catch (error) {
        console.error("Error submitting review:", error);
        res
          .status(500)
          .json({ success: false, message: "Failed to submit review" });
      }
    });

    app.get("/reviews/:email", async (req, res) => {
      const email = req.params.email;
      const reviews = await reviewsCollection
        .find({ tutorEmail: email })
        .sort({ createdAt: -1 })
        .toArray();
      res.send(reviews);
    });

    // Get all conversations for a user
    app.get("/conversations/:email", verifyJWT, async (req, res) => {
      try {
        const email = req.params.email;
        if (req.user.email !== email) {
          return res.status(403).json({ message: "Forbidden access" });
        }
        const conversations = await conversationsCollection
          .find({ participants: email })
          .sort({ lastMessageAt: -1 })
          .toArray();
        res.send(conversations);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch conversations" });
      }
    });

    // Get or create a conversation
    app.post("/conversations", verifyJWT, async (req, res) => {
      try {
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

        const existing = await conversationsCollection.findOne({
          tuitionId,
          participants: { $all: [studentEmail, tutorEmail] },
        });

        if (existing) {
          return res.json({ success: true, conversation: existing });
        }

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

        const result = await conversationsCollection.insertOne(conversation);
        conversation._id = result.insertedId;
        res.json({ success: true, conversation });
      } catch (error) {
        res.status(500).json({ message: "Failed to create conversation" });
      }
    });

    // Get total unread count for a user
    app.get("/messages/unread/:email", verifyJWT, async (req, res) => {
      try {
        const email = req.params.email;
        if (req.user.email !== email) {
          return res.status(403).json({ message: "Forbidden" });
        }
        const conversations = await conversationsCollection
          .find({ participants: email })
          .toArray();
        const totalUnread = conversations.reduce(
          (sum, c) => sum + (c.unreadCount?.[email] || 0),
          0,
        );
        res.json({ unread: totalUnread });
      } catch (error) {
        res.status(500).json({ message: "Failed to get unread count" });
      }
    });

    // Get messages for a conversation
    app.get("/messages/:conversationId", verifyJWT, async (req, res) => {
      try {
        const { conversationId } = req.params;
        const conversation = await conversationsCollection.findOne({
          _id: new ObjectId(conversationId),
        });

        if (!conversation) {
          return res.status(404).json({ message: "Conversation not found" });
        }
        if (!conversation.participants.includes(req.user.email)) {
          return res.status(403).json({ message: "Forbidden access" });
        }

        const messages = await messagesCollection
          .find({ conversationId })
          .sort({ createdAt: 1 })
          .toArray();

        // Mark as read + reset unread count
        await messagesCollection.updateMany(
          { conversationId, receiverEmail: req.user.email, read: false },
          { $set: { read: true } },
        );
        await conversationsCollection.updateOne(
          { _id: new ObjectId(conversationId) },
          { $set: { [`unreadCount.${req.user.email}`]: 0 } },
        );

        res.send(messages);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch messages" });
      }
    });

    // ─── SESSION / CALENDAR ROUTES ────────────────────────────────────────────

    // Get sessions for a user (student or tutor)
    app.get("/sessions/:email", verifyJWT, async (req, res) => {
      try {
        const email = req.params.email;
        if (req.user.email !== email) {
          return res.status(403).json({ message: "Forbidden access" });
        }

        const sessions = await sessionsCollection
          .find({
            $or: [{ studentEmail: email }, { tutorEmail: email }],
          })
          .sort({ startTime: 1 })
          .toArray();

        res.send(sessions);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch sessions" });
      }
    });

    // Get upcoming sessions for a user (next 10)
    app.get("/sessions/upcoming/:email", verifyJWT, async (req, res) => {
      try {
        const email = req.params.email;
        if (req.user.email !== email) {
          return res.status(403).json({ message: "Forbidden access" });
        }

        const now = new Date();
        const sessions = await sessionsCollection
          .find({
            $or: [{ studentEmail: email }, { tutorEmail: email }],
            startTime: { $gte: now },
            status: { $ne: "cancelled" },
          })
          .sort({ startTime: 1 })
          .limit(10)
          .toArray();

        res.send(sessions);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch upcoming sessions" });
      }
    });

    // Create a new session (tutor schedules, student confirms)
    app.post("/sessions", verifyJWT, async (req, res) => {
      try {
        const {
          tuitionId,
          tuitionTitle,
          studentEmail,
          studentName,
          tutorEmail,
          tutorName,
          subject,
          startTime,
          endTime,
          notes,
          location,
        } = req.body;

        // Only tutor or student involved in the tuition can create
        if (req.user.email !== tutorEmail && req.user.email !== studentEmail) {
          return res.status(403).json({ message: "Forbidden access" });
        }

        const session = {
          tuitionId,
          tuitionTitle,
          studentEmail,
          studentName,
          tutorEmail,
          tutorName,
          subject,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          notes: notes || "",
          location: location || "",
          status: "scheduled", // scheduled | completed | cancelled
          createdBy: req.user.email,
          createdAt: new Date(),
        };

        const result = await sessionsCollection.insertOne(session);
        session._id = result.insertedId;
        res.json({ success: true, session });
      } catch (error) {
        console.error("Error creating session:", error);
        res.status(500).json({ message: "Failed to create session" });
      }
    });

    // Update session status (complete or cancel)
    app.patch("/sessions/:id", verifyJWT, async (req, res) => {
      try {
        const id = req.params.id;
        const { status, notes } = req.body;

        const session = await sessionsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!session) {
          return res.status(404).json({ message: "Session not found" });
        }

        if (
          req.user.email !== session.tutorEmail &&
          req.user.email !== session.studentEmail
        ) {
          return res.status(403).json({ message: "Forbidden access" });
        }

        const updates = { status };
        if (notes !== undefined) updates.notes = notes;
        if (status === "completed") updates.completedAt = new Date();
        if (status === "cancelled") updates.cancelledAt = new Date();

        await sessionsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updates },
        );

        res.json({ success: true, message: "Session updated" });
      } catch (error) {
        res.status(500).json({ message: "Failed to update session" });
      }
    });

    // Delete a session
    app.delete("/sessions/:id", verifyJWT, async (req, res) => {
      try {
        const id = req.params.id;
        const session = await sessionsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!session) {
          return res.status(404).json({ message: "Session not found" });
        }

        if (
          req.user.email !== session.tutorEmail &&
          req.user.email !== session.studentEmail
        ) {
          return res.status(403).json({ message: "Forbidden access" });
        }

        await sessionsCollection.deleteOne({ _id: new ObjectId(id) });
        res.json({ success: true, message: "Session deleted" });
      } catch (error) {
        res.status(500).json({ message: "Failed to delete session" });
      }
    });

    app.get("/stats", async (req, res) => {
      try {
        const [tutorCount, studentCount, tuitionCount] = await Promise.all([
          userCollections.countDocuments({ role: "tutor" }),
          userCollections.countDocuments({ role: "student" }),
          tuitionCollections.countDocuments(),
        ]);

        res.json({
          tutors: tutorCount,
          students: studentCount,
          tuitions: tuitionCount,
          satisfaction: 98,
        });
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch stats" });
      }
    });

    // await client.db("admin").command({ ping: 1 });
    console.log("Successfully connected to MongoDB!");
  } catch (error) {
    console.error("MongoDB connection error:", error);
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("join_conversation", (conversationId) => {
    socket.join(conversationId);
  });

  socket.on("send_message", async (data) => {
    try {
      const db = client.db("tutorhubDB");
      const messagesCol = db.collection("messages");
      const conversationsCol = db.collection("conversations");

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

      const result = await messagesCol.insertOne(message);
      message._id = result.insertedId;

      await conversationsCol.updateOne(
        { _id: new ObjectId(data.conversationId) },
        {
          $set: { lastMessage: data.text, lastMessageAt: new Date() },
          $inc: { [`unreadCount.${data.receiverEmail}`]: 1 },
        },
      );

      io.to(data.conversationId).emit("receive_message", message);
    } catch (err) {
      console.error("Socket message error:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

app.get("/", (req, res) => {
  res.send("Hello tutorHub!");
});

server.listen(port, () => {
  console.log(`Server + Socket.io running on port ${port}`);
});
