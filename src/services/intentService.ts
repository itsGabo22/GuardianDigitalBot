import OpenAI from 'openai';
import { config } from '../config';

// Definimos todos los tipos de intenciones que nuestro bot puede entender.
export type Intent = 
    | 'GREETING' 
    | 'ANALYSIS_REQUEST' 
    | 'FEEDBACK_POSITIVE' 
    | 'FEEDBACK_NEGATIVE' 
    | 'HELP_REQUEST'
    | 'UNKNOWN';

export class IntentService {
    private openai: OpenAI;

    constructor() {
        this.openai = new OpenAI({ apiKey: config.apiKeys.openAI });
    }

    public async getIntent(message: string): Promise<Intent> {
        // Para respuestas simples y comunes, usamos reglas para ahorrar llamadas a la API y dinero.
        const lowerMessage = message.toLowerCase().trim();
        if (lowerMessage === 'sí' || lowerMessage === 'si') return 'FEEDBACK_POSITIVE';
        if (lowerMessage === 'no') return 'FEEDBACK_NEGATIVE';

        try {
            const prompt = `
                Clasifica la intención del usuario en una de las siguientes categorías: GREETING, ANALYSIS_REQUEST, FEEDBACK_POSITIVE, FEEDBACK_NEGATIVE, HELP_REQUEST, UNKNOWN.
                - GREETING: Saludos como "hola", "buenos días", "qué tal".
                - ANALYSIS_REQUEST: Cualquier texto, enlace o audio que el usuario envíe para ser analizado. Es la intención por defecto si no encaja en otra.
                - FEEDBACK_POSITIVE: Respuestas afirmativas a la pregunta de si el análisis fue útil, como "sí", "me sirvió", "gracias".
                - FEEDBACK_NEGATIVE: Respuestas negativas como "no", "no me sirvió".
                - HELP_REQUEST: Peticiones de ayuda como "¿qué haces?", "ayuda", "info".
                - UNKNOWN: No se entiende la petición.

                Mensaje del usuario: "${message}"

                Responde únicamente con el objeto JSON en el formato:
                { "intent": "CATEGORIA" }
            `;

            const completion = await this.openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: "json_object" },
            });

            const result = JSON.parse(completion.choices[0].message.content || '{}');
            return result.intent || 'UNKNOWN';
        } catch (error) {
            console.error("Error al obtener la intención:", error);
            // Como fallback seguro, si falla la clasificación, asumimos que es una petición de análisis.
            return 'ANALYSIS_REQUEST';
        }
    }
}