const express = require('express');
const db = require('../utils/db');
const logger = require('../utils/logger');
const { roleGuard } = require('../middleware/auth');

const router = express.Router();

const scanRuleReferences = (flowData, ruleId) => {
    if (!flowData || !flowData.nodes) return [];
    const refs = [];
    flowData.nodes.forEach(node => {
        const config = node.data?.config;
        if (config && config.qualityRuleIds && Array.isArray(config.qualityRuleIds)) {
            if (config.qualityRuleIds.includes(ruleId) || config.qualityRuleIds.includes(String(ruleId))) {
                refs.push({
                    nodeId: node.id,
                    nodeLabel: node.data?.label || node.id,
                    component: node.data?.component
                });
            }
        }
    });
    return refs;
};

router.get('/', async (req, res) => {
    try {
        const { type, enabled } = req.query;
        let sql = `
            SELECT qr.*, u.nickname AS updater_name,
                   (SELECT COUNT(*) FROM quality_rule WHERE 1=1) AS total_count
            FROM quality_rule qr
            LEFT JOIN sys_user u ON qr.updater_id = u.id
            WHERE 1=1
        `;
        const params = [];
        if (type) {
            sql += ' AND qr.rule_type = ?';
            params.push(type);
        }
        if (enabled !== undefined && enabled !== '') {
            sql += ' AND qr.enabled = ?';
            params.push(parseInt(enabled));
        }
        sql += ' ORDER BY qr.updated_at DESC';

        const rows = await db.query(sql, params);
        const result = rows.map(row => ({
            id: row.id,
            name: row.name,
            description: row.description,
            rule_type: row.rule_type,
            expression: row.expression,
            severity: row.severity,
            enabled: row.enabled,
            creator_id: row.creator_id,
            updater_name: row.updater_name,
            created_at: row.created_at,
            updated_at: row.updated_at
        }));

        const flowRows = await db.query('SELECT pipeline_id, flow_data FROM pipeline_flow');
        result.forEach(rule => {
            let refCount = 0;
            flowRows.forEach(f => {
                try {
                    const fd = typeof f.flow_data === 'string' ? JSON.parse(f.flow_data) : f.flow_data;
                    refCount += scanRuleReferences(fd, rule.id).length;
                } catch { /* ignore */ }
            });
            rule.reference_count = refCount;
        });

        res.json({ success: true, data: result });
    } catch (error) {
        logger.error('Get quality rules error:', { message: error.message });
        res.status(500).json({ success: false, message: '获取质量规则列表失败' });
    }
});

