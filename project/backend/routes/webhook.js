import express from "express";
import { handleMessage } from "../handlers/messageHandler.js";
import { parseWebhook } from "../parsers/webhookParser.js";

const router = express.Router();

// Vérification du webhook par Meta (handshake initial)
router.get("/", (req, res) => {

    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
        console.log("✅ Webhook Meta validé");
        return res.status(200).send(challenge);
    }

    return res.sendStatus(403);
});

// Réception des messages entrants
router.post("/", async (req, res) => {

    console.log("📩 Nouveau webhook");

    const message = parseWebhook(req.body);

    res.sendStatus(200);

    if (message) {
        try {
            await handleMessage(message);
        } catch (err) {
            console.log("❌ Erreur traitement message :", err);
        }
    }
});

export default router;
