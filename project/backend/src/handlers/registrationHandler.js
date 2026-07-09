import { sendWhatsAppMessage } from "../services/whatsapp.js";
import { updateConversation } from "../services/conversationService.js";
import { createBusiness } from "../services/businessService.js";
import { STEPS } from "../utils/steps.js";
import { showMainMenu } from "./menuHandler.js";

export async function handleRegistration(phone, text, conversation, user) {

    switch (conversation.step) {

        case STEPS.BUSINESS_NAME:

            await updateConversation(phone, STEPS.CITY, {
                businessName: text
            });

            return sendWhatsAppMessage(
                phone,
                "Super 👍\n\nDans quelle ville se trouve votre entreprise ?"
            );

        case STEPS.CITY:

            await updateConversation(phone, STEPS.SECTOR, {
                ...conversation.data,
                city: text
            });

            return sendWhatsAppMessage(
                phone,
                "Quel est votre secteur d'activité ?"
            );

        case STEPS.SECTOR: {

            const businessData = {
                ...conversation.data,
                sector: text,
                phone
            };

            const business = await createBusiness(user.id, businessData);

            if (!business) {
                return sendWhatsAppMessage(
                    phone,
                    "❌ Impossible de créer votre entreprise. Veuillez réessayer."
                );
            }

            await updateConversation(phone, STEPS.MENU, {});

            await sendWhatsAppMessage(
                phone,
                `🎉 Félicitations !\n\nVotre entreprise *${business.name}* a été créée avec succès.\n\nBienvenue sur Yamobiz 🚀`
            );

            return showMainMenu(phone, business);
        }

        default:

            await updateConversation(phone, STEPS.BUSINESS_NAME, {});

            return sendWhatsAppMessage(
                phone,
                "Bienvenue sur Yamobiz 👋\n\nQuel est le nom de votre entreprise ?"
            );
    }
}
