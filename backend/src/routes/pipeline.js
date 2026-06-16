const express = require('express');
const db = require('../utils/db');
const logger = require('../utils/logger');
const { roleGuard } = require('../middleware/auth');

const router = express.Router();

// 获取生产线列表
router.get('/', async (req, res) => {
    try {
        const { keyword, status, tagId, page = 1, pageSize = 10 } = req.query;
        let sql = `SELECT p.*, u.nickname as creator_name FROM pipeline p LEFT JOIN sys_user u ON p.creator_id = u.id WHERE 1=1`;
        const params = [];
        if (keyword) { sql += ` AND (p.name LIKE ? OR p.description LIKE ?)`; params.push(`%${keyword}%`, `%${keyword}%`); }
        if (status) { sql += ` AND p.status = ?`; params.push(status); }
        if (tagId) {
            sql += ` AND p.id IN (SELECT pipeline_id FROM pipeline_tag WHERE tag_id = ?)`;
            params.push(tagId);
        }
        const countSql = sql.replace('SELECT p.*, u.nickname as creator_name', 'SELECT COUNT(*) as total');
        const [countResult] = await db.query(countSql, params);
        const total = countResult.total;
        const limit = parseInt(pageSize);
        const offset = (parseInt(page) - 1) * limit;
        sql += ` ORDER BY p.updated_at DESC LIMIT ${limit} OFFSET ${offset}`;
        const rows = await db.query(sql, params);
        // 获取每个生产线的标签
        for (const row of rows) {
            const tags = await db.query(
                'SELECT t.* FROM tag t INNER JOIN pipeline_tag pt ON t.id = pt.tag_id WHERE pt.pipeline_id = ?',
                [row.id]
            );
            row.tags = tags;
        }
        res.json({ success: true, data: { list: rows, total, page: parseInt(page), pageSize: parseInt(pageSize) } });
    } catch (error) {
        logger.error('Get pipelines error:', { message: error.message });
        res.status(500).json({ success: false, message: '获取生产线列表失败' });
    }
});

// 获取单个生产线
router.get('/:id', async (req, res) => {
    try {
        const rows = await db.query(
            'SELECT p.*, u.nickname as creator_name FROM pipeline p LEFT JOIN sys_user u ON p.creator_id = u.id WHERE p.id = ?',
            [req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ success: false, message: '生产线不存在' });
        const pipeline = rows[0];
        pipeline.tags = await db.query(
            'SELECT t.* FROM tag t INNER JOIN pipeline_tag pt ON t.id = pt.tag_id WHERE pt.pipeline_id = ?',
            [pipeline.id]
        );
        res.json({ success: true, data: pipeline });
    } catch (error) {
        logger.error('Get pipeline error:', { message: error.message });
        res.status(500).json({ success: false, message: '获取生产线详情失败' });
    }
});

// 创建生产线
router.post('/', roleGuard('admin', 'editor'), async (req, res) => {
    try {
        const { name, description, tagIds = [] } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ success: false, message: '生产线名称不能为空' });
        const result = await db.query(
            'INSERT INTO pipeline (name, description, creator_id) VALUES (?, ?, ?)',
            [name.trim(), description || '', req.user.id]
        );
        const pipelineId = result.insertId;
        for (const tagId of tagIds) {
            await db.query('INSERT INTO pipeline_tag (pipeline_id, tag_id) VALUES (?, ?)', [pipelineId, tagId]);
        }
        // 初始化空编排
        await db.query('INSERT INTO pipeline_flow (pipeline_id, flow_data) VALUES (?, ?)', [pipelineId, JSON.stringify({ nodes: [], edges: [] })]);
        await db.query(
            'INSERT INTO operation_log (user_id, username, action, target, detail, ip) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, req.user.username, '创建生产线', name, `创建新生产线: ${name}`, req.ip]
        );
        logger.info('Pipeline created:', { id: pipelineId, name });
        res.json({ success: true, data: { id: pipelineId }, message: '创建成功' });
    } catch (error) {
        logger.error('Create pipeline error:', { message: error.message });
        res.status(500).json({ success: false, message: '创建生产线失败' });
    }
});

// 更新生产线
router.put('/:id', roleGuard('admin', 'editor'), async (req, res) => {
    try {
        const { name, description, status, tagIds } = req.body;
        if (name !== undefined && !name.trim()) return res.status(400).json({ success: false, message: '名称不能为空' });
        const updates = [];
        const params = [];
        if (name) { updates.push('name = ?'); params.push(name.trim()); }
        if (description !== undefined) { updates.push('description = ?'); params.push(description); }
        if (status) { updates.push('status = ?'); params.push(status); }
        if (updates.length > 0) {
            params.push(req.params.id);
            await db.query(`UPDATE pipeline SET ${updates.join(', ')} WHERE id = ?`, params);
        }
        if (tagIds !== undefined) {
            await db.query('DELETE FROM pipeline_tag WHERE pipeline_id = ?', [req.params.id]);
            for (const tagId of tagIds) {
                await db.query('INSERT INTO pipeline_tag (pipeline_id, tag_id) VALUES (?, ?)', [req.params.id, tagId]);
            }
        }
        logger.info('Pipeline updated:', { id: req.params.id });
        res.json({ success: true, message: '更新成功' });
    } catch (error) {
        logger.error('Update pipeline error:', { message: error.message });
        res.status(500).json({ success: false, message: '更新生产线失败' });
    }
});

// 删除生产线
router.delete('/:id', roleGuard('admin', 'editor'), async (req, res) => {
    try {
        const rows = await db.query('SELECT name FROM pipeline WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: '生产线不存在' });
        await db.query('DELETE FROM pipeline WHERE id = ?', [req.params.id]);
        await db.query(
            'INSERT INTO operation_log (user_id, username, action, target, detail, ip) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, req.user.username, '删除生产线', rows[0].name, `删除生产线: ${rows[0].name}`, req.ip]
        );
        logger.info('Pipeline deleted:', { id: req.params.id });
        res.json({ success: true, message: '删除成功' });
    } catch (error) {
        logger.error('Delete pipeline error:', { message: error.message });
        res.status(500).json({ success: false, message: '删除生产线失败' });
    }
});

module.exports = router;
