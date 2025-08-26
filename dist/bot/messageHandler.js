"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageHandler = void 0;
class MessageHandler {
    constructor(analysisService, feedbackService, intentService, notificationService, transcriptionService) {
        this.analysisService = analysisService;
        this.feedbackService = feedbackService;
        this.intentService = intentService;
        this.notificationService = notificationService;
        this.transcriptionService = transcriptionService;
        this.userContext = new Map();
    }
    async handleIncomingMessage(message) {
        const userId = message.from;
        const messageBody = message.body;
        // Si hay un archivo de audio, el cuerpo del mensaje estará vacío.
        // Le damos prioridad al audio y respondemos inmediatamente.
        if (message.mediaUrl) {
            this.processAnalysisInBackground(userId, messageBody, message.mediaUrl);
            return "🎙️ He recibido tu audio. Analizándolo... Dame un momento, por favor.";
        }
        // Paso 1: Clasificar la intención del usuario
        const intent = await this.intentService.getIntent(messageBody);
        // Paso 2: Actuar según la intención (Enrutador)
        switch (intent) {
            case 'GREETING':
                return this.getGreetingMessage();
            case 'HELP_REQUEST':
                return this.getHelpMessage();
            case 'FEEDBACK_POSITIVE':
                return this.handleFeedback(userId, true);
            case 'FEEDBACK_NEGATIVE':
                return this.handleFeedback(userId, false);
            case 'ANALYSIS_REQUEST':
            case 'UNKNOWN': // Si no estamos seguros, lo más útil es analizarlo.
            default:
                // No esperamos a que termine el análisis. Lanzamos la tarea en segundo plano.
                this.processAnalysisInBackground(userId, messageBody, message.mediaUrl);
                // Y respondemos inmediatamente para evitar el timeout.
                return "🔍 Analizando tu mensaje... Dame un momento, por favor. Te responderé en breve.";
        }
    }
    getGreetingMessage() {
        return "👋 ¡Hola! Soy GuardianDigitalBot.\n\n" +
            "Reenvíame cualquier mensaje, enlace o audio que te parezca sospechoso y lo analizaré por ti.";
    }
    getHelpMessage() {
        return "Puedo ayudarte a estar más seguro en línea. Simplemente reenvíame un mensaje y te diré si parece peligroso.\n\n" +
            "Analizo:\n" +
            "1️⃣ **Textos:** Para detectar estafas y engaños.\n" +
            "2️⃣ **Noticias:** Para verificar si son falsas.\n" +
            "3️⃣ **Enlaces:** Para buscar virus o phishing.\n" +
            "4️⃣ **Audios:** Transcribo y analizo el contenido.";
    }
    async handleFeedback(userId, wasHelpful) {
        if (this.userContext.has(userId)) {
            const context = this.userContext.get(userId);
            await this.feedbackService.logInteraction(userId, context.originalMessage, context.analysisResultText, wasHelpful);
            this.userContext.delete(userId);
            return wasHelpful ? "¡Gracias por tu feedback! Me ayuda a mejorar. 😊" : "Lamento no haber sido de ayuda. Gracias por tu feedback, lo usaré para aprender. 👍";
        }
        return "No tengo claro a qué te refieres. Si quieres analizar un nuevo mensaje, simplemente envíamelo.";
    }
    async processAnalysisInBackground(userId, messageBody, mediaUrl) {
        try {
            let contentToAnalyze = messageBody;
            let originalMessage = messageBody;
            // 1. Si hay un audio, transcribirlo primero.
            if (mediaUrl) {
                contentToAnalyze = await this.transcriptionService.transcribeAudio(mediaUrl);
                originalMessage = `[Audio]: ${contentToAnalyze}`; // Guardamos la transcripción para el contexto
            }
            // 2. Realizar el análisis pesado sobre el texto (original o transcrito)
            const analysisResult = await this.analysisService.analyzeMessage(contentToAnalyze);
            const { responseText, analysisSummary } = this.buildAnalysisResponse(analysisResult);
            // 3. Guardar el contexto para poder recibir feedback después
            this.userContext.set(userId, {
                originalMessage: originalMessage,
                analysisResultText: analysisSummary
            });
            const finalMessage = `${responseText}\n\n*¿Te fue útil este análisis? Responde 'sí' o 'no'.*`;
            // 4. Enviar el resultado final como un nuevo mensaje
            await this.notificationService.sendWhatsAppMessage(userId, finalMessage);
        }
        catch (error) {
            console.error(`Error during background analysis for user ${userId}:`, error);
            await this.notificationService.sendWhatsAppMessage(userId, "Lo siento, ocurrió un error al analizar tu mensaje. Por favor, inténtalo de nuevo más tarde.");
        }
    }
    buildAnalysisResponse(result) {
        let responseText = '';
        let analysisSummary = '';
        const reasons = new Set(); // Usamos un Set para evitar razones duplicadas
        // Prioridad 1: Virus. Si hay virus, es la única respuesta importante.
        if (result.hasVirus) {
            analysisSummary = "Peligro de Virus Detectado.";
            responseText = `☣️ **¡ALERTA DE VIRUS!** ☣️\n\nSe ha detectado que uno o más enlaces en tu mensaje son potencialmente peligrosos. **No los abras.**`;
            return { responseText, analysisSummary }; // Salimos inmediatamente.
        }
        // Prioridad 2: Estafa y Noticias Falsas
        if (result.isScam) {
            analysisSummary += "Estafa Detectada. ";
            responseText += `⚠️ **¡Alerta de Estafa!**\n`;
            reasons.add(result.reason);
        }
        if (result.isFakeNews) {
            analysisSummary += "Noticia Falsa Detectada. ";
            responseText += `📰 **¡Noticia Falsa Detectada!**\n`;
            reasons.add(result.reason);
        }
        // Si no se detectó nada, damos un mensaje de tranquilidad.
        if (responseText === '') {
            analysisSummary = "Mensaje Seguro";
            responseText = `✅ **Mensaje Seguro**\n\n${result.reason}`;
        }
        else { // Si se detectó algo, añadimos las razones al final.
            responseText += `\n**Análisis:** ${Array.from(reasons).join(' ')}`;
        }
        return { responseText, analysisSummary: analysisSummary.trim() };
    }
}
exports.MessageHandler = MessageHandler;
