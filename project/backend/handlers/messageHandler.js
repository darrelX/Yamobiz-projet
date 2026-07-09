import {
    getOrCreateUser
} from "../services/userService.js";

import {
    getBusinessByUserId
} from "../services/businessService.js";

import {
    getConversation,
    createConversation
} from "../services/conversationService.js";

import {
    handleRegistration
} from "./registrationHandler.js";

import {
    sendWhatsAppMessage
} from "../services/whatsapp.js";


export async function handleMessage(message) {


    const phone = message.phone
        ? (
            message.phone.startsWith("+")
                ? message.phone
                : "+" + message.phone
        )
        : null;


    if (!phone) {
        console.log("Numéro absent");
        return;
    }


    const text = message.text;



    // 1 - récupérer ou créer l'utilisateur
    const user = await getOrCreateUser(phone);


    if (!user) {

        return sendWhatsAppMessage(
            phone,
            "❌ Impossible de créer votre compte."
        );

    }



    // 2 - récupérer la conversation
    let conversation = await getConversation(phone);



    if (!conversation) {

        conversation = await createConversation(phone);

    }



    // 3 - vérifier si l'utilisateur possède déjà une entreprise
    const business = await getBusinessByUserId(user.id);



    // 4 - pas encore d'entreprise => inscription
    if (!business) {

        return handleRegistration(
            phone,
            text,
            conversation,
            user
        );

    }



    // 5 - entreprise existante => menu
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
//