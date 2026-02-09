const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

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

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const database = client.db("tutorhubDB");
    const userCollections = database.collection("users");

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
          });
        }

        // Insert new user
        const result = await userCollections.insertOne(userInfo);

        // console.log("User saved to MongoDB:", result.insertedId);

        res.json({
          success: true,
          message: "User created successfully",
          insertedId: result.insertedId,
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

    app.get("/users/role/:email", async (req, res) => {
      try {
        const email = req.params.email;

        const query = { email: email };
        const user = await userCollections.findOne(query);

        if (user) {
          res.json({
            success: true,
            role: user.role || "No role assigned",
          });
        } else {
          res.json({
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

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
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
