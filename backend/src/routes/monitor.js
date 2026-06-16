const express = require('express');
const db = require('../utils/db');
const logger = require('../utils/logger');

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

module.exports = router;
