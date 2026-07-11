import fs from "fs";
import path from "path";

const LOGOS_DIR = path.resolve("storage/logos");

if (!fs.existsSync(LOGOS_DIR)) {
    fs.mkdirSync(LOGOS_DIR, { recursive: true });
}

/**
 * Enregistre le logo d'une entreprise sur disque (écrase l'ancien s'il existe)
 * et retourne le chemin local à stocker dans businesses.logo_path.
 */
export async function saveBusinessLogo(businessId, buffer, ext) {

    const filePath = path.join(LOGOS_DIR, `${businessId}.${ext}`);

    fs.writeFileSync(filePath, buffer);

    return filePath;
}
