import { getBusinessByPhone } from "../services/businessService.js";
import { sendWhatsAppMessage } from "../services/whatsapp.js";
import {
    getConversation,
    createConversation,
    updateConversation
} from "../services/conversationService.js";


export async function handleMessage(message) {

    const phone = message.from.startsWith("+")
        ? message.from
        : "+" + message.from;

    const text = message.text;

    console.log("Message reçu :", phone, text);


    const business = await getBusinessByPhone(phone);


    // Entreprise existante
    if (business) {
        return sendWhatsAppMessage(
            phone,
`Bonjour ${business.name} 👋

Que voulez-vous faire ?

1️⃣ Nouvelle vente
2️⃣ Voir le stock
3️⃣ Créances
4️⃣ Analyse`
        );
    }


    let conversation = await getConversation(phone);


    // Nouveau utilisateur
    if (!conversation) {

        await createConversation(phone);

        await updateConversation(phone, "BUSINESS_NAME", {});

        return sendWhatsAppMessage(
            phone,
`Bienvenue sur Yamobiz 👋

Quel est le nom de votre entreprise ?`
        );
    }


    switch (conversation.step) {

        case "BUSINESS_NAME":
            await updateConversation(phone, "CITY", {
                ...conversation.data,
                businessName: text
            });

            return sendWhatsAppMessage(
                phone,
                "Super 👍 Dans quelle ville se trouve votre entreprise ?"
            );


        case "CITY":
            await updateConversation(phone, "SECTOR", {
                ...conversation.data,
                city: text
            });

            return sendWhatsAppMessage(
                phone,
                "Quel est votre secteur d'activité ?"
            );


        case "SECTOR":
            await updateConversation(phone, "COMPLETED", {
                ...conversation.data,
                sector: text
            });

            return sendWhatsAppMessage(
                phone,
                "🎉 Votre entreprise Yamobiz est prête !"
            );


        default:
            return sendWhatsAppMessage(
                phone,
                "Veuillez recommencer l'inscription."
            );
    }
}