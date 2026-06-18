const express = require('express');
const db = require('../utils/db');
const logger = require('../utils/logger');
const { roleGuard } = require('../middleware/auth');

const router = express.Router();

const getTemplateList = async (req, res, isAdmin = false) => {
    try {
        const { keyword, category, status, page = 1, pageSize = 12 } = req.query;
        let sql = `SELECT t.id, t.name, t.description, t.category, t.node_count, t.status, t.flow_data, t.created_at, t.updated_at,
                   u.nickname as creator_name
                   FROM template t
                   LEFT JOIN sys_user u ON t.creator_id = u.id
                   WHERE 1=1`;
        const params = [];

        if (!isAdmin) {
            sql += ` AND t.status = 'online'`;
        } else if (status) {
            sql += ` AND t.status = ?`;
            params.push(status);
        }

        if (keyword) {
            sql += ` AND (t.name LIKE ? OR t.description LIKE ?)`;
            params.push(`%${keyword}%`, `%${keyword}%`);
        }

        if (category) {
            sql += ` AND t.category = ?`;
            params.push(category);
        }

        const countSql = sql.replace(/SELECT[\s\S]+?FROM/i, 'SELECT COUNT(*) as total FROM');
        const countRows = await db.query(countSql, params);
        const total = countRows[0]?.total ?? 0;

        const limit = parseInt(pageSize);
        const offset = (parseInt(page) - 1) * limit;
        sql += ` ORDER BY t.created_at DESC LIMIT ${limit} OFFSET ${offset}`;

        const list = await db.query(sql, params);
        for (const item of list) {
            if (item.flow_data && typeof item.flow_data === 'string') {
                try {
                    item.flow_data = JSON.parse(item.flow_data);
                } catch (e) {
                    item.flow_data = { nodes: [], edges: [] };
                }
            }
        }

        res.json({
            success: true,
            data: {
                list,
                total,
                page: parseInt(page),
                pageSize: parseInt(pageSize)
            }
        });
    } catch (error) {
        logger.error('Get templates error:', { message: error.message });
        res.status(500).json({ success: false, message: '获取模板列表失败' });
    }
};

router.get('/', async (req, res) => {
    const isAdmin = req.user?.role === 'admin';
    await getTemplateList(req, res, isAdmin);
});

router.get('/categories', async (_req, res) => {
    try {
        const rows = await db.query(
            `SELECT DISTINCT category FROM template WHERE status = 'online' AND category IS NOT NULL AND category != '' ORDER BY category`
        );
        const categories = rows.map(row => row.category);
        res.json({ success: true, data: categories });
    } catch (error) {
        logger.error('Get template categories error:', { message: error.message });
        res.status(500).json({ success: false, message: '获取模板分类失败' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const rows = await db.query(
            `SELECT t.*, u.nickname as creator_name
             FROM template t
             LEFT JOIN sys_user u ON t.creator_id = u.id
             WHERE t.id = ?`,
            [req.params.id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: '模板不存在' });
        }

        const template = rows[0];

        if (template.status !== 'online' && req.user?.role !== 'admin') {
            return res.status(403).json({ success: false, message: '无权限查看该模板' });
        }

        if (template.flow_data && typeof template.flow_data === 'string') {
            try {
                template.flow_data = JSON.parse(template.flow_data);
            } catch (e) {
                template.flow_data = { nodes: [], edges: [] };
            }
        }

        res.json({ success: true, data: template });
    } catch (error) {
        logger.error('Get template detail error:', { message: error.message });
        res.status(500).json({ success: false, message: '获取模板详情失败' });
    }
});

router.post('/:id/use', roleGuard('admin', 'editor'), async (req, res) => {
    const conn = await db.pool.getConnection();
    try {
        await conn.beginTransaction();

        const { name, description } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: '生产线名称不能为空' });
        }

        const [templateRows] = await conn.execute(
            'SELECT * FROM template WHERE id = ?',
            [req.params.id]
        );
        if (templateRows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: '模板不存在' });
        }

        const template = templateRows[0];
        if (template.status !== 'online' && req.user.role !== 'admin') {
            await conn.rollback();
            return res.status(403).json({ success: false, message: '该模板未上架' });
        }

        const [pipelineResult] = await conn.execute(
            'INSERT INTO pipeline (name, description, status, version, creator_id) VALUES (?, ?, ?, ?, ?)',
            [name.trim(), description || '', 'draft', 1, req.user.id]
        );
        const pipelineId = pipelineResult.insertId;

        let flowData = template.flow_data;
        if (typeof flowData === 'string') {
            try {
                flowData = JSON.parse(flowData);
            } catch (e) {
                flowData = { nodes: [], edges: [] };
            }
        }

        await conn.execute(
            'INSERT INTO pipeline_flow (pipeline_id, flow_data) VALUES (?, ?)',
            [pipelineId, JSON.stringify(flowData || { nodes: [], edges: [] })]
        );

        await conn.execute(
            'INSERT INTO operation_log (user_id, username, action, target, detail, ip) VALUES (?, ?, ?, ?, ?, ?)',
            [
                req.user.id,
                req.user.username,
                '使用模板创建生产线',
                name,
                `从模板「${template.name}」创建生产线: ${name}`,
                req.ip
            ]
        );

        await conn.commit();

        logger.info('Pipeline created from template:', {
            pipelineId,
            templateId: req.params.id,
            name
        });

        res.json({
            success: true,
            data: { id: pipelineId },
            message: '生产线创建成功'
        });
    } catch (error) {
        await conn.rollback();
        logger.error('Use template error:', { message: error.message });
        res.status(500).json({ success: false, message: '使用模板创建生产线失败' });
    } finally {
        conn.release();
    }
});

