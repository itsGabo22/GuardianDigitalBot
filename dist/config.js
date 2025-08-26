"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.config = {
    apiKeys: {
        openAI: process.env.OPENAI_API_KEY || '',
        google: process.env.GOOGLE_API_KEY || '',
        virusTotal: process.env.VIRUSTOTAL_API_KEY || '',
        googleSearchEngineId: process.env.GOOGLE_SEARCH_ENGINE_ID || '',
    },
    twilio: {
        accountSid: process.env.TWILIO_ACCOUNT_SID || '',
        authToken: process.env.TWILIO_AUTH_TOKEN || '',
        phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
    },
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 5432,
        user: process.env.DB_USER || 'GuardianPerson',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'GuardianDigital'
    },
    server: {
        port: Number(process.env.PORT) || 3000
    },
};
