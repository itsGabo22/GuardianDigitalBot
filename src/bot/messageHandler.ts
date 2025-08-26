import { AnalysisService, AnalysisResult } from '../services/analysisService';
import { FeedbackService } from '../services/feedbackService';
import { IntentService } from '../services/intentService';
import { NotificationService } from '../services/notificationService';
import { TranscriptionService } from '../services/TranscriptionService';

interface IncomingWhatsAppMessage {
    from: string;
    body: string;
    mediaUrl?: string; // El audio vendrá aquí
}

interface InteractionContext {
    originalMessage: string;
    analysisResultText: string;
}

export class MessageHandler {
    private analysisService: AnalysisService;
    private feedbackService: FeedbackService;
    private intentService: IntentService;
    private notificationService: NotificationService;
    private transcriptionService: TranscriptionService;
    private userContext: Map<string, InteractionContext>;

    constructor(
        analysisService: AnalysisService, 
        feedbackService: FeedbackService, 
        intentService: IntentService,
        notificationService: NotificationService,
        transcriptionService: TranscriptionService
    ) {
        this.analysisService = analysisService;
        this.feedbackService = feedbackService;
        this.intentService = intentService;
        this.notificationService = notificationService;
        this.transcriptionService = transcriptionService;
        this.userContext = new Map();
    }

    async handleIncomingMessage(message: IncomingWhatsAppMessage): Promise<string> {
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

    private getGreetingMessage(): string {
        return "👋 ¡Hola! Soy GuardianDigitalBot.\n\n" +
               "Reenvíame cualquier mensaje, enlace o audio que te parezca sospechoso y lo analizaré por ti.";
    }
    
    private getHelpMessage(): string {
        return "Puedo ayudarte a estar más seguro en línea. Simplemente reenvíame un mensaje y te diré si parece peligroso.\n\n" +
               "Analizo:\n" +
               "1️⃣ **Textos:** Para detectar estafas y engaños.\n" +
               "2️⃣ **Noticias:** Para verificar si son falsas.\n" +
               "3️⃣ **Enlaces:** Para buscar virus o phishing.\n" +
               "4️⃣ **Audios:** Transcribo y analizo el contenido.";
    }

    private async handleFeedback(userId: string, wasHelpful: boolean): Promise<string> {
        if (this.userContext.has(userId)) {
            const context = this.userContext.get(userId)!;
            await this.feedbackService.logInteraction(userId, context.originalMessage, context.analysisResultText, wasHelpful);
            this.userContext.delete(userId);
            return wasHelpful ? "¡Gracias por tu feedback! Me ayuda a mejorar. 😊" : "Lamento no haber sido de ayuda. Gracias por tu feedback, lo usaré para aprender. 👍";
        }
        return "No tengo claro a qué te refieres. Si quieres analizar un nuevo mensaje, simplemente envíamelo.";
    }

    private async processAnalysisInBackground(userId: string, messageBody: string, mediaUrl?: string): Promise<void> {
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
        } catch (error) {
            console.error(`Error during background analysis for user ${userId}:`, error);
            await this.notificationService.sendWhatsAppMessage(userId, "Lo siento, ocurrió un error al analizar tu mensaje. Por favor, inténtalo de nuevo más tarde.");
        }
    }

    private buildAnalysisResponse(result: AnalysisResult): { responseText: string, analysisSummary: string } {
        // Prioridad 1: Virus. Si hay virus, es la única respuesta importante.
        if (result.hasVirus) {
            return {
                responseText: `☣️ **¡ALERTA DE VIRUS!** ☣️\n\nSe ha detectado que uno o más enlaces en tu mensaje son potencialmente peligrosos. **No los abras.**`,
                analysisSummary: "Peligro de Virus Detectado."
            };
        }

        const titles: string[] = [];
        const summaryParts: string[] = [];

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