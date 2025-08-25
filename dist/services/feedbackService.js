"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedbackService = void 0;
class FeedbackService {
    constructor(dbClient) {
        this.dbClient = dbClient;
    }
    /**
     * Registra la interacción completa en la base de datos.
     * @param userId El ID del usuario de WhatsApp.
     * @param messageContent El mensaje original enviado por el usuario.
     * @param analysisResult Una descripción del resultado del análisis (ej. "Estafa detectada").
     * @param wasHelpful Un booleano que indica si el usuario encontró útil la respuesta.
     */
    async logInteraction(userId, messageContent, analysisResult, wasHelpful) {
        // La consulta SQL ahora coincide con las columnas de la tabla 'feedback' en schema.sql
        const query = `
            INSERT INTO feedback (user_id, message_content, analysis_result, was_helpful)
            VALUES ($1, $2, $3, $4)
        `;
        const values = [userId, messageContent, analysisResult, wasHelpful];
        try {
            // Usamos el método 'query' que definimos en nuestra clase DatabaseClient
            await this.dbClient.query(query, values);
            console.log('Feedback guardado en la base de datos.');
        }
        catch (error) {
            console.error("Error al guardar el feedback en la base de datos:", error);
        }
    }
}
exports.FeedbackService = FeedbackService;
