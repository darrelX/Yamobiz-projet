import express from "express";
import { handleMessage } from "../handlers/messageHandler.js";
import { parseWebhook } from "../services/webhookParser.js";


const router = express.Router();



router.get("/", (req,res)=>{


    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];


    if(
        mode === "subscribe" &&
        token === process.env.VERIFY_TOKEN
    ){

        console.log("✅ Webhook Meta validé");

        return res.status(200).send(challenge);

    }


    return res.sendStatus(403);

});



router.post("/", async(req,res)=>{


    console.log("📩 Nouveau webhook");


    const message = parseWebhook(req.body);


    console.log("Message extrait :", message);



    if(message){

        await handleMessage(message);

    }


    res.sendStatus(200);

});



export default router;