import { sendWhatsAppMessage } from "../services/whatsapp.js";

import {
    updateConversation
} from "../services/conversationService.js";

import {
    createBusiness
} from "../services/businessService.js";


export async function handleRegistration(
    phone,
    text,
    conversation,
    user
) {

    switch (conversation.step) {

        case "BUSINESS_NAME":

            await updateConversation(
                phone,
                "CITY",
                {
                    businessName: text
                }
            );

            return sendWhatsAppMessage(
                phone,
                "Super 👍\n\nDans quelle ville se trouve votre entreprise ?"
            );



        case "CITY":

            await updateConversation(
                phone,
                "SECTOR",
                {
                    ...conversation.data,
                    city: text
                }
            );

            return sendWhatsAppMessage(
                phone,
                "Quel est votre secteur d'activité ?"
            );



        case "SECTOR":

            const businessData = {

                ...conversation.data,

                sector: text,

                phone

            };



            const business = await createBusiness(
                user.id,
                businessData
            );



            if (!business) {

                return sendWhatsAppMessage(
                    phone,
                    "❌ Impossible de créer votre entreprise."
                );

            }



            await updateConversation(
                phone,
                "MENU",
                {}
            );



            return sendWhatsAppMessage(
                phone,
`🎉 Félicitations !

Votre entreprise *${business.name}* a été créée avec succès.

Bienvenue sur Yamobiz 🚀

Que souhaitez-vous faire ?

1️⃣ Nouvelle vente

2️⃣ Stock

3️⃣ Créances

4️⃣ Analyses`
            );



        default:

            await updateConversation(
                phone,
                "BUSINESS_NAME",
                {}
            );

            return sendWhatsAppMessage(
                phone,
`Bienvenue sur Yamobiz 👋

Quel est le nom de votre entreprise ?`
            );

    }

}