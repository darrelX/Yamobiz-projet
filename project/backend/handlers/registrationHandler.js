import { sendWhatsAppMessage, downloadWhatsAppMedia } from "../services/whatsapp.js";
import { updateConversation } from "../services/conversationService.js";
import { createBusiness, updateBusiness } from "../services/businessService.js";
import { saveBusinessLogo } from "../services/mediaService.js";
import { updateUser } from "../services/userService.js";
import { STEPS } from "../utils/steps.js";
import { showMainMenu } from "./menuHandler.js";

const SKIP_WORDS = ["passer", "plus tard", "skip", "non", "aucun"];

export async function handleRegistration(phone, text, conversation, user, message) {

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

            await updateConversation(phone, STEPS.LOGO, {
                ...conversation.data,
                city: text.trim()
            });

            return sendWhatsAppMessage(
                phone,
                '📷 Presque fini ! Envoyez la photo du logo de votre entreprise, ou écrivez "passer" pour continuer sans logo pour le moment.'
            );

        case STEPS.LOGO:
            return handleLogoStep(phone, text, conversation, user, message);

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

/**
 * Dernière étape de l'inscription : capture (facultative) du logo, PUIS création
 * de l'entreprise. On crée l'entreprise seulement ici, une fois toutes les données
 * réunies en une seule fois — pas avant — pour que la conversation reste bien dans
 * le flow d'inscription (aucune entreprise en base) jusqu'à ce message inclus.
 */
async function handleLogoStep(phone, text, conversation, user, message) {

    const wantsSkip = SKIP_WORDS.includes((text || "").trim().toLowerCase());

    let logoBuffer = null;
    let logoExt = null;

    if (!wantsSkip) {

        if (message?.type === "image" && message.raw?.image?.id) {

            const media = await downloadWhatsAppMedia(message.raw.image.id);

            if (media) {
                logoBuffer = media.buffer;
                logoExt = media.mimeType.includes("png") ? "png" : "jpg";
            }

        } else {
            return sendWhatsAppMessage(
                phone,
                '📷 Merci d\'envoyer directement la photo de votre logo, ou écrivez "passer" pour continuer sans logo pour le moment.'
            );
        }
    }

    const business = await createBusiness(user.id, {
        businessName: conversation.data.businessName,
        city: conversation.data.city,
        sector: null,
        phone
    });

    if (!business) {
        return sendWhatsAppMessage(
            phone,
            "❌ Impossible de créer votre entreprise. Veuillez réessayer."
        );
    }

    let finalBusiness = business;

    if (logoBuffer) {
        const logoPath = await saveBusinessLogo(business.id, logoBuffer, logoExt);
        const updated = await updateBusiness(business.id, { logo_path: logoPath });
        finalBusiness = updated || business;
    }

    await updateUser(user.id, { active_business_id: business.id });
    await updateConversation(phone, STEPS.MENU, {});

    const logoNote = logoBuffer
        ? ""
        : '\n\n_Vous pourrez ajouter votre logo plus tard depuis "🏢 Mon entreprise"._';

    await sendWhatsAppMessage(
        phone,
        `🎉 Félicitations !\n\nVotre entreprise *${finalBusiness.name}* a été créée avec succès.${logoNote}\n\nBienvenue sur Yamobiz 🚀\n\n_Astuce : depuis le menu, vous pourrez à tout moment modifier votre profil, votre entreprise, votre stock, vos commandes, ajouter d'autres entreprises, ou supprimer votre compte._`
    );

    return showMainMenu(phone, finalBusiness);
}
