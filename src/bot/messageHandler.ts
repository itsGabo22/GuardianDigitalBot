import { AnalysisService, AnalysisResult } from '../services/analysisService';
import { FeedbackService } from '../services/feedbackService';
import { config } from '../config'; // Import de la configuración
import { BaileysProvider } from '@builderbot/provider-baileys';
import { IntentService } from '../services/intentService';
import { TranscriptionService } from '../services/TranscriptionService';

interface IncomingWhatsAppMessage {
    from: string;
    body: string;
    mediaBuffer?: Buffer; // Buffer de audio
}

export interface InteractionContext {
    originalMessage: string;
    analysisResultText: string;
}

export class MessageHandler {
    private analysisService: AnalysisService;
    private feedbackService: FeedbackService;
    private intentService: IntentService;
    private transcriptionService: TranscriptionService;
    private userContext: Map<string, InteractionContext>;
    private provider: BaileysProvider; // Proveedor de BuilderBot para enviar mensajes
    private intentHandlers: Record<string, (userId: string, messageBody: string) => Promise<void>>;

    constructor(
        analysisService: AnalysisService, 
        feedbackService: FeedbackService, 
        intentService: IntentService,
        transcriptionService: TranscriptionService,
        provider: BaileysProvider, // Recibimos el proveedor de BuilderBot
        userContext: Map<string, InteractionContext> // Recibimos el contexto compartido
    ) {
        this.analysisService = analysisService;
        this.feedbackService = feedbackService;
        this.intentService = intentService;
        this.transcriptionService = transcriptionService;
        this.provider = provider;
        this.userContext = userContext;

        this.intentHandlers = {
            'GREETING': this.handleGreeting.bind(this),
            'HELP_REQUEST': this.handleHelpRequest.bind(this),
            'FEEDBACK_POSITIVE': (userId) => this.handleFeedback(userId, true),
            'FEEDBACK_NEGATIVE': (userId) => this.handleFeedback(userId, false),
            'ANALYSIS_REQUEST': this.handleAnalysisRequest.bind(this),
            'UNKNOWN': this.handleAnalysisRequest.bind(this),
        };
    }

    async handleIncomingMessage(message: IncomingWhatsAppMessage): Promise<void> {
        console.log(`[MessageHandler] Received message from ${message.from}: "${message.body}"`);
        try {
            const userId = message.from;
            const messageBody = message.body;

            // Si hay un archivo de audio, el cuerpo del mensaje estará vacío.
            // Le damos prioridad al audio y respondemos inmediatamente.
            if (message.mediaBuffer) {
                // Lanzamos el proceso en segundo plano y añadimos un .catch()
                // para asegurarnos de que cualquier error no manejado sea registrado.
                this.processAnalysisInBackground(userId, messageBody, message.mediaBuffer).catch(err => {
                    console.error('[MessageHandler] Unhandled error in background audio processing:', err);
                });
                await this.provider.sendText(userId, "🎙️ He recibido tu audio. Analizándolo... Dame un momento, por favor.");
                return;
            }

            // Paso 1: Clasificar la intención del usuario
            const intent = await this.intentService.getIntent(messageBody);
            const handler = this.intentHandlers[intent] ?? this.intentHandlers['UNKNOWN'];

            await handler(userId, messageBody);

        } catch (error) {
            console.error(`[MessageHandler] CRITICAL ERROR:`, error);
            // Opcionalmente, notificar al usuario que algo salió muy mal.
            // await this.provider.sendText(message.from, "Lo siento, estoy teniendo problemas internos. Por favor, intenta de nuevo más tarde.");
        }
    }

    private async handleGreeting(userId: string): Promise<void> {
        await this.provider.sendText(userId, this.getGreetingMessage());
    }

    private async handleHelpRequest(userId: string): Promise<void> {
        await this.provider.sendText(userId, this.getHelpMessage());
    }

    private getGreetingMessage(): string {
        return "👋 ¡Hola! Soy GuardianDigitalBot.\n\n" +
               "Reenvíame cualquier mensaje, enlace o audio que te parezca sospechoso y lo analizaré por ti.";
    }
    
    private getHelpMessage(): string {
        return "Soy tu asistente de ciberseguridad. Puedes reenviarme cualquier mensaje de texto, enlace o nota de voz que te parezca sospechosa. Analizaré el contenido para detectar posibles estafas, noticias falsas o enlaces peligrosos y te daré un veredicto para que navegues más seguro.";
    }

    private async handleFeedback(userId: string, wasHelpful: boolean): Promise<void> {
        if (this.userContext.has(userId)) {
            const context = this.userContext.get(userId)!;
            await this.feedbackService.logInteraction(userId, context.originalMessage, context.analysisResultText, wasHelpful);
            this.userContext.delete(userId);
            
            // 1. Enviamos la respuesta de agradecimiento
            const response = wasHelpful ? "¡Gracias por tu feedback! Me ayuda a mejorar. 😊" : "Lamento no haber sido de ayuda. Gracias por tu feedback, lo usaré para aprender. 👍";
            await this.provider.sendText(userId, response);
        } else {
            await this.provider.sendText(userId, "No tengo claro a qué te refieres. Si quieres analizar un nuevo mensaje, simplemente envíamelo.");
        }
    }

