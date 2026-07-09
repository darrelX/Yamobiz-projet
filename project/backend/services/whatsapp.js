import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

export async function sendWhatsAppMessage(phone, message) {
    try {

        console.log("📤 Envoi WhatsApp...");
        console.log("Destinataire :", phone);
        console.log("Message :", message);


        const response = await axios.post(

            `https://graph.facebook.com/v25.0/1242743348916607/messages`,

            {
                messaging_product: "whatsapp",

                to: phone,

                type: "text",

                text: {
                    body: message
                }
            },

            {
                headers: {
                    Authorization: 'Bearer EAATFB9PwKBUBR0fRFSC51HYPLQZCEBVHtbMQm2MeLf3luNRYn8sZBqdZCNMqfsl2Diwgjl3E3fFsaXG8HZADHvBsWAIkExcz4c7XLP3SF9RkUZBasryYfv8cS4BDZAQWxmzHjemHlWx0niy8KtbDZCD2JPILTHj4ed7aOswj7T1pAXhFcZBFMDlFtHr9zDnnPwZDZD',
                    "Content-Type": "application/json"
                }
            }

        );


        console.log("✅ Réponse Meta :");
        console.log(response.status);
        console.log(response.data);


        return response.data;


    } catch(error) {


        console.log("❌ Erreur envoi WhatsApp");

        if(error.response){

            console.log("Status :", error.response.status);
            console.log("Data :", error.response.data);

        } else {

            console.log(error.message);

        }

    }

}