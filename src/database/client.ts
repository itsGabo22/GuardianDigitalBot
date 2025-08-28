import { Pool } from 'pg';
import { config } from '../config';

export class DatabaseClient {
    private pool: Pool;

    constructor() {
        this.pool = new Pool({
            connectionString: config.database.url,
            ssl: { rejectUnauthorized: false } // Necesario para conexiones remotas en Render
        });
    }

    async connect() {
        // El pool se conecta automáticamente, pero podemos probar la conexión.
        try {
            await this.pool.query('SELECT NOW()');
        } catch (err) {
            console.error('Database pool connection error', err);
            throw err;
        }
    }

    async disconnect() {
        await this.pool.end();
    }

    async query(text: string, params?: any[]) {
        const res = await this.pool.query(text, params);
        return res;
    }
}