router.get('/references', async (req, res) => {
    try {
        const { ruleId } = req.query;
        const flowRows = await db.query(`
            SELECT pf.pipeline_id, pf.flow_data, p.name AS pipeline_name
            FROM pipeline_flow pf
            LEFT JOIN pipeline p ON pf.pipeline_id = p.id
        `);
        const references = [];
        flowRows.forEach(f => {
            try {
                const fd = typeof f.flow_data === 'string' ? JSON.parse(f.flow_data) : f.flow_data;
                const nodeRefs = scanRuleReferences(fd, ruleId);
                nodeRefs.forEach(nr => {
                    references.push({
                        pipeline_id: f.pipeline_id,
                        pipeline_name: f.pipeline_name,
                        node_id: nr.nodeId,
                        node_label: nr.nodeLabel,
                        component: nr.component
                    });
                });
            } catch { /* ignore */ }
        });
        res.json({ success: true, data: references });
    } catch (error) {
        logger.error('Get rule references error:', { message: error.message });
        res.status(500).json({ success: false, message: '获取规则引用统计失败' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const rows = await db.query(
            'SELECT * FROM quality_rule WHERE id = ?',
            [req.params.id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: '规则不存在' });
        }
        res.json({ success: true, data: rows[0] });
    } catch (error) {
        logger.error('Get quality rule error:', { message: error.message });
        res.status(500).json({ success: false, message: '获取规则详情失败' });
    }
});

router.post('/', roleGuard('admin', 'editor'), async (req, res) => {
    try {
        const { name, description, rule_type, expression, severity, enabled } = req.body;
        if (!name || !rule_type || !severity) {
            return res.status(400).json({ success: false, message: '必填字段缺失' });
        }
        const validTypes = ['not_null', 'regex', 'numeric_range', 'enum'];
        if (!validTypes.includes(rule_type)) {
            return res.status(400).json({ success: false, message: '无效的规则类型' });
        }
        if (!['error', 'warning'].includes(severity)) {
            return res.status(400).json({ success: false, message: '无效的严重级别' });
        }

        const result = await db.query(
            'INSERT INTO quality_rule (name, description, rule_type, expression, severity, enabled, creator_id, updater_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [name, description || '', rule_type, expression || null, severity, enabled !== undefined ? enabled : 1, req.user.id, req.user.id]
        );
        logger.info('Quality rule created:', { id: result.insertId, name, username: req.user.username });
        await db.query(
            'INSERT INTO operation_log (user_id, username, action, target, detail, ip) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, req.user.username, '创建质量规则', name, `规则类型: ${rule_type}`, req.ip]
        );
        res.json({ success: true, data: { id: result.insertId }, message: '创建成功' });
    } catch (error) {
        logger.error('Create quality rule error:', { message: error.message });
        res.status(500).json({ success: false, message: '创建质量规则失败' });
    }
});

router.put('/:id', roleGuard('admin', 'editor'), async (req, res) => {
    try {
        const { name, description, rule_type, expression, severity, enabled } = req.body;
        const existing = await db.query('SELECT id FROM quality_rule WHERE id = ?', [req.params.id]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: '规则不存在' });
        }
        await db.query(
            `UPDATE quality_rule SET name = ?, description = ?, rule_type = ?, expression = ?, severity = ?, enabled = ?, updater_id = ? WHERE id = ?`,
            [name, description || '', rule_type, expression || null, severity, enabled !== undefined ? enabled : 1, req.user.id, req.params.id]
        );
        logger.info('Quality rule updated:', { id: req.params.id, username: req.user.username });
        await db.query(
            'INSERT INTO operation_log (user_id, username, action, target, detail, ip) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, req.user.username, '编辑质量规则', name, `规则ID: ${req.params.id}`, req.ip]
        );
        res.json({ success: true, message: '更新成功' });
    } catch (error) {
        logger.error('Update quality rule error:', { message: error.message });
        res.status(500).json({ success: false, message: '更新质量规则失败' });
    }
});

router.put('/:id/status', roleGuard('admin', 'editor'), async (req, res) => {
    try {
        const { enabled } = req.body;
        const existing = await db.query('SELECT id, name FROM quality_rule WHERE id = ?', [req.params.id]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: '规则不存在' });
        }
        await db.query('UPDATE quality_rule SET enabled = ?, updater_id = ? WHERE id = ?', [enabled ? 1 : 0, req.user.id, req.params.id]);
        res.json({ success: true, message: '状态更新成功' });
    } catch (error) {
        logger.error('Toggle quality rule status error:', { message: error.message });
        res.status(500).json({ success: false, message: '更新状态失败' });
    }
});

router.delete('/:id', roleGuard('admin'), async (req, res) => {
    try {
        const existing = await db.query('SELECT id, name FROM quality_rule WHERE id = ?', [req.params.id]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: '规则不存在' });
        }
        const flowRows = await db.query('SELECT flow_data FROM pipeline_flow');
        let hasRef = false;
        for (const f of flowRows) {
            try {
                const fd = typeof f.flow_data === 'string' ? JSON.parse(f.flow_data) : f.flow_data;
                if (scanRuleReferences(fd, req.params.id).length > 0) {
                    hasRef = true;
                    break;
                }
            } catch { /* ignore */ }
        }
        if (hasRef) {
            return res.status(400).json({ success: false, message: '该规则已被节点引用，无法删除' });
        }
        await db.query('DELETE FROM quality_rule WHERE id = ?', [req.params.id]);
        logger.info('Quality rule deleted:', { id: req.params.id, username: req.user.username });
        await db.query(
            'INSERT INTO operation_log (user_id, username, action, target, detail, ip) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, req.user.username, '删除质量规则', existing[0].name, `规则ID: ${req.params.id}`, req.ip]
        );
        res.json({ success: true, message: '删除成功' });
    } catch (error) {
        logger.error('Delete quality rule error:', { message: error.message });
        res.status(500).json({ success: false, message: '删除质量规则失败' });
    }
});

module.exports = router;
