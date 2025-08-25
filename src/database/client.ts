import { Client } from 'pg';
import { config } from '../config';

export class DatabaseClient {
    private client: Client;

    constructor() {
        this.client = new Client({
            user: config.database.user,
            host: config.database.host,
            database: config.database.database,
            password: config.database.password,
            port: config.database.port,
        });
    }

    async connect() {
        await this.client.connect();
    }

    async disconnect() {
        await this.client.end();
    }

    async query(text: string, params?: any[]) {
        const res = await this.client.query(text, params);
        return res;
    }
}