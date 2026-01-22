/** @format */
require("dotenv").config();
const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(
  cors({
    origin: ["https://artifexfrontend.vercel.app"],
    credentials: true,
  })
);
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1ikjvvw.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// ডাটাবেস কানেকশন ক্যাশ করার জন্য গ্লোবাল ভেরিয়েবল
let db, artworkCollection, favoritesCollection;

async function connectDB() {
  if (db) return { artworkCollection, favoritesCollection };
  
  try {
    await client.connect();
    db = client.db("ArtifyDB");
    artworkCollection = db.collection("artworks");
    favoritesCollection = db.collection("favorites");
    console.log("✅ Successfully connected to MongoDB!");
    return { artworkCollection, favoritesCollection };
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error);
    throw error;
  }
}

// --- API ROUTES ---

app.get("/", (req, res) => {
  res.send("Artify Premium Server is running...");
});

// All Artworks API
app.get("/all-artworks", async (req, res) => {
  try {
    const { artworkCollection } = await connectDB();
    const search = req.query.search || "";
    let query = { visibility: "Public" };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { userName: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
      ];
    }

    const result = await artworkCollection.find(query).toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error" });
  }
});

// Add Artwork API
app.post("/add-artwork", async (req, res) => {
  try {
    const { artworkCollection } = await connectDB();
    const artwork = req.body;
    const result = await artworkCollection.insertOne(artwork);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to add artwork" });
  }
});

// Recent Artworks API
app.get("/recent-artworks", async (req, res) => {
  try {
    const { artworkCollection } = await connectDB();
    const result = await artworkCollection
      .find({ visibility: "Public" })
      .sort({ _id: -1 })
      .limit(6)
      .toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch recent artworks" });
  }
});

// Artwork Details by ID
app.get("/artwork/:id", async (req, res) => {
  try {
    const { artworkCollection } = await connectDB();
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await artworkCollection.findOne(query);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Error fetching artwork" });
  }
});

// Update Artwork
app.put("/update-artwork/:id", async (req, res) => {
  try {
    const { artworkCollection } = await connectDB();
    const id = req.params.id;
    const filter = { _id: new ObjectId(id) };
    const updatedArtwork = req.body;
    const updatedDoc = {
      $set: {
        title: updatedArtwork.title,
        image: updatedArtwork.image,
        category: updatedArtwork.category,
        medium: updatedArtwork.medium,
        dimensions: updatedArtwork.dimensions,
        price: updatedArtwork.price,
        visibility: updatedArtwork.visibility,
        description: updatedArtwork.description,
      },
    };
    const result = await artworkCollection.updateOne(filter, updatedDoc, { upsert: true });
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Update failed" });
  }
});

// Delete Artwork
app.delete("/artwork/:id", async (req, res) => {
  try {
    const { artworkCollection } = await connectDB();
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await artworkCollection.deleteOne(query);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Delete failed" });
  }
});

// My Gallery API
app.get("/my-gallery/:email", async (req, res) => {
  try {
    const { artworkCollection } = await connectDB();
    const email = req.params.email;
    const result = await artworkCollection.find({ userEmail: email }).toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Error fetching gallery" });
  }
});

// User Stats API
app.get("/user-total-art/:email", async (req, res) => {
  try {
    const { artworkCollection } = await connectDB();
    const email = req.params.email;
    const count = await artworkCollection.countDocuments({ userEmail: email });
    res.send({ totalPosts: count });
  } catch (error) {
    res.status(500).send({ message: "Error fetching stats" });
  }
});

// Like API
app.patch("/artwork/like/:id", async (req, res) => {
  try {
    const { artworkCollection } = await connectDB();
    const id = req.params.id;
    const isLiked = req.body.isLiked;
    const filter = { _id: new ObjectId(id) };
    const updateDoc = { $inc: { likes: isLiked ? 1 : -1 } };
    const result = await artworkCollection.updateOne(filter, updateDoc);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Like action failed" });
  }
});

// Favorites API
app.post("/favorites", async (req, res) => {
  try {
    const { favoritesCollection } = await connectDB();
    const favoriteData = req.body;
    const query = { artworkId: favoriteData.artworkId, userEmail: favoriteData.userEmail };
    const alreadyExist = await favoritesCollection.findOne(query);
    if (alreadyExist) {
      return res.status(400).send({ success: false, message: "Already in favorites" });
    }
    const result = await favoritesCollection.insertOne(favoriteData);
    res.send({ success: true, insertedId: result.insertedId });
  } catch (error) {
    res.status(500).send({ message: "Favorites action failed" });
  }
});

app.get("/favorites/:email", async (req, res) => {
  try {
    const { favoritesCollection } = await connectDB();
    const email = req.params.email;
    const result = await favoritesCollection.find({ userEmail: email }).toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Error fetching favorites" });
  }
});

app.delete("/favorites/:id", async (req, res) => {
  try {
    const { favoritesCollection } = await connectDB();
    const id = req.params.id;
    const result = await favoritesCollection.deleteOne({ _id: new ObjectId(id) });
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Delete favorite failed" });
  }
});

// Artist Details API
app.get("/artist-details/:email", async (req, res) => {
  try {
    const { artworkCollection } = await connectDB();
    const email = req.params.email;
    const artworks = await artworkCollection.find({ userEmail: email }).toArray();
    const artist = {
      name: artworks[0]?.userName || "Unknown Artist",
      image: artworks[0]?.userImage || "https://i.ibb.co/Vj1qCmh/image-2.png",
      bio: "Passionate about guitars and fine arts. Creating music through visuals.",
      totalArtworks: artworks.length,
      followers: 120,
    };
    res.send({ artist, artworks });
  } catch (error) {
    res.status(500).send({ message: "Error fetching artist details" });
  }
});

app.listen(port, () => {
  console.log(`Artify Server listening on port: ${port}`);
});

module.exports = app; // Vercel-এর জন্য এটি প্রয়োজন