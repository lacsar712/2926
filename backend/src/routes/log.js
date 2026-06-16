const express = require('express');
const db = require('../utils/db');
const logger = require('../utils/logger');

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const { action, username, page = 1, pageSize = 20 } = req.query;
        let sql = 'SELECT * FROM operation_log WHERE 1=1';
        const params = [];
        if (action) { sql += ' AND action LIKE ?'; params.push(`%${action}%`); }
        if (username) { sql += ' AND username LIKE ?'; params.push(`%${username}%`); }
        const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
        const [countResult] = await db.query(countSql, params);
        const limit = parseInt(pageSize);
        const offset = (parseInt(page) - 1) * limit;
        sql += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
        const rows = await db.query(sql, params);
        res.json({ success: true, data: { list: rows, total: countResult.total, page: parseInt(page), pageSize: parseInt(pageSize) } });
    } catch (error) {
        logger.error('Get logs error:', { message: error.message });
        res.status(500).json({ success: false, message: '获取操作日志失败' });
    }
});

module.exports = router;
