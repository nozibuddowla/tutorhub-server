const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { ObjectId } = require("mongodb");

require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const app = express();
const port = process.env.PORT || 5000;

// middleware
// app.use(cors());
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://beautiful-seahorse-891f9a.netlify.app",
    ],
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

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const database = client.db("tutorhubDB");
    const userCollections = database.collection("users");
    const tuitionCollections = database.collection("tuitions");
    const paymentCollections = database.collection("payments");
    const applicationsCollection = database.collection("applications");

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
    app.get("/student/tuitions/:email", verifyJWT, async (req, res) => {
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
    });

    // Get Latest 6 Tutors for Home Page
    app.get("/tutors", async (req, res) => {
      const result = await userCollections
        .find({ role: "tutor" })
        .sort({ createdAt: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    // ─── ADMIN: USER MANAGEMENT ──────────────────────────────────────────────

    // Get all users (Admin only)
    app.get("/admin/users", verifyJWT, async (req, res) => {
      if (req.user.role !== "admin") {
        return res.status(403).send({ message: "Forbidden access" });
      }
      const result = await userCollections.find().toArray();
      res.send(result);
    });

    // Delete a user
    app.delete("/admin/users/:id", verifyJWT, async (req, res) => {
      if (req.user.role !== "admin") {
        return res.status(403).send({ message: "Forbidden access" });
      }
      const id = req.params.id;
      const result = await userCollections.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // Update User (Generic - Info or Role)
    app.patch("/admin/users/:id", verifyJWT, async (req, res) => {
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

    // Get all tuitions (Admin only)
    app.get("/admin/tuitions", verifyJWT, async (req, res) => {
      if (req.user.role !== "admin") {
        return res.status(403).send({ message: "Forbidden access" });
      }
      const result = await tuitionCollections.find().toArray();
      res.send(result);
    });

    // Approve/Reject tuition requests (Admin only)
    app.patch("/admin/tuitions/:id", verifyJWT, async (req, res) => {
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
    });

    // Get all transactions/payments (Admin only)
    app.get("/admin/payments", verifyJWT, async (req, res) => {
      if (req.user.role !== "admin") {
        return res.status(403).send({ message: "Forbidden access" });
      }
      const result = await paymentCollections.find().toArray();
      res.send(result);
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
    app.get("/tutor/applications/:email", verifyJWT, async (req, res) => {
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
    });

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

    // Get tutor's ongoing tuitions (approved applications)
    app.get("/tutor/ongoing/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const ongoing = await database
        .collection("applications")
        .find({ tutorEmail: email, status: "approved" })
        .toArray();
      res.send(ongoing);
    });

    // Get tutor's revenue/payments
    app.get("/tutor/revenue/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const payments = await paymentCollections
        .find({ tutorEmail: email, status: "success" })
        .toArray();
      res.send(payments);
    });

    // ─── STUDENT APPLICATION ROUTES ─────────────────────────────────────────

    // Get applications for student's tuitions
    app.get("/student/applications/:email", verifyJWT, async (req, res) => {
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

    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
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

    // Get student's payments
    app.get("/student/payments/:email", verifyJWT, async (req, res) => {
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
    });

    // Get all approved tuitions (for listing page)
    app.get("/tuitions/all", async (req, res) => {
      try {
        const {
          search,
          subject,
          location,
          status,
          sort,
          page = 1,
          limit = 6,
        } = req.query;

        let query = {};

        if (status) {
          query.status = status;
        }

        if (search) {
          query.$or = [
            { subject: { $regex: search, $options: "i" } },
            { location: { $regex: search, $options: "i" } },
          ];
        }

        if (subject && subject !== "all" && subject !== "") {
          query.subject = { $regex: subject, $options: "i" };
        }

        if (location) {
          query.location = { $regex: location, $options: "i" };
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
          totalPages: Math.ceil(total / limit),
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

app.get("/", (req, res) => {
  res.send("Hello tutorHub!");
});

app.listen(port, () => {
  console.log(`Server is running on ${port}`);
});
