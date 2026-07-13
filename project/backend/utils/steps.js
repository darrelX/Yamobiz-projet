/**
 * Toutes les étapes possibles de la machine à états de conversation.
 * Le préfixe indique le "module" auquel appartient l'étape,
 * ce qui permet à messageHandler de router vers le bon handler.
 */
export const STEPS = {

    // --- Inscription / identification ---
    START: "START",   // tout premier contact : n'importe quel message envoie l'accueil, sans jamais être interprété comme donnée
    LANGUAGE: "LANGUAGE", // choix de la langue de l'application, avant toute autre question
    NAME: "NAME",
    BUSINESS_NAME: "BUSINESS_NAME",
    CITY: "CITY",
    LOGO: "LOGO",

    // --- Menu principal ---
    MENU: "MENU",

    // --- Nouvelle vente ---
    SALE_SELECT_PRODUCT: "SALE_SELECT_PRODUCT",
    SALE_QUANTITY: "SALE_QUANTITY",
    SALE_ADD_MORE: "SALE_ADD_MORE",
    SALE_PAYMENT_TYPE: "SALE_PAYMENT_TYPE",
    SALE_CUSTOMER_NAME: "SALE_CUSTOMER_NAME",
    SALE_CONFIRM: "SALE_CONFIRM",
    SALE_AI_REVIEW: "SALE_AI_REVIEW", // récap de ce que l'IA a compris depuis un message libre/vocal
    SALE_EDIT_QUANTITY: "SALE_EDIT_QUANTITY", // modification d'une ligne du panier avant facture (hors IA)

    // --- Stock (CRUD complet + ajout en bloc) ---
    STOCK_MENU: "STOCK_MENU",
    STOCK_ADD_NAME: "STOCK_ADD_NAME",
    STOCK_ADD_PRICE: "STOCK_ADD_PRICE",
    STOCK_ADD_STOCK: "STOCK_ADD_STOCK",
    STOCK_PRODUCT_ACTIONS: "STOCK_PRODUCT_ACTIONS",
    STOCK_EDIT_NAME: "STOCK_EDIT_NAME",
    STOCK_EDIT_PRICE: "STOCK_EDIT_PRICE",
    STOCK_ADJUST_QTY: "STOCK_ADJUST_QTY",
    STOCK_DELETE_CONFIRM: "STOCK_DELETE_CONFIRM",
    STOCK_ADD_BULK_REVIEW: "STOCK_ADD_BULK_REVIEW", // récap d'un ajout de stock en bloc détecté par l'IA

    // --- Créances ---
    DEBT_MENU: "DEBT_MENU",
    DEBT_SELECT: "DEBT_SELECT",
    DEBT_AMOUNT: "DEBT_AMOUNT",

    // --- Factures (consultation / annulation) ---
    ORDER_MENU: "ORDER_MENU",
    ORDER_ACTIONS: "ORDER_ACTIONS",
    ORDER_CANCEL_CONFIRM: "ORDER_CANCEL_CONFIRM",

    // --- Profil utilisateur ---
    PROFILE_MENU: "PROFILE_MENU",
    PROFILE_EDIT_NAME: "PROFILE_EDIT_NAME",

    // --- Entreprise (modification, hors inscription) — support multi-entreprises ---
    COMPANY_MENU: "COMPANY_MENU",
    COMPANY_EDIT_NAME: "COMPANY_EDIT_NAME",
    COMPANY_EDIT_CITY: "COMPANY_EDIT_CITY",
    COMPANY_EDIT_SECTOR: "COMPANY_EDIT_SECTOR",
    COMPANY_EDIT_LOGO: "COMPANY_EDIT_LOGO",
    COMPANY_ADD_NAME: "COMPANY_ADD_NAME",
    COMPANY_ADD_CITY: "COMPANY_ADD_CITY",
    COMPANY_ADD_LOGO: "COMPANY_ADD_LOGO",
    COMPANY_SWITCH: "COMPANY_SWITCH",
    COMPANY_DELETE_CONFIRM: "COMPANY_DELETE_CONFIRM",

    // --- Compte utilisateur ---
    ACCOUNT_MENU: "ACCOUNT_MENU",
    ACCOUNT_DELETE_CONFIRM: "ACCOUNT_DELETE_CONFIRM",
    ACCOUNT_LANGUAGE: "ACCOUNT_LANGUAGE",

    // --- Analyse financière (résumé rapide + IA en langage naturel) ---
    ANALYSIS_MENU: "ANALYSIS_MENU",
    ANALYSIS_AI_QUESTION: "ANALYSIS_AI_QUESTION",

    // --- Suppression en bloc (produits, ventes, clients) détectée par l'IA ---
    BULK_DELETE_REVIEW: "BULK_DELETE_REVIEW"

};

export const REGISTRATION_STEPS = [
    STEPS.START,
    STEPS.LANGUAGE,
    STEPS.NAME,
    STEPS.BUSINESS_NAME,
    STEPS.CITY,
    STEPS.LOGO
];

export function stepBelongsTo(step, prefix) {
    return typeof step === "string" && step.startsWith(prefix);
}