    private async handleAnalysisRequest(userId: string, messageBody: string): Promise<void> {
        this.processAnalysisInBackground(userId, messageBody);
        await this.provider.sendText(userId, "🔍 Analizando tu mensaje... Dame un momento, por favor. Te responderé en breve.");
    }

    private async transcribeAudioWithTimeout(mediaBuffer: Buffer, timeoutMs: number = 45000): Promise<string> {
        console.log(`[MessageHandler] Starting audio transcription. Setting a ${timeoutMs / 1000}s timeout.`);
        const transcriptionPromise = this.transcriptionService.transcribeAudio(mediaBuffer);

        const timeoutPromise = new Promise<string>((_, reject) => 
            setTimeout(() => reject(new Error(`Transcription timed out after ${timeoutMs / 1000} seconds`)), timeoutMs)
        );

        try {
            const content = await Promise.race([transcriptionPromise, timeoutPromise]);
            console.log(`[MessageHandler] Transcription successful.`);
            return content;
        } catch (transcriptionError) {
            console.error(`[MessageHandler] Transcription failed:`, transcriptionError);
            // Re-lanzamos un error más genérico para que sea capturado por la función que lo llama.
            throw new Error('Audio processing failed or timed out.');
        }
    }

    private async processAnalysisInBackground(userId: string, messageBody: string, mediaBuffer?: Buffer): Promise<void> {
        try {
            let contentToAnalyze = messageBody;
            let originalMessage = messageBody;

            // 1. Si hay un audio, transcribirlo primero con un timeout.
            if (mediaBuffer) {
                contentToAnalyze = await this.transcribeAudioWithTimeout(mediaBuffer);
                originalMessage = `[Audio]: ${contentToAnalyze}`; // Guardamos la transcripción para el contexto
            }

            // 2. Realizar el análisis pesado sobre el texto (original o transcrito)
            console.log(`[MessageHandler] Starting content analysis for user ${userId}.`);
            const analysisResult = await this.analysisService.analyzeMessage(contentToAnalyze);
            
            // Si el análisis devuelve un error (ej. API de OpenAI caída), no continuamos.
            if (!analysisResult.reason) {
                throw new Error('Analysis service returned an empty result.');
            }

            const { responseText, analysisSummary } = this.buildAnalysisResponse(analysisResult);
    
            // 3. Guardar el contexto para poder recibir feedback después
            this.userContext.set(userId, {
                originalMessage: originalMessage,
                analysisResultText: analysisSummary
            });
    
            const feedbackPrompt = `\n\n*¿Te fue útil este análisis? Responde 'sí' o 'no'.*`;
            const surveyPrompt = config.app.surveyUrl 
                ? `\n\nPor cierto, si deseas apoyar nuestra participación en la hackatón, puedes llenar esta breve encuesta (opcional):\n${config.app.surveyUrl}` 
                : '';
            const finalMessage = `${responseText}${feedbackPrompt}${surveyPrompt}`;
    
            // 4. Enviar el resultado final como un nuevo mensaje
            console.log(`[MessageHandler] Sending final analysis to user ${userId}.`);
            console.log(`[MessageHandler] Analysis successful for user ${userId}.`);
            await this.provider.sendText(userId, finalMessage);
            console.log(`[MessageHandler] Final analysis sent successfully to user ${userId}.`);
        } catch (error: any) {
            console.error(`Error during background analysis for user ${userId}:`, error);
            
            let errorMessage = "Lo siento, ocurrió un error al analizar tu mensaje. Por favor, inténtalo de nuevo más tarde.";
            if (error.message && error.message.includes('timed out')) {
                errorMessage = "🎙️ Lo siento, el audio es muy largo o la transcripción tardó demasiado. Por favor, intenta con un audio más corto.";
            }
            
            await this.provider.sendText(userId, errorMessage);
        }
    }

    private buildAnalysisResponse(result: AnalysisResult): { responseText: string, analysisSummary: string } {
        // Prioridad 1: Virus. Si hay virus, es la única respuesta importante.
        if (result.hasVirus) {
            return {
                responseText: `☣️ *¡ALERTA DE VIRUS!* ☣️\n\nSe ha detectado que uno o más enlaces en tu mensaje son potencialmente peligrosos. *No los abras.*`,
                analysisSummary: "Peligro de Virus Detectado."
            };
        }

        const titles: string[] = [];
        const summaryParts: string[] = [];

        // Prioridad 2: Estafa y Noticias Falsas
        if (result.isScam) {
            titles.push(`⚠️ *¡Alerta de Estafa!*`);
            summaryParts.push("Estafa Detectada.");
        }
        if (result.isFakeNews) {
            titles.push(`📰 *¡Noticia Falsa Detectada!*`);
            summaryParts.push("Noticia Falsa Detectada.");
        }

        // Si se detectó algo...
        if (titles.length > 0) {
            const responseText = `${titles.join('\n')}\n\n*Análisis:* ${result.reason}`;
            const analysisSummary = summaryParts.join(' ');
            return { responseText, analysisSummary };
        }

        // Prioridad 3: Noticia Verdadera
        if (result.isTrueNews) {
            return {
                responseText: `✅ *Información Verificada*\n\n${result.reason}`,
                analysisSummary: "Noticia Verificada como Real."
            };
        }

        // Si no se detectó nada, damos un mensaje de tranquilidad.
        return {
            responseText: `✅ *Mensaje Seguro*\n\n${result.reason}`,
            analysisSummary: "Mensaje analizado como seguro."
        };
    }
}
