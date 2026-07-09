import dotenv from "dotenv";
dotenv.config();

export const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
export const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
export const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION || "v21.0";

export const WHATSAPP_BASE_URL =
    `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}`;

if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    console.log("⚠️  WHATSAPP_TOKEN ou WHATSAPP_PHONE_NUMBER_ID manquant dans .env");
}
