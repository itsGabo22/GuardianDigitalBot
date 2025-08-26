import OpenAI from 'openai';
import axios from 'axios';
import { config } from '../config';
import { toFile } from 'openai/uploads';

export class TranscriptionService {
    private openai: OpenAI;
    private twilioAccountSid: string;
    private twilioAuthToken: string;

    constructor() {
        this.openai = new OpenAI({ apiKey: config.apiKeys.openAI });
        this.twilioAccountSid = config.twilio.accountSid;
        this.twilioAuthToken = config.twilio.authToken;
    }

    public async transcribeAudio(audioUrl: string): Promise<string> {
        try {
            // 1. Descargar el audio desde la URL de Twilio con autenticación.
            // Las URLs de medios de Twilio requieren autenticación.
            const response = await axios.get(audioUrl, {
                responseType: 'arraybuffer',
                auth: {
                    username: this.twilioAccountSid,
                    password: this.twilioAuthToken
                }
            });
            const audioBuffer = Buffer.from(response.data);

            // 2. Convertir el buffer a un formato que la API de OpenAI entienda.
            const audioFile = await toFile(audioBuffer, 'audio.ogg');

            // 3. Enviar el audio a OpenAI Whisper para transcribirlo.
            const transcription = await this.openai.audio.transcriptions.create({
                file: audioFile,
                model: "whisper-1",
                response_format: "text"
            });

            // 4. Devolver el texto transcrito.
            return transcription || "La transcripción no generó texto.";
        } catch (error: any) {
            console.error("Error transcribiendo audio:", error);
            if (axios.isAxiosError(error)) {
                // Loguear detalles específicos si es un error de Axios (como el 401 que vimos).
                console.error("Detalles del error de Axios:", error.response?.status, error.response?.data?.toString());
            }
            return "Error: No se pudo transcribir el audio.";
        }
    }
}
