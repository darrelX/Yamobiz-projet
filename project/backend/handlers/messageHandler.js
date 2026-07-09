import { sendWhatsAppMessage } from "../services/whatsapp.js";
import { 
    getConversation,
    createConversation,
    updateConversation
} from "../services/conversationService.js";
import { 
    getBusinessByPhone,
    createBusiness 
} from "../services/businessService.js";


export async function handleMessage(message) {

    const phone = message.phone
        ? (message.phone.startsWith("+")
            ? message.phone
            : "+" + message.phone)
        : null;


    if (!phone) {
        console.log("Numéro absent");
        return;
    }


    const text = message.text;

    console.log("Message reçu :", phone, text);



    // Vérifier si l'entreprise existe déjà
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




    switch (conversation.step) {


        case "BUSINESS_NAME":

            await updateConversation(
                phone,
                "CITY",
                {
                    ...conversation.data,
                    businessName: text
                }
            );

            return sendWhatsAppMessage(
                phone,
                "Super 👍 Dans quelle ville se trouve votre entreprise ?"
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


            const newBusiness = await createBusiness(businessData);


            if (!newBusiness) {

                return sendWhatsAppMessage(
                    phone,
                    "❌ Une erreur est survenue pendant la création."
                );
            }


            await updateConversation(
                phone,
                "COMPLETED",
                businessData
            );


            return sendWhatsAppMessage(
                phone,
`🎉 Félicitations !

Votre entreprise ${newBusiness.name} est maintenant créée sur Yamobiz.

Bienvenue dans votre espace de gestion 🚀

Que voulez-vous faire ?

1️⃣ Nouvelle vente
2️⃣ Voir le stock
3️⃣ Créances
4️⃣ Analyse`
            );



        default:

            return sendWhatsAppMessage(
                phone,
                "Veuillez recommencer l'inscription."
            );
    }
}