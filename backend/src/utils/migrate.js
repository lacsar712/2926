const fs = require('fs');
const path = require('path');
const db = require('./db');
const logger = require('./logger');

const runMigrations = async () => {
    const sqlPath = path.join(__dirname, '../../migrations/migrate-missing-tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    const statements = sql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s && !s.startsWith('--'));

    for (const statement of statements) {
        await db.query(statement);
    }

    logger.info('Database schema migration completed');
};

module.exports = { runMigrations };
