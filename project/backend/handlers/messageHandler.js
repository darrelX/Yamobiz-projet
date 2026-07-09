import { getBusinessByPhone } from "../services/businessService.js";
import { sendWhatsAppMessage } from "../services/whatsapp.js";


export async function handleMessage(message){


    const phone = message.phone;
    const text = message.text;


    console.log("Message reçu :", phone, text);


    const business = await getBusinessByPhone(phone);



    // Cas 1 : entreprise existante

    if(business){


        await sendWhatsAppMessage(

            phone,

            `Bonjour ${business.name} 👋

Que voulez-vous faire ?

1️⃣ Nouvelle vente
2️⃣ Voir le stock
3️⃣ Créances
4️⃣ Analyse`

        );


        return;

    }



    // Cas 2 : nouvelle entreprise

    await sendWhatsAppMessage(

        phone,

        `Bienvenue sur Yamobiz 👋

Je vais vous aider à créer votre entreprise.

Quel est le nom de votre entreprise ?`

    );


}