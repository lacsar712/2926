const express = require('express');
const db = require('../utils/db');
const logger = require('../utils/logger');
const { notifyPipelineRunFailed, getPipelineSubscribers } = require('../utils/notification');

const router = express.Router();

// 获取生产线运行记录列表
router.get('/runs', async (req, res) => {
    try {
        const { pipelineId, status } = req.query;
        let sql = `SELECT r.*, p.name as pipeline_name FROM pipeline_run r LEFT JOIN pipeline p ON r.pipeline_id = p.id WHERE 1=1`;
        const params = [];
        if (pipelineId) { sql += ' AND r.pipeline_id = ?'; params.push(pipelineId); }
        if (status) { sql += ' AND r.status = ?'; params.push(status); }
        sql += ' ORDER BY r.start_time DESC LIMIT 50';
        const rows = await db.query(sql, params);
        res.json({ success: true, data: rows });
    } catch (error) {
        logger.error('Get runs error:', { message: error.message });
        res.status(500).json({ success: false, message: '获取运行记录失败' });
    }
});

// 获取单次运行详情
router.get('/runs/:runId', async (req, res) => {
    try {
        const runs = await db.query(
            'SELECT r.*, p.name as pipeline_name FROM pipeline_run r LEFT JOIN pipeline p ON r.pipeline_id = p.id WHERE r.id = ?',
            [req.params.runId]
        );
        if (runs.length === 0) return res.status(404).json({ success: false, message: '运行记录不存在' });
        const details = await db.query('SELECT * FROM node_run_detail WHERE run_id = ? ORDER BY start_time', [req.params.runId]);
        const parsedDetails = details.map(d => ({
            ...d,
            input_sample: typeof d.input_sample === 'string' ? JSON.parse(d.input_sample) : d.input_sample,
            output_sample: typeof d.output_sample === 'string' ? JSON.parse(d.output_sample) : d.output_sample
        }));
        res.json({ success: true, data: { ...runs[0], nodeDetails: parsedDetails } });
    } catch (error) {
        logger.error('Get run detail error:', { message: error.message });
        res.status(500).json({ success: false, message: '获取运行详情失败' });
    }
});

// 获取生产线监控概览
router.get('/overview', async (_req, res) => {
    try {
        const [totalPipelines] = await db.query('SELECT COUNT(*) as count FROM pipeline');
        const [runningPipelines] = await db.query("SELECT COUNT(*) as count FROM pipeline WHERE status = 'running'");
        const [totalRuns] = await db.query('SELECT COUNT(*) as count FROM pipeline_run');
        const [failedRuns] = await db.query("SELECT COUNT(*) as count FROM pipeline_run WHERE status = 'failed'");
        const recentRuns = await db.query(
            `SELECT r.*, p.name as pipeline_name FROM pipeline_run r LEFT JOIN pipeline p ON r.pipeline_id = p.id ORDER BY r.start_time DESC LIMIT 10`
        );
        const pipelineStats = await db.query(
            `SELECT p.id, p.name, p.status, COUNT(r.id) as run_count,
       SUM(r.total_input) as total_input, SUM(r.total_output) as total_output, SUM(r.error_count) as total_errors
       FROM pipeline p LEFT JOIN pipeline_run r ON p.id = r.pipeline_id GROUP BY p.id ORDER BY run_count DESC`
        );
        res.json({
            success: true,
            data: {
                summary: {
                    totalPipelines: totalPipelines.count,
                    runningPipelines: runningPipelines.count,
                    totalRuns: totalRuns.count,
                    failedRuns: failedRuns.count
                },
                recentRuns,
                pipelineStats
            }
        });
    } catch (error) {
        logger.error('Get overview error:', { message: error.message });
        res.status(500).json({ success: false, message: '获取监控概览失败' });
    }
});

