export const config = {
    apiKeys: {
        openAI: process.env.OPENAI_API_KEY || '',
        google: process.env.GOOGLE_API_KEY || '',
        virusTotal: process.env.VIRUSTOTAL_API_KEY || '',
        googleSearchEngineId: process.env.GOOGLE_SEARCH_ENGINE_ID || '',
    },
    database: {
        url: process.env.DATABASE_URL || ''
    },
    server: {
        port: Number(process.env.PORT) || 3000
    },
    app: {
        surveyUrl: process.env.SURVEY_URL || ''
    }
};