import { sendWhatsAppMessage, sendWhatsAppButtons, downloadWhatsAppMedia } from "../services/whatsapp.js";
import { updateConversation } from "../services/conversationService.js";
import { createBusiness, updateBusiness } from "../services/businessService.js";
import { saveBusinessLogo } from "../services/mediaService.js";
import { updateUser } from "../services/userService.js";
import { setCurrentLanguage } from "../utils/requestContext.js";
import { isLanguageSupported } from "../locales/index.js";
import { t } from "../utils/i18n.js";
import { STEPS } from "../utils/steps.js";
import { showMainMenu } from "./menuHandler.js";

const SKIP_WORDS = ["passer", "plus tard", "skip", "non", "aucun", "later", "no", "none"];

/**
 * Boutons de choix de langue. Body volontairement bilingue en dur (pas via t()) :
 * à ce stade précis, on ne connaît pas encore la langue de la personne — c'est
 * justement ce qu'on lui demande.
 */
function sendLanguageChoice(phone) {
    return sendWhatsAppButtons(
        phone,
        "🌍 Bienvenue sur Yamobiz ! / Welcome to Yamobiz!\n\nChoisissez votre langue / Choose your language :",
        [
            { id: "lang_fr", title: "🇫🇷 Français" },
            { id: "lang_en", title: "🇬🇧 English" }
        ],
        null,
        { skipMenuFooter: true }
    );
}

export async function handleRegistration(phone, text, conversation, user, message) {

    switch (conversation.step) {

        case STEPS.START: {

            // Premier contact : quel que soit le tout premier message envoyé (même
            // "bonjour" ou une phrase complète), on ne le traite JAMAIS comme une
            // donnée. On envoie directement le choix de langue — la toute première
            // question de l'inscription — et on n'attend une réponse qu'à partir du
            // PROCHAIN message.
            await updateConversation(phone, STEPS.LANGUAGE, {});

            return sendLanguageChoice(phone);
        }

        case STEPS.LANGUAGE: {

            const choice = (text || "").trim().toLowerCase();

            let language = null;

            if (choice === "lang_fr" || choice.includes("fran")) {
                language = "fr";
            } else if (choice === "lang_en" || choice.includes("english") || choice.includes("anglais")) {
                language = "en";
            }

            if (!language || !isLanguageSupported(language)) {
                return sendLanguageChoice(phone);
            }

            await updateUser(user.id, { language });

            // La langue vient d'être choisie : on met à jour le contexte de CETTE
            // requête pour que le prochain message (juste en dessous) soit déjà
            // envoyé dans la nouvelle langue, sans attendre le tour suivant.
            setCurrentLanguage(language);

            await updateConversation(phone, STEPS.NAME, {});

            return sendWhatsAppMessage(phone, t("registration.welcomeAskName"));
        }

        case STEPS.NAME: {

            if (!text || !text.trim()) {
                return sendWhatsAppMessage(phone, t("registration.nameRequired"));
            }

            await updateUser(user.id, { name: text.trim() });

            await updateConversation(phone, STEPS.BUSINESS_NAME, {});

            return sendWhatsAppMessage(phone, t("registration.greetingAskBusiness", { name: text.trim() }));
        }

        case STEPS.BUSINESS_NAME:

            if (!text || !text.trim()) {
                return sendWhatsAppMessage(phone, t("registration.businessNameRequired"));
            }

            await updateConversation(phone, STEPS.CITY, {
                businessName: text.trim()
            });

            return sendWhatsAppMessage(phone, t("registration.askCity"));

        case STEPS.CITY:

            if (!text || !text.trim()) {
                return sendWhatsAppMessage(phone, t("registration.cityRequired"));
            }

            await updateConversation(phone, STEPS.LOGO, {
                ...conversation.data,
                city: text.trim()
            });

            return sendWhatsAppMessage(phone, t("registration.askLogo"));

        case STEPS.LOGO:
            return handleLogoStep(phone, text, conversation, user, message);

        default:

            if (user.name) {
                await updateConversation(phone, STEPS.BUSINESS_NAME, {});
                return sendWhatsAppMessage(phone, t("registration.returningGreeting", { name: user.name }));
            }

            await updateConversation(phone, STEPS.LANGUAGE, {});

            return sendLanguageChoice(phone);
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
            return sendWhatsAppMessage(phone, t("registration.logoRequired"));
        }
    }

    const business = await createBusiness(user.id, {
        businessName: conversation.data.businessName,
        city: conversation.data.city,
        sector: null,
        phone
    });

    if (!business) {
        return sendWhatsAppMessage(phone, t("registration.businessCreateError"));
    }

    let finalBusiness = business;

    if (logoBuffer) {
        const logoPath = await saveBusinessLogo(business.id, logoBuffer, logoExt);
        const updated = await updateBusiness(business.id, { logo_path: logoPath });
        finalBusiness = updated || business;
    }

    await updateUser(user.id, { active_business_id: business.id });
    await updateConversation(phone, STEPS.MENU, {});

    const logoNote = logoBuffer ? "" : t("registration.logoNote");

    await sendWhatsAppMessage(
        phone,
        t("registration.successCreated", { businessName: finalBusiness.name, logoNote })
    );

    return showMainMenu(phone, finalBusiness);
}
