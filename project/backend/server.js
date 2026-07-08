const express = require("express");
require("dotenv").config();

const app = express();

app.use(express.json());


const VERIFY_TOKEN = process.env.VERIFY_TOKEN;


// Vérification Meta
app.get("/webhook", (req,res)=>{

    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];


    if(mode === "subscribe" && token === VERIFY_TOKEN){
        console.log("Webhook validé");
        return res.status(200).send(challenge);
    }

    res.sendStatus(403);

});



// Réception messages WhatsApp
app.post("/webhook", (req, res) => {

    console.log("========== WEBHOOK ==========");
    console.log(JSON.stringify(req.body, null, 2));

    res.sendStatus(200);

});

app.get("/", (req, res) => {
  res.send("YamoBiz WhatsApp Backend OK");
});
app.listen(3000,()=>{
    console.log("Backend running on port 3000");
});