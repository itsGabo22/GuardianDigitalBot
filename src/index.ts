import dotenv from 'dotenv';
dotenv.config();
import { createBot, createProvider, createFlow, addKeyword, EVENTS } from '@builderbot/bot';
import { BaileysProvider } from '@builderbot/provider-baileys';
import { JsonFileDB as JsonDB } from '@builderbot/database-json';
import { downloadMediaMessage, WAMessage } from '@whiskeysockets/baileys';
import { MessageHandler, InteractionContext } from './bot/messageHandler';
import { DatabaseClient } from './database/client';
import { AnalysisService } from './services/analysisService';

import { FeedbackService } from './services/feedbackService';
import { IntentService } from './services/intentService';
import { config } from './config';
import { TranscriptionService } from './services/TranscriptionService';
import { installConsoleFilter } from '@leifermendez/baileys/lib/Utils/console-filter';

const main = async () => {
    // --- Filtro de Consola ---
    // Instala un filtro para ocultar los mensajes de sesión de Baileys que son muy "ruidosos".
    installConsoleFilter();

    // --- Inyección de Dependencias ---
    // Instanciamos los servicios UNA SOLA VEZ para mayor eficiencia
    const databaseClient = new DatabaseClient();
    const analysisService = new AnalysisService();
    const intentService = new IntentService();
    const transcriptionService = new TranscriptionService();
    const feedbackService = new FeedbackService(databaseClient);

    // Creamos el mapa de contexto aquí para que persista entre mensajes
    const userContext = new Map<string, InteractionContext>();

    // El flujo principal que captura todos los mensajes
    const adapterProvider = createProvider(BaileysProvider);
    const adapterFlow = createFlow([
        // Usamos los eventos WELCOME y ACTION para capturar cualquier mensaje.
        // WELCOME es para el primer mensaje y ACTION para los siguientes.
        addKeyword<BaileysProvider>([EVENTS.WELCOME, EVENTS.ACTION, EVENTS.VOICE_NOTE]).addAction(async (ctx, { provider }) => {
            // --- PASO DE DEPURACIÓN DEFINITIVO ---
            // Imprimimos todo el objeto 'ctx' para ver qué nos llega cuando se envía un audio.
            console.log('[DEBUG] Full context object (ctx):', JSON.stringify(ctx, null, 2));

            // Creamos una instancia de MessageHandler para cada mensaje.
            console.log(`[Flow] Captured message: "${ctx.body}". Passing to MessageHandler.`);
            // Esto es seguro para el estado y asegura que el `provider` correcto
            // (que gestiona la conexión) se utilice para la respuesta.
            const messageHandler = new MessageHandler(
                analysisService, 
                feedbackService, 
                intentService, 
                transcriptionService,
                provider, // Pasamos el proveedor de BuilderBot
                userContext // Pasamos el contexto compartido
            );

            let mediaBuffer: Buffer | undefined;
            // Corregimos la ruta para acceder a la URL del audio, según el log de depuración.
            if (ctx.message?.audioMessage) {
                console.log('[Flow] Audio message detected. Downloading and decrypting...');
                try {
                    // Usamos la función de Baileys para descargar y desencriptar el audio.
                    // Esto es crucial porque los audios de WhatsApp vienen encriptados.
                    const buffer = await downloadMediaMessage(
                        ctx as unknown as WAMessage, // Forzamos la conversión de tipos para que sea compatible con Baileys
                        'buffer',
                        {},
                        {
                            logger: provider.vendor.logger, // Usamos el logger de la instancia del proveedor
                            reuploadRequest: provider.vendor.updateMediaMessage,
                        }
                    );
                    mediaBuffer = buffer as Buffer;
                    console.log('[Flow] Media downloaded and decrypted successfully.');
                } catch (err) {
                    console.error('[Flow] CRITICAL: Failed to download media.', err);
                }
            }

            // Adaptamos el mensaje de BuilderBot a nuestra interfaz
            const incomingMessage = {
                from: ctx.key.remoteJid, // Usamos el JID completo para compatibilidad con Baileys
                body: ctx.body,
                mediaBuffer: mediaBuffer // Pasamos el buffer del audio
            };

            await messageHandler.handleIncomingMessage(incomingMessage);
        }),
    ]);
    
    const adapterDB = new JsonDB();

    try {
        await databaseClient.connect();
        console.log('Connected to the database successfully.');

        const bot = await createBot({
            flow: adapterFlow,
            provider: adapterProvider,
            database: adapterDB, // Usamos el adaptador JSON
        });


        const PORT = config.server.port ?? 3002;
        bot.httpServer(PORT);

        console.log(`[Servidor HTTP] Escuchando en el puerto ${PORT}`);
        console.log('[Bot] GuardianDigitalBot está listo. Esperando el código QR...');
    } catch (err) {
        console.error('Failed to connect to the database or start the bot.', err);
        process.exit(1);
    }
};

main();
