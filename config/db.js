const { MongoClient, ServerApiVersion } = require("mongodb");

let db = null;
let client = null;

const connectDB = async () => {
  if (db) return db;
  client = new MongoClient(process.env.MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });
  await client.connect();
  db = client.db("tutorhubDB");
  console.log("✅ MongoDB connected");
  return db;
};

const getDB = () => {
  if (!db) throw new Error("DB not initialized. Call connectDB() first.");
  return db;
};

const getClient = () => client;

module.exports = { connectDB, getDB, getClient };