router.put('/:id/status', roleGuard('admin'), async (req, res) => {
    try {
        const { status } = req.body;
        if (!['online', 'offline'].includes(status)) {
            return res.status(400).json({ success: false, message: '无效的状态值' });
        }

        const rows = await db.query('SELECT name FROM template WHERE id = ?', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: '模板不存在' });
        }

        await db.query('UPDATE template SET status = ? WHERE id = ?', [status, req.params.id]);

        await db.query(
            'INSERT INTO operation_log (user_id, username, action, target, detail, ip) VALUES (?, ?, ?, ?, ?, ?)',
            [
                req.user.id,
                req.user.username,
                status === 'online' ? '上架模板' : '下架模板',
                rows[0].name,
                `${status === 'online' ? '上架' : '下架'}模板: ${rows[0].name}`,
                req.ip
            ]
        );

        logger.info('Template status updated:', { id: req.params.id, status });
        res.json({ success: true, message: `模板${status === 'online' ? '上架' : '下架'}成功` });
    } catch (error) {
        logger.error('Update template status error:', { message: error.message });
        res.status(500).json({ success: false, message: '更新模板状态失败' });
    }
});

router.post('/', roleGuard('admin'), async (req, res) => {
    try {
        const { name, description, category, flow_data } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: '模板名称不能为空' });
        }

        const nodeCount = (flow_data?.nodes || []).length;

        const result = await db.query(
            'INSERT INTO template (name, description, category, flow_data, node_count, creator_id) VALUES (?, ?, ?, ?, ?, ?)',
            [
                name.trim(),
                description || '',
                category || '',
                JSON.stringify(flow_data || { nodes: [], edges: [] }),
                nodeCount,
                req.user.id
            ]
        );

        await db.query(
            'INSERT INTO operation_log (user_id, username, action, target, detail, ip) VALUES (?, ?, ?, ?, ?, ?)',
            [
                req.user.id,
                req.user.username,
                '创建模板',
                name,
                `创建模板: ${name}`,
                req.ip
            ]
        );

        logger.info('Template created:', { id: result.insertId, name });
        res.json({ success: true, data: { id: result.insertId }, message: '模板创建成功' });
    } catch (error) {
        logger.error('Create template error:', { message: error.message });
        res.status(500).json({ success: false, message: '创建模板失败' });
    }
});

router.put('/:id', roleGuard('admin'), async (req, res) => {
    try {
        const { name, description, category, flow_data, status } = req.body;

        const updates = [];
        const params = [];

        if (name !== undefined) {
            if (!name.trim()) {
                return res.status(400).json({ success: false, message: '模板名称不能为空' });
            }
            updates.push('name = ?');
            params.push(name.trim());
        }
        if (description !== undefined) {
            updates.push('description = ?');
            params.push(description || '');
        }
        if (category !== undefined) {
            updates.push('category = ?');
            params.push(category || '');
        }
        if (flow_data !== undefined) {
            updates.push('flow_data = ?');
            params.push(JSON.stringify(flow_data || { nodes: [], edges: [] }));
            const nodeCount = (flow_data?.nodes || []).length;
            updates.push('node_count = ?');
            params.push(nodeCount);
        }
        if (status !== undefined) {
            if (!['online', 'offline'].includes(status)) {
                return res.status(400).json({ success: false, message: '无效的状态值' });
            }
            updates.push('status = ?');
            params.push(status);
        }

        if (updates.length === 0) {
            return res.json({ success: true, message: '无更新内容' });
        }

        const rows = await db.query('SELECT name FROM template WHERE id = ?', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: '模板不存在' });
        }

        params.push(req.params.id);
        await db.query(`UPDATE template SET ${updates.join(', ')} WHERE id = ?`, params);

        await db.query(
            'INSERT INTO operation_log (user_id, username, action, target, detail, ip) VALUES (?, ?, ?, ?, ?, ?)',
            [
                req.user.id,
                req.user.username,
                '更新模板',
                rows[0].name,
                `更新模板: ${rows[0].name}`,
                req.ip
            ]
        );

        logger.info('Template updated:', { id: req.params.id });
        res.json({ success: true, message: '模板更新成功' });
    } catch (error) {
        logger.error('Update template error:', { message: error.message });
        res.status(500).json({ success: false, message: '更新模板失败' });
    }
});

router.delete('/:id', roleGuard('admin'), async (req, res) => {
    try {
        const rows = await db.query('SELECT name FROM template WHERE id = ?', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: '模板不存在' });
        }

        await db.query('DELETE FROM template WHERE id = ?', [req.params.id]);

        await db.query(
            'INSERT INTO operation_log (user_id, username, action, target, detail, ip) VALUES (?, ?, ?, ?, ?, ?)',
            [
                req.user.id,
                req.user.username,
                '删除模板',
                rows[0].name,
                `删除模板: ${rows[0].name}`,
                req.ip
            ]
        );

        logger.info('Template deleted:', { id: req.params.id });
        res.json({ success: true, message: '模板删除成功' });
    } catch (error) {
        logger.error('Delete template error:', { message: error.message });
        res.status(500).json({ success: false, message: '删除模板失败' });
    }
});

module.exports = router;
