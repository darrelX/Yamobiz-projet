/**
 * Options du menu principal, centralisées ici pour être réutilisées à la fois par
 * l'écran du menu principal lui-même (menuHandler.js) et par le bouton "Choisir"
 * omniprésent accroché à chaque réponse du bot (services/whatsapp.js), sans créer
 * de dépendance circulaire entre les deux.
 *
 * `titleKey` référence une clé de locales/fr.js et locales/en.js (voir utils/i18n.js) —
 * pas de texte en dur, pour que ce menu reste traduit automatiquement.
 */
export const MAIN_MENU_ITEMS = [
    { id: "1", titleKey: "common.menu.sale" },
    { id: "2", titleKey: "common.menu.stock" },
    { id: "3", titleKey: "common.menu.debts" },
    { id: "4", titleKey: "common.menu.analysis" },
    { id: "5", titleKey: "common.menu.invoices" },
    { id: "6", titleKey: "common.menu.profile" },
    { id: "7", titleKey: "common.menu.business" },
    { id: "8", titleKey: "common.menu.account" }
];
