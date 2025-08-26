import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import { MessageHandler } from './bot/messageHandler';
import { DatabaseClient } from './database/client';
import { config } from './config';
import { AnalysisService } from './services/analysisService';
import { FeedbackService } from './services/feedbackService';
import { IntentService } from './services/intentService';
import { NotificationService } from './services/notificationService';
import { TranscriptionService } from './services/TranscriptionService';

const app = express();
const port = config.server.port;

// Agrega el middleware para datos urlencoded ANTES del JSON
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// --- Inyección de Dependencias ---
const databaseClient = new DatabaseClient();
const analysisService = new AnalysisService();
const intentService = new IntentService();
const transcriptionService = new TranscriptionService();
const notificationService = new NotificationService();
const feedbackService = new FeedbackService(databaseClient);
const messageHandler = new MessageHandler(analysisService, feedbackService, intentService, notificationService, transcriptionService);

// Endpoint para recibir los mensajes de WhatsApp
app.post('/webhook', async (req, res) => {
    try {
        const incomingMessage = {
            from: req.body.From,
            body: req.body.Body, // Texto del mensaje
            mediaUrl: req.body.MediaUrl0 // URL del archivo multimedia (si existe)
        };
        const response = await messageHandler.handleIncomingMessage(incomingMessage);
        // Envía la respuesta como texto plano para WhatsApp
        res.set('Content-Type', 'text/plain');
        res.send(response);
    } catch (error) {
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
    } catch (err) {
        console.error('Failed to connect to the database. Application not started.', err);
        process.exit(1);
    }
};

startServer();
