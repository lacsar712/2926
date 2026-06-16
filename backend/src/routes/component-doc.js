const express = require('express');
const db = require('../utils/db');
const logger = require('../utils/logger');
const { roleGuard } = require('../middleware/auth');

const router = express.Router();

const VALID_CATEGORIES = [
    'data-access',
    'data-preprocess',
    'model-labeling',
    'entity-extract',
    'relation-build',
    'knowledge-production',
    'data-browse'
];

const parseJsonField = (item, field) => {
    if (item[field] && typeof item[field] === 'string') {
        try {
            item[field] = JSON.parse(item[field]);
        } catch (e) {
            item[field] = [];
        }
    }
};

router.get('/', async (req, res) => {
    try {
        const { category, keyword } = req.query;
        let sql = `SELECT d.*, u.nickname as updater_name
                   FROM component_doc d
                   LEFT JOIN sys_user u ON d.updated_by = u.id
                   WHERE 1=1`;
        const params = [];

        if (category) {
            sql += ` AND d.category = ?`;
            params.push(category);
        }

        if (keyword) {
            sql += ` AND (d.name LIKE ? OR d.component_type LIKE ? OR d.description LIKE ?)`;
            params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
        }

        sql += ` ORDER BY d.category, d.id`;

        const list = await db.query(sql, params);
        for (const item of list) {
            parseJsonField(item, 'config_fields');
            parseJsonField(item, 'input_schema');
            parseJsonField(item, 'output_schema');
            parseJsonField(item, 'config_example');
            parseJsonField(item, 'faq');
        }

        res.json({ success: true, data: list });
    } catch (error) {
        logger.error('Get component docs error:', { message: error.message });
        res.status(500).json({ success: false, message: '获取组件文档列表失败' });
    }
});

router.get('/categories', async (_req, res) => {
    try {
        const rows = await db.query(
            `SELECT DISTINCT category, COUNT(*) as count FROM component_doc GROUP BY category ORDER BY FIELD(category, 'data-access','data-preprocess','model-labeling','entity-extract','relation-build','knowledge-production','data-browse')`
        );
        res.json({ success: true, data: rows });
    } catch (error) {
        logger.error('Get component doc categories error:', { message: error.message });
        res.status(500).json({ success: false, message: '获取组件文档分类失败' });
    }
});

router.get('/:componentType', async (req, res) => {
    try {
        const rows = await db.query(
            `SELECT d.*, u.nickname as updater_name
             FROM component_doc d
             LEFT JOIN sys_user u ON d.updated_by = u.id
             WHERE d.component_type = ?`,
            [req.params.componentType]
        );
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: '组件文档不存在' });
        }

        const doc = rows[0];
        parseJsonField(doc, 'config_fields');
        parseJsonField(doc, 'input_schema');
        parseJsonField(doc, 'output_schema');
        parseJsonField(doc, 'config_example');
        parseJsonField(doc, 'faq');

        res.json({ success: true, data: doc });
    } catch (error) {
        logger.error('Get component doc detail error:', { message: error.message });
        res.status(500).json({ success: false, message: '获取组件文档详情失败' });
    }
});

router.put('/:id', roleGuard('admin'), async (req, res) => {
    try {
        const { name, description, config_fields, input_schema, output_schema, config_example, faq } = req.body;

        const rows = await db.query('SELECT id, version FROM component_doc WHERE id = ?', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: '组件文档不存在' });
        }

        const updates = [];
        const params = [];

        if (name !== undefined) {
            updates.push('name = ?');
            params.push(name);
        }
        if (description !== undefined) {
            updates.push('description = ?');
            params.push(description);
        }
        if (config_fields !== undefined) {
            updates.push('config_fields = ?');
            params.push(typeof config_fields === 'string' ? config_fields : JSON.stringify(config_fields));
        }
        if (input_schema !== undefined) {
            updates.push('input_schema = ?');
            params.push(typeof input_schema === 'string' ? input_schema : JSON.stringify(input_schema));
        }
        if (output_schema !== undefined) {
            updates.push('output_schema = ?');
            params.push(typeof output_schema === 'string' ? output_schema : JSON.stringify(output_schema));
        }
        if (config_example !== undefined) {
            updates.push('config_example = ?');
            params.push(typeof config_example === 'string' ? config_example : JSON.stringify(config_example));
        }
        if (faq !== undefined) {
            updates.push('faq = ?');
            params.push(typeof faq === 'string' ? faq : JSON.stringify(faq));
        }

        updates.push('version = ?');
        params.push(rows[0].version + 1);

        updates.push('updated_by = ?');
        params.push(req.user.id);

        if (updates.length === 2) {
            return res.json({ success: true, message: '无更新内容' });
        }

        params.push(req.params.id);
        await db.query(`UPDATE component_doc SET ${updates.join(', ')} WHERE id = ?`, params);

        await db.query(
            'INSERT INTO operation_log (user_id, username, action, target, detail, ip) VALUES (?, ?, ?, ?, ?, ?)',
            [
                req.user.id,
                req.user.username,
                '更新组件文档',
                name || rows[0].name,
                `更新组件文档: ${name || rows[0].name}`,
                req.ip
            ]
        );

        logger.info('Component doc updated:', { id: req.params.id });
        res.json({ success: true, message: '文档更新成功' });
    } catch (error) {
        logger.error('Update component doc error:', { message: error.message });
        res.status(500).json({ success: false, message: '更新组件文档失败' });
    }
});

module.exports = router;
