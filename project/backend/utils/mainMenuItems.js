/**
 * Options du menu principal, centralisées ici pour être réutilisées à la fois par
 * l'écran du menu principal lui-même (menuHandler.js) et par le bouton "Choisir"
 * omniprésent accroché à chaque réponse du bot (services/whatsapp.js), sans créer
 * de dépendance circulaire entre les deux.
 */
export const MAIN_MENU_ITEMS = [
    { id: "1", title: "🛒 Nouvelle vente" },
    { id: "2", title: "📦 Gérer le stock" },
    { id: "3", title: "💰 Créances" },
    { id: "4", title: "📊 Analyse" },
    { id: "5", title: "📋 Commandes" },
    { id: "6", title: "👤 Mon profil" },
    { id: "7", title: "🏢 Mon entreprise" },
    { id: "8", title: "⚙️ Mon compte" }
];
