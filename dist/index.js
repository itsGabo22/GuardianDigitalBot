"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const messageHandler_1 = require("./bot/messageHandler");
const client_1 = require("./database/client");
const config_1 = require("./config");
const analysisService_1 = require("./services/analysisService");
const feedbackService_1 = require("./services/feedbackService");
const app = (0, express_1.default)();
const port = config_1.config.server.port;
// Agrega el middleware para datos urlencoded ANTES del JSON
app.use(body_parser_1.default.urlencoded({ extended: false }));
app.use(body_parser_1.default.json());
// --- Inyección de Dependencias ---
const databaseClient = new client_1.DatabaseClient();
const analysisService = new analysisService_1.AnalysisService();
const feedbackService = new feedbackService_1.FeedbackService(databaseClient);
const messageHandler = new messageHandler_1.MessageHandler(analysisService, feedbackService);
// Endpoint para recibir los mensajes de WhatsApp
app.post('/webhook', async (req, res) => {
    try {
        const incomingMessage = {
            from: req.body.From,
            body: req.body.Body
        };
        const response = await messageHandler.handleIncomingMessage(incomingMessage);
        // Envía la respuesta como texto plano para WhatsApp
        res.set('Content-Type', 'text/plain');
        res.send(response);
    }
    catch (error) {
        console.error('Error handling webhook:', error);
        res.status(500).send('Error interno');
    }
});
const startServer = async () => {
    try {
        await databaseClient.connect();
        console.log('Connected to the database successfully.');
        app.listen(port, () => {
            console.log(`WhatsApp AI Chatbot is running on port ${port}`);
        });
    }
    catch (err) {
        console.error('Failed to connect to the database. Application not started.', err);
        process.exit(1);
    }
};
startServer();
