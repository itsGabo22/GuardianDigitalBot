import twilio from 'twilio';
import { config } from '../config';

export class NotificationService {
    private twilioClient?: twilio.Twilio;
    private fromNumber: string;

    constructor() {
        // Solo inicializa el cliente si las credenciales existen
        if (config.twilio.accountSid && config.twilio.authToken && config.twilio.phoneNumber) {
            this.twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
            this.fromNumber = config.twilio.phoneNumber;
        } else {
            console.warn("Twilio credentials not found. Notification service is disabled.");
            this.fromNumber = '';
        }
    }

    public async sendWhatsAppMessage(to: string, body: string): Promise<void> {
        if (!this.twilioClient || !this.fromNumber) {
            console.error("Cannot send message: Twilio is not configured.");
            return;
        }
        try {
            await this.twilioClient.messages.create({
                from: this.fromNumber,
                to: to, // El 'from' del mensaje original, ej: 'whatsapp:+57300...'
                body: body,
            });
            console.log(`Proactive message sent to ${to}`);
        } catch (error) {
            console.error(`Error sending proactive message to ${to}:`, error);
        }
    }
}