// 获取生产线编排数据（用于监控可视化）
router.get('/pipeline/:pipelineId/flow', async (req, res) => {
    try {
        const flowRows = await db.query('SELECT flow_data FROM pipeline_flow WHERE pipeline_id = ?', [req.params.pipelineId]);
        if (flowRows.length === 0) return res.status(404).json({ success: false, message: '编排数据不存在' });
        const flowData = typeof flowRows[0].flow_data === 'string' ? JSON.parse(flowRows[0].flow_data) : flowRows[0].flow_data;
        res.json({ success: true, data: flowData });
    } catch (error) {
        logger.error('Get monitor flow error:', { message: error.message });
        res.status(500).json({ success: false, message: '获取编排数据失败' });
    }
});

// 启动生产线运行
router.post('/runs/:pipelineId/start', async (req, res) => {
    try {
        const pipelineId = req.params.pipelineId;
        const pipelineRows = await db.query('SELECT name, status FROM pipeline WHERE id = ?', [pipelineId]);
        if (pipelineRows.length === 0) return res.status(404).json({ success: false, message: '生产线不存在' });
        
        const pipeline = pipelineRows[0];
        if (pipeline.status !== 'published') {
            return res.status(400).json({ success: false, message: '请先发布生产线' });
        }
        
        const result = await db.query(
            'INSERT INTO pipeline_run (pipeline_id, status, start_time) VALUES (?, ?, NOW())',
            [pipelineId, 'running']
        );
        
        await db.query('UPDATE pipeline SET status = ? WHERE id = ?', ['running', pipelineId]);
        
        await db.query(
            'INSERT INTO operation_log (user_id, username, action, target, detail, ip) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, req.user.username, '启动运行', pipeline.name, `启动生产线运行`, req.ip]
        );
        
        logger.info('Pipeline run started:', { pipelineId, runId: result.insertId });
        res.json({ success: true, data: { runId: result.insertId }, message: '运行已启动' });
    } catch (error) {
        logger.error('Start run error:', { message: error.message });
        res.status(500).json({ success: false, message: '启动运行失败' });
    }
});

// 更新运行状态
router.put('/runs/:runId/status', async (req, res) => {
    try {
        const { status, errorCount = 0, totalInput = 0, totalOutput = 0 } = req.body;
        const runId = req.params.runId;
        
        const runRows = await db.query(
            'SELECT r.*, p.name as pipeline_name, p.id as pipeline_id FROM pipeline_run r LEFT JOIN pipeline p ON r.pipeline_id = p.id WHERE r.id = ?',
            [runId]
        );
        if (runRows.length === 0) return res.status(404).json({ success: false, message: '运行记录不存在' });
        
        const run = runRows[0];
        const updates = [];
        const params = [];
        
        if (status) { updates.push('status = ?'); params.push(status); }
        if (totalInput) { updates.push('total_input = ?'); params.push(totalInput); }
        if (totalOutput) { updates.push('total_output = ?'); params.push(totalOutput); }
        if (errorCount) { updates.push('error_count = ?'); params.push(errorCount); }
        
        if (status === 'completed' || status === 'failed' || status === 'cancelled') {
            updates.push('end_time = NOW()');
        }
        
        if (updates.length > 0) {
            params.push(runId);
            await db.query(`UPDATE pipeline_run SET ${updates.join(', ')} WHERE id = ?`, params);
        }
        
        if (status === 'completed' || status === 'failed' || status === 'cancelled') {
            const newPipelineStatus = status === 'failed' ? 'error' : 'published';
            await db.query('UPDATE pipeline SET status = ? WHERE id = ?', [newPipelineStatus, run.pipeline_id]);
        }
        
        if (status === 'failed') {
            const subscribers = await getPipelineSubscribers(run.pipeline_id);
            if (subscribers.length > 0) {
                await notifyPipelineRunFailed(
                    run.pipeline_id,
                    run.pipeline_name,
                    runId,
                    errorCount,
                    subscribers
                );
            }
        }
        
        logger.info('Pipeline run status updated:', { runId, status });
        res.json({ success: true, message: '状态已更新' });
    } catch (error) {
        logger.error('Update run status error:', { message: error.message });
        res.status(500).json({ success: false, message: '更新运行状态失败' });
    }
});

module.exports = router;
