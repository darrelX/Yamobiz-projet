import { sendWhatsAppMessage } from "../services/whatsapp.js";
import { updateConversation } from "../services/conversationService.js";
import { createBusiness } from "../services/businessService.js";
import { updateUser } from "../services/userService.js";
import { STEPS } from "../utils/steps.js";
import { showMainMenu } from "./menuHandler.js";

export async function handleRegistration(phone, text, conversation, user) {

    switch (conversation.step) {

        case STEPS.NAME: {

            if (!text || !text.trim()) {
                return sendWhatsAppMessage(phone, "❌ Merci d'indiquer votre nom pour continuer.");
            }

            await updateUser(user.id, { name: text.trim() });

            await updateConversation(phone, STEPS.BUSINESS_NAME, {});

            return sendWhatsAppMessage(
                phone,
                `Enchanté, ${text.trim()} 👋\n\nQuel est le nom de votre entreprise ?`
            );
        }

        case STEPS.BUSINESS_NAME:

            if (!text || !text.trim()) {
                return sendWhatsAppMessage(phone, "❌ Merci d'indiquer le nom de votre entreprise.");
            }

            await updateConversation(phone, STEPS.CITY, {
                businessName: text.trim()
            });

            return sendWhatsAppMessage(
                phone,
                "Super 👍\n\nDans quelle ville se trouve votre entreprise ?"
            );

        case STEPS.CITY:

            if (!text || !text.trim()) {
                return sendWhatsAppMessage(phone, "❌ Merci d'indiquer une ville.");
            }

            await updateConversation(phone, STEPS.SECTOR, {
                ...conversation.data,
                city: text.trim()
            });

            return sendWhatsAppMessage(
                phone,
                "Quel est votre secteur d'activité ?"
            );

        case STEPS.SECTOR: {

            if (!text || !text.trim()) {
                return sendWhatsAppMessage(phone, "❌ Merci d'indiquer votre secteur d'activité.");
            }

            const businessData = {
                ...conversation.data,
                sector: text.trim(),
                phone
            };

            const business = await createBusiness(user.id, businessData);

            if (!business) {
                return sendWhatsAppMessage(
                    phone,
                    "❌ Impossible de créer votre entreprise. Veuillez réessayer."
                );
            }

            await updateUser(user.id, { active_business_id: business.id });
            await updateConversation(phone, STEPS.MENU, {});

            await sendWhatsAppMessage(
                phone,
                `🎉 Félicitations !\n\nVotre entreprise *${business.name}* a été créée avec succès.\n\nBienvenue sur Yamobiz 🚀\n\n_Astuce : depuis le menu, vous pourrez à tout moment modifier votre profil, votre entreprise (y compris son logo), votre stock, vos commandes, ajouter d'autres entreprises, ou supprimer votre compte._`
            );

            return showMainMenu(phone, business);
        }

        default:

            if (user.name) {
                await updateConversation(phone, STEPS.BUSINESS_NAME, {});
                return sendWhatsAppMessage(
                    phone,
                    `Rebonjour ${user.name} 👋\n\nQuel est le nom de votre (nouvelle) entreprise ?`
                );
            }

            await updateConversation(phone, STEPS.NAME, {});

            return sendWhatsAppMessage(
                phone,
                "Bienvenue sur Yamobiz 👋\n\nPour commencer, quel est votre nom ?"
            );
    }
}
