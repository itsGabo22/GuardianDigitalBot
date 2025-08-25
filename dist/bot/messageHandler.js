"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageHandler = void 0;
class MessageHandler {
    constructor(analysisService, feedbackService) {
        this.analysisService = analysisService;
        this.feedbackService = feedbackService;
        this.userContext = new Map();
    }
    async handleIncomingMessage(message) {
        const userId = message.from;
        const messageBody = message.body.toLowerCase().trim();
        // --- PASO 1: Comprobar si el mensaje es una respuesta de feedback ---
        if (this.userContext.has(userId) && (messageBody === 'sí' || messageBody === 'si')) {
            const context = this.userContext.get(userId);
            await this.feedbackService.logInteraction(userId, context.originalMessage, context.analysisResultText, true);
            this.userContext.delete(userId); // Limpiamos el contexto
            return "¡Gracias por tu feedback! Me ayuda a mejorar. 😊";
        }
        if (this.userContext.has(userId) && messageBody === 'no') {
            const context = this.userContext.get(userId);
            await this.feedbackService.logInteraction(userId, context.originalMessage, context.analysisResultText, false);
            this.userContext.delete(userId); // Limpiamos el contexto
            return "Lamento no haber sido de ayuda. Gracias por tu feedback, lo usaré para aprender. 👍";
        }
        // --- PASO 2: Si no es feedback, es un nuevo mensaje para analizar ---
        const analysisResult = await this.analysisService.analyzeMessage(message.body);
        let responseText;
        let analysisSummary;
        if (analysisResult.isScam) {
            analysisSummary = "Estafa Detectada";
            responseText = `⚠️ ¡Alerta de Estafa! ${analysisResult.reason}`;
        }
        else if (analysisResult.isFakeNews) {
            analysisSummary = "Noticia Falsa Detectada";
            responseText = `📰 ¡Noticia Falsa Detectada! ${analysisResult.reason}`;
        }
        else if (analysisResult.hasVirus) {
            analysisSummary = "Peligro de Virus Detectado";
            responseText = `☣️ ¡Peligro de Virus! El enlace podría ser malicioso. Te recomiendo no abrirlo.`;
        }
        else {
            analysisSummary = "Mensaje Seguro";
            responseText = `✅ Tu mensaje parece seguro. ${analysisResult.reason}`;
        }
        // --- PASO 3: Guardar el contexto y pedir feedback ---
        this.userContext.set(userId, {
            originalMessage: message.body,
            analysisResultText: analysisSummary
        });
        // Añadimos la pregunta de feedback a la respuesta.
        return `${responseText}\n\n*¿Te fue útil este análisis? Responde 'sí' o 'no'.*`;
    }
}
exports.MessageHandler = MessageHandler;
