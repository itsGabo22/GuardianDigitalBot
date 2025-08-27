"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const bot_1 = require("@builderbot/bot");
const provider_baileys_1 = require("@builderbot/provider-baileys");
const messageHandler_1 = require("./bot/messageHandler");
const client_1 = require("./database/client");
const analysisService_1 = require("./services/analysisService");
const feedbackService_1 = require("./services/feedbackService");
const intentService_1 = require("./services/intentService");
const TranscriptionService_1 = require("./services/TranscriptionService");
const main = async () => {
    // --- Inyección de Dependencias ---
    const databaseClient = new client_1.DatabaseClient();
    const analysisService = new analysisService_1.AnalysisService();
    const intentService = new intentService_1.IntentService();
    const transcriptionService = new TranscriptionService_1.TranscriptionService();
    const feedbackService = new feedbackService_1.FeedbackService(databaseClient);
    // El flujo principal que captura todos los mensajes
    const mainFlow = (0, bot_1.addKeyword)('__capture_all__')
        .addAction(async (ctx, { provider }) => {
        // Inicializamos el MessageHandler aquí para tener acceso al provider
        const messageHandler = new messageHandler_1.MessageHandler(analysisService, feedbackService, intentService, transcriptionService, provider // Pasamos el proveedor de BuilderBot
        );
        // Adaptamos el mensaje de BuilderBot a nuestra interfaz
        const incomingMessage = {
            from: ctx.from,
            body: ctx.body,
            mediaUrl: ctx.media?.url // BuilderBot puede tener la URL del medio aquí
        };
        await messageHandler.handleIncomingMessage(incomingMessage);
    });
    const adapterFlow = (0, bot_1.createFlow)([mainFlow]);
    const adapterProvider = (0, bot_1.createProvider)(provider_baileys_1.BaileysProvider);
    (0, bot_1.createBot)({ flow: adapterFlow, provider: adapterProvider, database: undefined });
    try {
        await databaseClient.connect();
        console.log('Connected to the database successfully.');
        console.log('GuardianDigitalBot está listo. Escanea el código QR con tu WhatsApp.');
    }
    catch (err) {
        console.error('Failed to connect to the database. Application not started.', err);
        process.exit(1);
    }
};
main();
