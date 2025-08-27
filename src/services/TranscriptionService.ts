import OpenAI from 'openai';
import { toFile } from 'openai/uploads';
import { config } from '../config';

export class TranscriptionService {
    private openai: OpenAI;

    constructor() {
        this.openai = new OpenAI({ apiKey: config.apiKeys.openAI });
    }

    public async transcribeAudio(audioBuffer: Buffer): Promise<string> {
        console.log('[TranscriptionService] Starting audio transcription...');
        try {
            // 1. Usar el helper 'toFile' para preparar el buffer para la API.
            // Es más robusto especificar el tipo MIME directamente.
            console.log('[TranscriptionService] Preparing audio buffer for OpenAI API...');
            const audioFile = await toFile(audioBuffer, 'audio.ogg', { type: 'audio/ogg' });
            console.log('[TranscriptionService] Audio buffer prepared successfully.');

            // 2. Enviar el archivo a OpenAI para su transcripción
            console.log('[TranscriptionService] Sending audio to Whisper API...');
            const transcription = await this.openai.audio.transcriptions.create({
                file: audioFile,
                model: 'whisper-1',
            });
            console.log(`[TranscriptionService] Transcription received successfully: "${transcription.text}"`);

            return transcription.text;
        } catch (error) {
            // Logueamos el error completo para tener más detalles en la consola.
            console.error(`[TranscriptionService] CRITICAL: Failed to process audio buffer.`, error);
            // Lanzamos un error personalizado para que el MessageHandler lo pueda atrapar y notificar al usuario.
            throw new Error('No se pudo procesar el archivo de audio. Es posible que el formato no sea compatible o haya un problema con el servicio.');
        }
    }
}
