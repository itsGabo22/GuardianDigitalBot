"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalysisService = void 0;
const openai_1 = __importDefault(require("openai"));
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../config");
class AnalysisService {
    constructor() {
        this.openai = new openai_1.default({ apiKey: config_1.config.apiKeys.openAI });
        this.googleApiKey = config_1.config.apiKeys.google;
    }
    async analyzeMessage(message) {
        try {
            // Ejecutamos las comprobaciones en paralelo para mayor eficiencia
            const [scamAndFakeNewsResult, virusResult] = await Promise.all([
                this.checkForScamsAndFakeNews(message),
                this.checkForViruses(message)
            ]);
            return {
                isScam: scamAndFakeNewsResult.isScam,
                isFakeNews: scamAndFakeNewsResult.isFakeNews,
                hasVirus: virusResult,
                reason: scamAndFakeNewsResult.reason,
            };
        }
        catch (error) {
            // Si ocurre un error de cuota, devolvemos una respuesta simulada
            if (error.code === 'insufficient_quota' || error.status === 429) {
                return {
                    isScam: false,
                    isFakeNews: false,
                    hasVirus: false,
                    reason: "⚠️ El análisis automático está temporalmente deshabilitado. Respuesta simulada: Tu mensaje parece seguro."
                };
            }
            // Otro error
            return {
                isScam: false,
                isFakeNews: false,
                hasVirus: false,
                reason: "No se pudo analizar el texto por un error inesperado."
            };
        }
    }
    /**
     * Utiliza la API de OpenAI para detectar estafas y noticias falsas.
     */
    async checkForScamsAndFakeNews(message) {
        try {
            const prompt = `
                Analiza el siguiente mensaje de un usuario. Determina si es una estafa (scam) o si contiene noticias falsas (fake news).
                Responde únicamente con un objeto JSON con el siguiente formato: {"isScam": boolean, "isFakeNews": boolean, "reason": "Una breve explicación en español de por qué lo consideras así."}
                
                Mensaje a analizar: "${message}"
            `;
            const completion = await this.openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: "json_object" }, // Forzamos la salida a JSON
            });
            const result = JSON.parse(completion.choices[0].message.content || '{}');
            return {
                isScam: result.isScam || false,
                isFakeNews: result.isFakeNews || false,
                reason: result.reason || "Análisis completado."
            };
        }
        catch (error) {
            console.error("Error al analizar con OpenAI:", error);
            return { isScam: false, isFakeNews: false, reason: "No se pudo analizar el texto." };
        }
    }
    /**
     * Utiliza la API de Google Safe Browsing para detectar URLs maliciosas.
     */
    async checkForViruses(message) {
        // Extraemos las URLs del mensaje con una expresión regular
        const urls = message.match(/https?:\/\/[^\s]+/g) || [];
        if (urls.length === 0) {
            return false; // No hay URLs que comprobar
        }
        try {
            const apiUrl = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${this.googleApiKey}`;
            const payload = {
                client: {
                    clientId: "guardian-digital-chatbot",
                    clientVersion: "1.0.0"
                },
                threatInfo: {
                    threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
                    platformTypes: ["ANY_PLATFORM"],
                    threatEntryTypes: ["URL"],
                    threatEntries: urls.map(url => ({ url: url }))
                }
            };
            const response = await axios_1.default.post(apiUrl, payload);
            // Si la respuesta contiene 'matches', se encontró una amenaza.
            return response.data && response.data.matches && response.data.matches.length > 0;
        }
        catch (error) {
            console.error("Error al comprobar con Google Safe Browsing:", error);
            return false;
        }
    }
}
exports.AnalysisService = AnalysisService;
