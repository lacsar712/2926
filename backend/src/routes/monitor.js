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

// 对比两次运行
router.get('/compare', async (req, res) => {
    try {
        const { runId1, runId2 } = req.query;
        if (!runId1 || !runId2) {
            return res.status(400).json({ success: false, message: '请提供两次运行的ID' });
        }

        const [run1Rows, run2Rows] = await Promise.all([
            db.query(
                'SELECT r.*, p.name as pipeline_name FROM pipeline_run r LEFT JOIN pipeline p ON r.pipeline_id = p.id WHERE r.id = ?',
                [runId1]
            ),
            db.query(
                'SELECT r.*, p.name as pipeline_name FROM pipeline_run r LEFT JOIN pipeline p ON r.pipeline_id = p.id WHERE r.id = ?',
                [runId2]
            )
        ]);

        if (run1Rows.length === 0) return res.status(404).json({ success: false, message: '运行记录1不存在' });
        if (run2Rows.length === 0) return res.status(404).json({ success: false, message: '运行记录2不存在' });

        const [nodes1, nodes2] = await Promise.all([
            db.query('SELECT * FROM node_run_detail WHERE run_id = ? ORDER BY start_time', [runId1]),
            db.query('SELECT * FROM node_run_detail WHERE run_id = ? ORDER BY start_time', [runId2])
        ]);

        const run1 = run1Rows[0];
        const run2 = run2Rows[0];

        const calcDurationMs = (s, e) => {
            if (!s || !e) return 0;
            return new Date(e).getTime() - new Date(s).getTime();
        };

        const run1Duration = calcDurationMs(run1.start_time, run1.end_time);
        const run2Duration = calcDurationMs(run2.start_time, run2.end_time);

        const summaryDelta = {
            total_input: {
                value1: run1.total_input || 0,
                value2: run2.total_input || 0,
                delta: (run2.total_input || 0) - (run1.total_input || 0),
                deltaPercent: run1.total_input ? (((run2.total_input || 0) - run1.total_input) / run1.total_input * 100).toFixed(1) : null
            },
            total_output: {
                value1: run1.total_output || 0,
                value2: run2.total_output || 0,
                delta: (run2.total_output || 0) - (run1.total_output || 0),
                deltaPercent: run1.total_output ? (((run2.total_output || 0) - run1.total_output) / run1.total_output * 100).toFixed(1) : null
            },
            error_count: {
                value1: run1.error_count || 0,
                value2: run2.error_count || 0,
                delta: (run2.error_count || 0) - (run1.error_count || 0),
                deltaPercent: run1.error_count ? (((run2.error_count || 0) - run1.error_count) / run1.error_count * 100).toFixed(1) : null
            },
            duration_ms: {
                value1: run1Duration,
                value2: run2Duration,
                delta: run2Duration - run1Duration,
                deltaPercent: run1Duration ? ((run2Duration - run1Duration) / run1Duration * 100).toFixed(1) : null
            }
        };

        const nodeMap1 = {};
        const nodeMap2 = {};
        nodes1.forEach(n => { nodeMap1[n.node_id] = n; });
        nodes2.forEach(n => { nodeMap2[n.node_id] = n; });

        const allNodeIds = [...new Set([...Object.keys(nodeMap1), ...Object.keys(nodeMap2)])];

        const nodeComparisons = allNodeIds.map(nodeId => {
            const n1 = nodeMap1[nodeId];
            const n2 = nodeMap2[nodeId];
            const n1Duration = n1 ? calcDurationMs(n1.start_time, n1.end_time) : 0;
            const n2Duration = n2 ? calcDurationMs(n2.start_time, n2.end_time) : 0;

            const calcDelta = (v1, v2) => {
                const val1 = v1 || 0;
                const val2 = v2 || 0;
                return {
                    value1: val1,
                    value2: val2,
                    delta: val2 - val1,
                    deltaPercent: val1 ? ((val2 - val1) / val1 * 100).toFixed(1) : null
                };
            };

            return {
                node_id: nodeId,
                node_name: n2?.node_name || n1?.node_name,
                node_type: n2?.node_type || n1?.node_type,
                exists1: !!n1,
                exists2: !!n2,
                status1: n1?.status,
                status2: n2?.status,
                input_count: calcDelta(n1?.input_count, n2?.input_count),
                output_count: calcDelta(n1?.output_count, n2?.output_count),
                error_count: calcDelta(n1?.error_count, n2?.error_count),
                duration_ms: calcDelta(n1Duration, n2Duration)
            };
        });

        const hasDiff = (item) => item.delta !== 0;
        const hasNodeDiff = (node) => {
            return hasDiff(node.input_count) || hasDiff(node.output_count) ||
                   hasDiff(node.error_count) || hasDiff(node.duration_ms) ||
                   node.exists1 !== node.exists2;
        };

        const buildSummary = () => {
            const parts = [];
            const outputDelta = summaryDelta.total_output;
            const errorDelta = summaryDelta.error_count;
            const durationDelta = summaryDelta.duration_ms;

            if (outputDelta.delta !== 0) {
                const direction = outputDelta.delta > 0 ? '提升' : '下降';
                if (outputDelta.deltaPercent !== null) {
                    parts.push(`输出量${direction} ${Math.abs(outputDelta.deltaPercent)}%`);
                } else {
                    parts.push(`输出量${direction} ${Math.abs(outputDelta.delta)}`);
                }
            }

            const diffNodes = nodeComparisons.filter(n => hasNodeDiff(n) && n.exists1 && n.exists2);
            if (diffNodes.length > 0) {
                const maxDurationNode = diffNodes.reduce((max, n) =>
                    Math.abs(n.duration_ms.delta) > Math.abs(max.duration_ms.delta) ? n : max
                , diffNodes[0]);
                if (maxDurationNode && maxDurationNode.duration_ms.delta !== 0) {
                    const direction = maxDurationNode.duration_ms.delta > 0 ? '增加' : '减少';
                    const pct = maxDurationNode.duration_ms.deltaPercent;
                    if (pct !== null) {
                        parts.push(`节点「${maxDurationNode.node_name}」耗时${direction} ${Math.abs(pct)}%`);
                    }
                }
            }

            if (errorDelta.delta !== 0) {
                const direction = errorDelta.delta > 0 ? '增加' : '减少';
                parts.push(`错误数${direction} ${Math.abs(errorDelta.delta)}`);
            }

            if (parts.length === 0) {
                return '两次运行指标基本一致，无显著差异。';
            }

            return parts.join('，') + '。';
        };

        res.json({
            success: true,
            data: {
                run1: {
                    ...run1,
                    duration_ms: run1Duration
                },
                run2: {
                    ...run2,
                    duration_ms: run2Duration
                },
                summaryDelta,
                nodeComparisons,
                textSummary: buildSummary()
            }
        });
    } catch (error) {
        logger.error('Compare runs error:', { message: error.message });
        res.status(500).json({ success: false, message: '对比运行失败' });
    }
});

// 获取生产线列表（用于级联选择）
router.get('/pipelines', async (_req, res) => {
    try {
        const rows = await db.query('SELECT id, name, status FROM pipeline ORDER BY name');
        res.json({ success: true, data: rows });
    } catch (error) {
        logger.error('Get pipelines error:', { message: error.message });
        res.status(500).json({ success: false, message: '获取生产线列表失败' });
    }
});

// 获取指定生产线的运行记录
router.get('/pipelines/:pipelineId/runs', async (req, res) => {
    try {
        const rows = await db.query(
            'SELECT id, status, start_time, end_time, total_input, total_output, error_count FROM pipeline_run WHERE pipeline_id = ? ORDER BY start_time DESC LIMIT 50',
            [req.params.pipelineId]
        );
        res.json({ success: true, data: rows });
    } catch (error) {
        logger.error('Get pipeline runs error:', { message: error.message });
        res.status(500).json({ success: false, message: '获取运行记录失败' });
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
