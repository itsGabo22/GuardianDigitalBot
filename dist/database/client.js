"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseClient = void 0;
const pg_1 = require("pg");
const config_1 = require("../config");
class DatabaseClient {
    constructor() {
        this.client = new pg_1.Client({
            user: config_1.config.database.user,
            host: config_1.config.database.host,
            database: config_1.config.database.database,
            password: config_1.config.database.password,
            port: config_1.config.database.port,
        });
    }
    async connect() {
        await this.client.connect();
    }
    async disconnect() {
        await this.client.end();
    }
    async query(text, params) {
        const res = await this.client.query(text, params);
        return res;
    }
}
exports.DatabaseClient = DatabaseClient;
