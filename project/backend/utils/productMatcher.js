/**
 * Normalise une chaîne pour comparaison (minuscules, sans accents, sans ponctuation).
 */
function normalize(str) {
    return String(str || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, "")
        .trim();
}

/**
 * Trouve l'élément d'une liste dont le champ `nameField` correspond le mieux à `query`.
 * Utilisé pour faire correspondre ce que l'IA (texte libre ou vocal transcrit) a compris
 * aux vraies entités en base (produits, clients...), même si la formulation n'est pas exacte.
 * Retourne l'élément le plus probable, ou null si aucune correspondance suffisante.
 */
function matchEntityByName(items, query, nameField) {

    const q = normalize(query);

    if (!q || !items?.length) {
        return null;
    }

    let best = null;
    let bestScore = 0;

    for (const item of items) {

        const name = normalize(item[nameField]);
        let score = 0;

        if (name === q) {
            score = 100;
        } else if (name.includes(q) || q.includes(name)) {
            score = 70;
        } else {
            const qTokens = q.split(/\s+/);
            const nameTokens = name.split(/\s+/);
            const common = qTokens.filter(t => nameTokens.includes(t));
            score = common.length * 20;
        }

        if (score > bestScore) {
            bestScore = score;
            best = item;
        }
    }

    // Seuil minimal pour éviter les faux positifs sur des mots trop courts/génériques.
    return bestScore >= 20 ? best : null;
}

export function matchProductByName(products, query) {
    return matchEntityByName(products, query, "name");
}

export function matchCustomerByName(customers, query) {
    return matchEntityByName(customers, query, "name");
}
