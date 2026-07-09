/**
 * Toutes les étapes possibles de la machine à états de conversation.
 * Le préfixe indique le "module" auquel appartient l'étape,
 * ce qui permet à messageHandler de router vers le bon handler.
 */
export const STEPS = {

    // --- Inscription entreprise ---
    BUSINESS_NAME: "BUSINESS_NAME",
    CITY: "CITY",
    SECTOR: "SECTOR",

    // --- Menu principal ---
    MENU: "MENU",

    // --- Nouvelle vente ---
    SALE_SELECT_PRODUCT: "SALE_SELECT_PRODUCT",
    SALE_QUANTITY: "SALE_QUANTITY",
    SALE_ADD_MORE: "SALE_ADD_MORE",
    SALE_PAYMENT_TYPE: "SALE_PAYMENT_TYPE",
    SALE_CUSTOMER_NAME: "SALE_CUSTOMER_NAME",
    SALE_CONFIRM: "SALE_CONFIRM",

    // --- Stock ---
    STOCK_MENU: "STOCK_MENU",
    STOCK_ADD_NAME: "STOCK_ADD_NAME",
    STOCK_ADD_PRICE: "STOCK_ADD_PRICE",
    STOCK_ADD_STOCK: "STOCK_ADD_STOCK",

    // --- Créances ---
    DEBT_MENU: "DEBT_MENU",
    DEBT_SELECT: "DEBT_SELECT",
    DEBT_AMOUNT: "DEBT_AMOUNT"

};

export const REGISTRATION_STEPS = [
    STEPS.BUSINESS_NAME,
    STEPS.CITY,
    STEPS.SECTOR
];

export function stepBelongsTo(step, prefix) {
    return typeof step === "string" && step.startsWith(prefix);
}
