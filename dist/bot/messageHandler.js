"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageHandler = void 0;
class MessageHandler {
    constructor(analysisService, feedbackService, intentService, transcriptionService, provider // Recibimos el proveedor en el constructor
    ) {
        this.analysisService = analysisService;
        this.feedbackService = feedbackService;
        this.intentService = intentService;
        this.transcriptionService = transcriptionService;
        this.userContext = new Map();
        this.provider = provider;
    }
    async handleIncomingMessage(message) {
        const userId = message.from;
        const messageBody = message.body;
        // Si hay un archivo de audio, el cuerpo del mensaje estará vacío.
        // Le damos prioridad al audio y respondemos inmediatamente.
        if (message.mediaUrl) {
            this.processAnalysisInBackground(userId, messageBody, message.mediaUrl);
            await this.provider.sendText(userId, "🎙️ He recibido tu audio. Analizándolo... Dame un momento, por favor.");
            return;
        }
        // Paso 1: Clasificar la intención del usuario
        const intent = await this.intentService.getIntent(messageBody);
        // Paso 2: Actuar según la intención (Enrutador)
        switch (intent) {
            case 'GREETING':
                await this.provider.sendText(userId, this.getGreetingMessage());
                return;
            case 'HELP_REQUEST':
                await this.provider.sendText(userId, this.getHelpMessage());
                return;
            case 'FEEDBACK_POSITIVE':
                await this.handleFeedback(userId, true);
                return;
            case 'FEEDBACK_NEGATIVE':
                await this.handleFeedback(userId, false);
                return;
            case 'ANALYSIS_REQUEST':
            case 'UNKNOWN': // Si no estamos seguros, lo más útil es analizarlo.
            default:
                this.processAnalysisInBackground(userId, messageBody, message.mediaUrl);
                await this.provider.sendText(userId, "🔍 Analizando tu mensaje... Dame un momento, por favor. Te responderé en breve.");
                return;
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
            const response = wasHelpful ? "¡Gracias por tu feedback! Me ayuda a mejorar. 😊" : "Lamento no haber sido de ayuda. Gracias por tu feedback, lo usaré para aprender. 👍";
            await this.provider.sendText(userId, response);
        }
        else {
            await this.provider.sendText(userId, "No tengo claro a qué te refieres. Si quieres analizar un nuevo mensaje, simplemente envíamelo.");
        }
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
            await this.provider.sendText(userId, finalMessage);
        }
        catch (error) {
            console.error(`Error during background analysis for user ${userId}:`, error);
            await this.provider.sendText(userId, "Lo siento, ocurrió un error al analizar tu mensaje. Por favor, inténtalo de nuevo más tarde.");
        }
    }
    buildAnalysisResponse(result) {
        // Prioridad 1: Virus. Si hay virus, es la única respuesta importante.
        if (result.hasVirus) {
            return {
                responseText: `☣️ **¡ALERTA DE VIRUS!** ☣️\n\nSe ha detectado que uno o más enlaces en tu mensaje son potencialmente peligrosos. **No los abras.**`,
                analysisSummary: "Peligro de Virus Detectado."
            };
        }
        const titles = [];
        const summaryParts = [];
        // Prioridad 2: Estafa y Noticias Falsas
        if (result.isScam) {
            titles.push(`⚠️ **¡Alerta de Estafa!**`);
            summaryParts.push("Estafa Detectada.");
        }
        if (result.isFakeNews) {
            titles.push(`📰 **¡Noticia Falsa Detectada!**`);
            summaryParts.push("Noticia Falsa Detectada.");
        }
        // Si se detectó algo...
        if (titles.length > 0) {
            const responseText = `${titles.join('\n')}\n\n**Análisis:** ${result.reason}`;
            const analysisSummary = summaryParts.join(' ');
            return { responseText, analysisSummary };
        }
        // Si no se detectó nada, damos un mensaje de tranquilidad.
        return {
            responseText: `✅ **Mensaje Seguro**\n\n${result.reason}`,
            analysisSummary: "Mensaje Seguro"
        };
    }
}
exports.MessageHandler = MessageHandler;
