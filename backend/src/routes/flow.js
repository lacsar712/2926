const express = require('express');
const db = require('../utils/db');
const logger = require('../utils/logger');
const { roleGuard } = require('../middleware/auth');

const router = express.Router();

// 获取编排数据
router.get('/:pipelineId', async (req, res) => {
    try {
        const rows = await db.query('SELECT * FROM pipeline_flow WHERE pipeline_id = ?', [req.params.pipelineId]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: '编排数据不存在' });
        const flowData = typeof rows[0].flow_data === 'string' ? JSON.parse(rows[0].flow_data) : rows[0].flow_data;
        res.json({ success: true, data: { ...rows[0], flow_data: flowData } });
    } catch (error) {
        logger.error('Get flow error:', { message: error.message });
        res.status(500).json({ success: false, message: '获取编排数据失败' });
    }
});

// 保存编排数据
router.put('/:pipelineId', roleGuard('admin', 'editor'), async (req, res) => {
    try {
        const { flowData } = req.body;
        if (!flowData) return res.status(400).json({ success: false, message: '编排数据不能为空' });
        const existing = await db.query('SELECT id FROM pipeline_flow WHERE pipeline_id = ?', [req.params.pipelineId]);
        if (existing.length === 0) {
            await db.query('INSERT INTO pipeline_flow (pipeline_id, flow_data) VALUES (?, ?)',
                [req.params.pipelineId, JSON.stringify(flowData)]);
        } else {
            await db.query('UPDATE pipeline_flow SET flow_data = ? WHERE pipeline_id = ?',
                [JSON.stringify(flowData), req.params.pipelineId]);
        }
        logger.info('Flow saved:', { pipelineId: req.params.pipelineId });
        res.json({ success: true, message: '保存成功' });
    } catch (error) {
        logger.error('Save flow error:', { message: error.message });
        res.status(500).json({ success: false, message: '保存编排数据失败' });
    }
});

// 发布生产线
router.post('/:pipelineId/publish', roleGuard('admin', 'editor'), async (req, res) => {
    try {
        const { remark } = req.body;
        const flowRows = await db.query('SELECT flow_data FROM pipeline_flow WHERE pipeline_id = ?', [req.params.pipelineId]);
        if (flowRows.length === 0) return res.status(400).json({ success: false, message: '请先编排生产线' });

        const pipelineRows = await db.query('SELECT version FROM pipeline WHERE id = ?', [req.params.pipelineId]);
        const newVersion = (pipelineRows[0]?.version || 0) + 1;

        await db.query('UPDATE pipeline SET status = ?, version = ? WHERE id = ?', ['published', newVersion, req.params.pipelineId]);
        await db.query(
            'INSERT INTO pipeline_history (pipeline_id, version, flow_data, operator, action, remark) VALUES (?, ?, ?, ?, ?, ?)',
            [req.params.pipelineId, newVersion, JSON.stringify(flowRows[0].flow_data), req.user.username, 'publish', remark || '']
        );
        await db.query(
            'INSERT INTO operation_log (user_id, username, action, target, detail, ip) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, req.user.username, '发布生产线', `Pipeline #${req.params.pipelineId}`, `发布版本v${newVersion}`, req.ip]
        );
        logger.info('Pipeline published:', { pipelineId: req.params.pipelineId, version: newVersion });
        res.json({ success: true, message: `发布成功，当前版本 v${newVersion}` });
    } catch (error) {
        logger.error('Publish pipeline error:', { message: error.message });
        res.status(500).json({ success: false, message: '发布失败' });
    }
});

// 检查编排合法性
router.post('/:pipelineId/check', async (req, res) => {
    try {
        const flowRows = await db.query('SELECT flow_data FROM pipeline_flow WHERE pipeline_id = ?', [req.params.pipelineId]);
        if (flowRows.length === 0) return res.json({ success: true, data: { valid: false, errors: ['编排数据为空'] } });
        const flowData = typeof flowRows[0].flow_data === 'string' ? JSON.parse(flowRows[0].flow_data) : flowRows[0].flow_data;
        const errors = [];
        if (!flowData.nodes || flowData.nodes.length === 0) errors.push('画布中没有任何组件');
        if (!flowData.edges || flowData.edges.length === 0) errors.push('组件之间没有连线');
        // 检查孤立节点
        if (flowData.nodes && flowData.edges) {
            const connectedNodes = new Set();
            flowData.edges.forEach(e => { connectedNodes.add(e.source); connectedNodes.add(e.target); });
            flowData.nodes.forEach(n => {
                if (!connectedNodes.has(n.id)) errors.push(`组件"${n.data?.label || n.id}"未连接`);
            });
        }
        res.json({ success: true, data: { valid: errors.length === 0, errors } });
    } catch (error) {
        logger.error('Check flow error:', { message: error.message });
        res.status(500).json({ success: false, message: '检查失败' });
    }
});

// 获取发布历史
router.get('/:pipelineId/history', async (req, res) => {
    try {
        const rows = await db.query(
            'SELECT * FROM pipeline_history WHERE pipeline_id = ? ORDER BY created_at DESC',
            [req.params.pipelineId]
        );
        const parsed = rows.map(row => ({
            ...row,
            flow_data: typeof row.flow_data === 'string' ? JSON.parse(row.flow_data) : row.flow_data
        }));
        res.json({ success: true, data: parsed });
    } catch (error) {
        logger.error('Get history error:', { message: error.message });
        res.status(500).json({ success: false, message: '获取历史失败' });
    }
});

module.exports = router;
