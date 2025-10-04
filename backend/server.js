import express from 'express';
import "dotenv/config";
import cors from 'cors';
import mongoose from 'mongoose';
import chatRoutes from "./routes/chat.js";

const app = express();
const port = 8080;
app.use(cors());
app.use(express.json());
app.use("/api", chatRoutes);

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("MongoDB connection error:", error);
  }
};

app.listen(port, () => {
  console.log(`Server is running on ${port}`);
  connectDB();
});

// app.get('/', (req, res) => {
//   res.send('Hello World!');
// });



// app.post("/test", async (req, res) => {

// });


