const express = require("express");
const app = express();
const cors = require("cors");
const admin = require("firebase-admin");
require("dotenv").config();
const { MongoClient } = require("mongodb");

const port = process.env.PORT || 5000;

const serviceAccount = require("./doctor-portal-firebase-adminsdk.json");
// const serviceAccount = JSON.parse(process.env.FIREBASE_AUTHENTICATION);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rwz2c.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function verifyToken(req, res, next) {
  if (req.headers?.authorization?.startsWith("Bearer ")) {
    const token = req.headers.authorization.split(" ")[1];
    // console.log(token);
    try {
      const decodedUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodedUser.email;
    } catch {}
  }

  next();
}

async function run() {
  try {
    await client.connect();
    const database = client.db("doctorPortal");
    const appointmentCollection = database.collection("appointments");
    const userCollection = database.collection("users");
    const courseCollection = database.collection("courses");

    app.get("/appointments", async (req, res) => {
      const cursor = appointmentCollection.find({});
      const appointments = await cursor.toArray();
      res.json(appointments);
    });

    app.get("/course", async (req, res) => {
      const cursor = courseCollection.find({});
      const courses = await cursor.toArray();
      res.json(courses);
    });

    app.get("/appointments", verifyToken, async (req, res) => {
      const email = req.query.email;
      const date = new Date(req.query.date).toLocaleDateString();
      // const date = req.query.date;
      const query = { email: email, date: date };
      // console.log(email, date);
      const cursor = appointmentCollection.find(query);
      const appointments = await cursor.toArray();
      res.json(appointments);
    });

    app.post("/appointments", async (req, res) => {
      const appointment = req.body;
      const result = await appointmentCollection.insertOne(appointment);
      res.json(result);
    });

    app.get("/users/:email", async (req, res) => {
      // here must be params.email
      const email = req.params.email;
      // console.log(email);
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let isAdmin = false;
      if (user?.role == "admin") {
        isAdmin = true;
      }
      res.json({ admin: isAdmin });
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await userCollection.insertOne(user);
      // console.log(result);
      res.json(result);
    });

    app.put("/users", async (req, res) => {
      const user = req.body;
      // console.log(user,user.email);
      const filter = { email: user.email };
      // console.log(filter);
      const options = { upsert: true };
      const updateDoc = { $set: user };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      // console.log(result);
      res.json(result);
    });

    app.put("/users/admin", verifyToken, async (req, res) => {
      const user = req.body;
      const requester = req.decodedEmail;
      console.log(req.decodedEmail);
      if (requester) {
        const requesterAccount = await userCollection.findOne({
          email: requester,
        });
        if (requesterAccount.role === "admin") {
          const filter = { email: user.admin };
          // console.log(filter);
          const updateDoc = { $set: { role: "admin" } };
          const result = await userCollection.updateOne(filter, updateDoc);
          res.json(result);
        }
      } else {
        res
          .status(403)
          .json({ message: "You do not have access to make admin." });
      }
    });
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello Doctor Portal Server!!!");
});

app.listen(port, () => {
  console.log(`Example app listening on port localhost:${port}`);
});
