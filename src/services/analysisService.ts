import OpenAI from 'openai';
import axios from 'axios';
import { config } from '../config';

export interface AnalysisResult {
    isScam: boolean;
    isFakeNews: boolean;
    hasVirus: boolean;
    reason: string;
}

export class AnalysisService {
    private openai: OpenAI;
    private googleApiKey: string;
    private virusTotalApiKey: string;
    private googleSearchEngineId: string;

    constructor() {
        this.openai = new OpenAI({ apiKey: config.apiKeys.openAI });
        this.googleApiKey = config.apiKeys.google;
        this.virusTotalApiKey = config.apiKeys.virusTotal;
        this.googleSearchEngineId = config.apiKeys.googleSearchEngineId;
    }

    public async analyzeMessage(message: string): Promise<AnalysisResult> {
        try {
            const [scamAndFakeNewsResult, virusResult] = await Promise.all([
                this.checkForScamsAndFakeNews(message),
                this.checkForViruses(message)
            ]);

            return {
                isScam: Boolean(scamAndFakeNewsResult.isScam),
                isFakeNews: Boolean(scamAndFakeNewsResult.isFakeNews),
                hasVirus: Boolean(virusResult),
                reason: scamAndFakeNewsResult.reason,
            };
        } catch (error: any) {
            if (error.code === 'insufficient_quota' || error.status === 429) {
                return {
                    isScam: false,
                    isFakeNews: false,
                    hasVirus: false,
                    reason: "⚠️ El análisis automático está temporalmente deshabilitado. Respuesta simulada: Tu mensaje parece seguro."
                };
            }
            return {
                isScam: false,
                isFakeNews: false,
                hasVirus: false,
                reason: "No se pudo analizar el texto por un error inesperado."
            };
        }
    }

    private async getFactCheckInfo(query: string): Promise<string> {
        if (!this.googleSearchEngineId || !this.googleApiKey) {
            console.log("Google Search Engine ID o API Key no configurado. Omitiendo fact-checking.");
            return "La verificación de hechos externa no está disponible en este momento.";
        }
        try {
            const apiUrl = `https://www.googleapis.com/customsearch/v1`;
            const response = await axios.get(apiUrl, {
                params: {
                    key: this.googleApiKey,
                    cx: this.googleSearchEngineId,
                    q: `${query} es real o falso`, // Añadimos contexto a la búsqueda
                },
            });

            if (!response.data.items || response.data.items.length === 0) {
                return "No se encontraron resultados de búsqueda para verificar la información.";
            }

            // Extraemos los "snippets" (resúmenes) de los 3 primeros resultados
            const snippets = response.data.items
                .slice(0, 3)
                .map((item: any, index: number) => `Fuente ${index + 1}: "${item.snippet}"`)
                .join("\n");

            return `Resultados de búsqueda para verificación:\n${snippets}`;
        } catch (error: any) {
            console.error("Error al buscar con Google Custom Search:", error.message);
            return "Error al realizar la búsqueda para verificación de hechos.";
        }
    }

    private async checkForScamsAndFakeNews(message: string): Promise<{ isScam: boolean; isFakeNews: boolean; reason: string }> {
        try {
            const factCheckContext = await this.getFactCheckInfo(message);

            const prompt = `
                Actúa como un experto en ciberseguridad y un meticuloso verificador de hechos (fact-checker). Tu tarea es analizar el siguiente mensaje.

                **Contexto de Búsqueda Web:**
                ${factCheckContext}

                **Mensaje del Usuario a Analizar:**
                "${message}"

                **Instrucciones:**
                1.  **Análisis de Estafa (Scam):** Evalúa el mensaje del usuario en busca de indicadores de estafa (phishing, ofertas irreales, etc.).
                2.  **Análisis de Noticia Falsa (Fake News):** Usando el **Contexto de Búsqueda Web** proporcionado, determina si el mensaje del usuario contiene desinformación. Si el contexto contradice el mensaje, es probable que sea una noticia falsa.
                3.  **Razonamiento:** En "analysisSteps", razona paso a paso tus conclusiones para estafa y noticia falsa por separado.
                4.  **Veredicto Final:** Proporciona tu veredicto en un formato JSON estricto. La "reason" debe ser una explicación clara y unificada para el usuario final en español. Si la evidencia es clara, da una respuesta directa y segura. Si no hay peligro, indícalo.

                **Formato de Respuesta (JSON estricto únicamente):**
                {
                    "analysisSteps": "Aquí tu razonamiento paso a paso.",
                    "isScam": boolean,
                    "isFakeNews": boolean,
                    "reason": "Explicación unificada y clara para el usuario final en español."
                }
            `;

            const completion = await this.openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: "json_object" },
            });

            const result = JSON.parse(completion.choices[0].message.content || '{}');
            return {
                isScam: Boolean(result.isScam),
                isFakeNews: Boolean(result.isFakeNews),
                reason: result.reason || "Análisis completado."
            };
        } catch (error: any) {
            console.error("Error en checkForScamsAndFakeNews:", error);
            return { isScam: false, isFakeNews: false, reason: "No se pudo analizar el texto por un error." };
        }
    }

    private async checkForViruses(message: string): Promise<boolean> {
        const urls = message.match(/https?:\/\/[^\s]+/g) || [];
        if (urls.length === 0) {
            return false;
        }

        // Para respetar el límite de la API pública de VirusTotal (4 peticiones/minuto)
        // sin introducir largos retrasos que provoquen un timeout en el webhook,
        // analizamos un máximo de 4 URLs por mensaje.
        const urlsToCheck = urls.slice(0, 4);

        for (const url of urlsToCheck) {
            try {
                const apiUrl = 'https://www.virustotal.com/vtapi/v2/url/report';
                const response = await axios.get(apiUrl, {
                    params: {
                        apikey: this.virusTotalApiKey,
                        resource: url,
                    },
                    // Añadimos un timeout para evitar que la petición se quede colgada.
                    timeout: 10000 // 10 segundos
                });

                // If the URL has been scanned and has positives, it's malicious.
                if (response.data && response.data.positives > 0) {
                    console.log(`URL maliciosa detectada por VirusTotal: ${url}`);
                    return true; // Found a malicious URL, no need to check others.
                }
            } catch (error: any) {
                // Manejamos los errores de forma silenciosa para no detener el flujo.
                // 204: URL no encontrada en VirusTotal (la tratamos como segura).
                // 429: Demasiadas peticiones (respetamos el límite y continuamos).
                if (error.code === 'ECONNABORTED') {
                    console.error(`Timeout al comprobar con VirusTotal para la URL ${url}`);
                } else if (error.response && ![204, 429].includes(error.response.status)) {
                    console.error(`Error al comprobar con VirusTotal para la URL ${url}:`, error.message);
                }
                // Continue to the next URL even if one fails.
            }
        }

        return false; // No malicious URLs found after checking all of them.
    }
}