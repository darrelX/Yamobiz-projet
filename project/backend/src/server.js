import express from "express";
import dotenv from "dotenv";
import webhookRouter from "./routes/webhook.js";

dotenv.config();

const app = express();

app.use(express.json());

// Route WhatsApp Meta
app.use("/webhook", webhookRouter);

app.get("/", (req, res) => {
    res.send("YamoBiz WhatsApp Backend OK");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Backend running on port ${PORT}`);
});
