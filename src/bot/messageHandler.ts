import { AnalysisService, AnalysisResult } from '../services/analysisService';
import { FeedbackService } from '../services/feedbackService';
import { BaileysProvider } from '@builderbot/provider-baileys';
import { IntentService } from '../services/intentService';
import { TranscriptionService } from '../services/TranscriptionService';

interface IncomingWhatsAppMessage {
    from: string;
    body: string;
    mediaBuffer?: Buffer; // El buffer del audio vendrá aquí
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
    private provider: BaileysProvider; // El proveedor de BuilderBot para enviar mensajes

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
                    this.processAnalysisInBackground(userId, messageBody);
                    await this.provider.sendText(userId, "🔍 Analizando tu mensaje... Dame un momento, por favor. Te responderé en breve.");
                    return;
            }
        } catch (error) {
            console.error(`[MessageHandler] CRITICAL ERROR:`, error);
            // Opcionalmente, notificar al usuario que algo salió muy mal.
            // await this.provider.sendText(message.from, "Lo siento, estoy teniendo problemas internos. Por favor, intenta de nuevo más tarde.");
        }
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

            // 2. (NUEVO) Enviamos el mensaje opcional con el formulario
            const formMessage = "Por cierto, como parte de la hackatón, estamos recopilando información sobre ciberseguridad. ¿Te gustaría llenar una breve encuesta (opcional)?\n\nhttps://sensibilizacion.ciberpaz.gov.co/#/data-ciberpaz/response/116?type=public";
            // Añadimos un pequeño retraso para que no se sienta como spam
            await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5 segundos de retraso
            await this.provider.sendText(userId, formMessage);
        } else {
            await this.provider.sendText(userId, "No tengo claro a qué te refieres. Si quieres analizar un nuevo mensaje, simplemente envíamelo.");
        }
    }

    private async processAnalysisInBackground(userId: string, messageBody: string, mediaBuffer?: Buffer): Promise<void> {
        try {
            let contentToAnalyze = messageBody;
            let originalMessage = messageBody;

            // 1. Si hay un audio, transcribirlo primero con un timeout.
            if (mediaBuffer) {
                console.log(`[MessageHandler] Starting audio transcription for user ${userId}. Setting a 45s timeout.`);
                const transcriptionPromise = this.transcriptionService.transcribeAudio(mediaBuffer);

                // Añadimos un timeout para evitar que el proceso se quede colgado indefinidamente.
                const timeoutPromise = new Promise<string>((_, reject) => 
                    setTimeout(() => reject(new Error('Transcription timed out after 45 seconds')), 45000)
                );

                try {
                    contentToAnalyze = await Promise.race([transcriptionPromise, timeoutPromise]);
                    console.log(`[MessageHandler] Transcription successful for user ${userId}.`);
                } catch (transcriptionError) {
                    // Si el error es por el timeout, lo registramos y lanzamos un error general.
                    console.error(`[MessageHandler] Transcription failed for user ${userId}:`, transcriptionError);
                    throw new Error('Audio processing failed or timed out.');
                }
                originalMessage = `[Audio]: ${contentToAnalyze}`; // Guardamos la transcripción para el contexto
            }

            // 2. Realizar el análisis pesado sobre el texto (original o transcrito)
            console.log(`[MessageHandler] Starting content analysis for user ${userId}.`);
            const analysisResult = await this.analysisService.analyzeMessage(contentToAnalyze);
            
            // Si el análisis devuelve un error (ej. API de OpenAI caída), no continuamos.
            if (!analysisResult.reason) {
                throw new Error('Analysis service returned an empty result.');
            }

            console.log(`[MessageHandler] Analysis successful for user ${userId}.`);
            const { responseText, analysisSummary } = this.buildAnalysisResponse(analysisResult);
    
            // 3. Guardar el contexto para poder recibir feedback después
            this.userContext.set(userId, {
                originalMessage: originalMessage,
                analysisResultText: analysisSummary
            });
    
            const finalMessage = `${responseText}\n\n*¿Te fue útil este análisis? Responde 'sí' o 'no'.*`;
    
            // 4. Enviar el resultado final como un nuevo mensaje
            console.log(`[MessageHandler] Sending final analysis to user ${userId}.`);
            await this.provider.sendText(userId, finalMessage);
            console.log(`[MessageHandler] Final analysis sent successfully to user ${userId}.`);
        } catch (error) {
            console.error(`Error during background analysis for user ${userId}:`, error);
            await this.provider.sendText(userId, "Lo siento, ocurrió un error al analizar tu mensaje. Por favor, inténtalo de nuevo más tarde.");
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

        // Si no se detectó nada, damos un mensaje de tranquilidad.
        return {
            responseText: `✅ *Mensaje Seguro*\n\n${result.reason}`,
            analysisSummary: "Mensaje analizado como seguro."
        };
    }
}