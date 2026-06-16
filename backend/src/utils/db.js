const mysql = require('mysql2/promise');
const logger = require('./logger');

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'pipeline_user',
    password: process.env.DB_PASSWORD || 'pipeline_pass_2024',
    database: process.env.DB_NAME || 'data_pipeline',
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const query = async (sql, params = []) => {
    try {
        const [rows] = await pool.execute(sql, params);
        return rows;
    } catch (error) {
        logger.error('Database query error:', { sql: sql.substring(0, 100), error: error.message });
        throw error;
    }
};

const testConnection = async () => {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
};

module.exports = { pool, query, testConnection };
