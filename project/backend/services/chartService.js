import axios from "axios";

const ALLOWED_TYPES = ["bar", "line", "pie", "doughnut"];
const PALETTE = [
    "#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed",
    "#0891b2", "#db2777", "#65a30d", "#ea580c", "#4f46e5"
];

/**
 * Génère l'image PNG d'un graphique à partir d'une spécification (fournie par
 * l'IA) et des lignes de résultat de la requête SQL. Utilise QuickChart.io
 * (aucune dépendance native type "canvas" à compiler côté serveur — évite les
 * soucis d'installation déjà rencontrés avec d'autres libs natives).
 */
export async function generateChartImage(chartSpec, rows) {

    if (!chartSpec || !Array.isArray(rows) || !rows.length) {
        return null;
    }

    const { labelField, valueField, title } = chartSpec;

    if (!labelField || !valueField || !(labelField in rows[0]) || !(valueField in rows[0])) {
        return null;
    }

    const labels = rows.slice(0, 25).map(r => String(r[labelField] ?? ""));
    const values = rows.slice(0, 25).map(r => Number(r[valueField]) || 0);

    const chartType = ALLOWED_TYPES.includes(chartSpec.type) ? chartSpec.type : "bar";

    const config = {
        type: chartType,
        data: {
            labels,
            datasets: [{
                label: title || "Résultat",
                data: values,
                backgroundColor: PALETTE
            }]
        },
        options: {
            plugins: {
                title: { display: true, text: title || "" },
                legend: { display: chartType === "pie" || chartType === "doughnut" }
            }
        }
    };

    try {

        const response = await axios.post(
            "https://quickchart.io/chart",
            {
                chart: config,
                width: 600,
                height: 400,
                backgroundColor: "white",
                format: "png"
            },
            { responseType: "arraybuffer" }
        );

        return Buffer.from(response.data);

    } catch (error) {
        console.log("❌ Erreur génération graphique :", error.response?.data || error.message);
        return null;
    }
}
