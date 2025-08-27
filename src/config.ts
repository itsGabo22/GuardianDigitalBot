export const config = {
    apiKeys: {
        openAI: process.env.OPENAI_API_KEY || '',
        google: process.env.GOOGLE_API_KEY || '',
        virusTotal: process.env.VIRUSTOTAL_API_KEY || '',
        googleSearchEngineId: process.env.GOOGLE_SEARCH_ENGINE_ID || '',
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