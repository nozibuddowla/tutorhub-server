const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { ObjectId } = require("mongodb");

require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

// middleware
// app.use(cors());
app.use(
  cors({
    origin: ["http://localhost:5173"],
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
    await client.connect();

    const database = client.db("tutorhubDB");
    const userCollections = database.collection("users");
    const tuitionCollections = database.collection("tuitions");
    const paymentCollections = database.collection("payments");

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
      if (req.user.role !== "admin")
        return res.status(403).send({ message: "Forbidden" });
      const id = req.params.id;
      const result = await userCollections.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // Update User (Generic - Info or Role)
    app.patch("/admin/users/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const updatedData = req.body;
      const result = await userCollections.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedData },
      );
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

    await client.db("admin").command({ ping: 1 });
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
