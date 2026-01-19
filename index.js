/** @format */

const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

const uri = "mongodb+srv://shahriar5703_db_user:iJ9T2PpmSdZjOMpW@cluster0.1ikjvvw.mongodb.net/?appName=Cluster0";


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

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    const db = client.db("ArtifyDB");
    const artworkCollection = db.collection("artworks");
    const favoritesCollection = db.collection("favorites");

    console.log("✅ Successfully connected to MongoDB!");

    // --- ARTWORK API ---

    app.post("/add-artwork", async (req, res) => {
      const artwork = req.body;
      const result = await artworkCollection.insertOne(artwork);
      res.send(result);
    });

    app.get("/all-artworks", async (req, res) => {
      try {
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
        console.error("Explore API Error:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // --- GET 6 RECENT ARTWORKS ---
    app.get("/recent-artworks", async (req, res) => {
      try {
        const result = await artworkCollection
          .find({ visibility: "Public" }) 
          .sort({ _id: -1 }) 
          .limit(6) 
          .toArray();

        res.send(result);
      } catch (error) {
        console.error("Recent Artworks Error:", error);
        res.status(500).send({ message: "Failed to fetch recent artworks" });
      }
    });

    app.get("/artwork/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await artworkCollection.findOne(query);
      res.send(result);
    });

    app.put("/update-artwork/:id", async (req, res) => {
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
      const result = await artworkCollection.updateOne(filter, updatedDoc, {
        upsert: true,
      });
      res.send(result);
    });

    app.delete("/artwork/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await artworkCollection.deleteOne(query);
      res.send(result);
    });

    // --- USER PROFILE & STATS API ---

    app.get("/my-gallery/:email", async (req, res) => {
      const email = req.params.email;
      const result = await artworkCollection
        .find({ userEmail: email })
        .toArray();
      res.send(result);
    });

    app.get("/user-total-art/:email", async (req, res) => {
      const email = req.params.email;
      const count = await artworkCollection.countDocuments({
        userEmail: email,
      });
      res.send({ totalPosts: count });
    });

    // --- ENGAGEMENT API (Like & Favorites) ---

    app.patch("/artwork/like/:id", async (req, res) => {
      const id = req.params.id;
      const isLiked = req.body.isLiked;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = { $inc: { likes: isLiked ? 1 : -1 } };
      const result = await artworkCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.post("/favorites", async (req, res) => {
      const favoriteData = req.body;
      const query = {
        artworkId: favoriteData.artworkId,
        userEmail: favoriteData.userEmail,
      };
      const alreadyExist = await favoritesCollection.findOne(query);
      if (alreadyExist) {
        return res
          .status(400)
          .send({ success: false, message: "Already in favorites" });
      }
      const result = await favoritesCollection.insertOne(favoriteData);
      res.send({ success: true, insertedId: result.insertedId });
    });

    app.get("/favorites/:email", async (req, res) => {
      const email = req.params.email;
      const result = await favoritesCollection
        .find({ userEmail: email })
        .toArray();
      res.send(result);
    });

    app.delete("/favorites/:id", async (req, res) => {
      const id = req.params.id;
      const result = await favoritesCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    app.get("/artist-details/:email", async (req, res) => {
      const email = req.params.email;
      const artworks = await artworkCollection
        .find({ userEmail: email })
        .toArray();

      
      const artist = {
        name: artworks[0]?.userName || "Unknown Artist",
        image: artworks[0]?.userImage || "https://i.ibb.co/Vj1qCmh/image-2.png",
        bio: "Passionate about guitars and fine arts. Creating music through visuals.",
        totalArtworks: artworks.length,
        followers: 120, 
      };

      res.send({ artist, artworks });
    });

    
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Artify Premium Server is running...");
});

app.listen(port, () => {
  console.log(` Artify Server listening on port: ${port}`);
});
