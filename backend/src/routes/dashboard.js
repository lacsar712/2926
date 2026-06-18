const express = require('express');
const db = require('../utils/db');
const logger = require('../utils/logger');

const router = express.Router();

const buildTrend = async (userId, role, days, target = 'run') => {
    const labels = [];
    const runData = [];
    const failedData = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        labels.push(`${d.getMonth() + 1}/${d.getDate()}`);

        const runParams = role === 'admin' ? [dateStr] : [userId, dateStr];
        const [runRow] = await db.query(
            `SELECT COUNT(*) as count FROM pipeline_run pr INNER JOIN pipeline p ON pr.pipeline_id = p.id ${role === 'admin' ? '' : 'WHERE p.creator_id = ?'} AND DATE(pr.start_time) = ?`,
            runParams
        );
        runData.push(runRow.count);

        const [failRow] = await db.query(
            `SELECT COUNT(*) as count FROM pipeline_run pr INNER JOIN pipeline p ON pr.pipeline_id = p.id ${role === 'admin' ? '' : 'WHERE p.creator_id = ?'} AND pr.status = 'failed' AND DATE(pr.start_time) = ?`,
            runParams
        );
        failedData.push(failRow.count);
    }
    if (target === 'failed') {
        return { labels, data: failedData };
    }
    return { labels, data: runData };
};

router.get('/summary', async (req, res) => {
    try {
        const userId = req.user.id;
        const role = req.user.role;
        const { days = 7 } = req.query;
        const daysNum = Math.min(Math.max(parseInt(days) || 7, 1), 90);

        let pipelineFilter = role === 'admin' ? '' : 'WHERE p.creator_id = ?';
        let pipelineParams = role === 'admin' ? [] : [userId];

        const [pipelineCountRow] = await db.query(
            `SELECT COUNT(*) as count FROM pipeline p ${pipelineFilter}`,
            pipelineParams
        );
        const pipelineCount = pipelineCountRow.count;

        const todayStr = new Date().toISOString().slice(0, 10);
        const [todayRunRow] = await db.query(
            `SELECT COUNT(*) as count FROM pipeline_run pr INNER JOIN pipeline p ON pr.pipeline_id = p.id ${role === 'admin' ? '' : 'WHERE p.creator_id = ?'} AND DATE(pr.start_time) = ?`,
            role === 'admin' ? [todayStr] : [userId, todayStr]
        );
        const todayRunCount = todayRunRow.count;

        const [pendingRow] = await db.query(
            `SELECT COUNT(*) as count FROM notification WHERE user_id = ? AND is_read = 0`,
            [userId]
        );

        let approvalPendingCount = 0;
        try {
            const [approvalPendingRow] = await db.query(
                `SELECT COUNT(*) as count FROM approval_record WHERE approver_id = ? AND status = 'pending'`,
                [userId]
            );
            approvalPendingCount = approvalPendingRow.count;
        } catch (_e) {
            approvalPendingCount = 0;
        }
        const pendingCount = pendingRow.count + approvalPendingCount;

        const [failedRunRow] = await db.query(
            `SELECT COUNT(*) as count FROM pipeline_run pr INNER JOIN pipeline p ON pr.pipeline_id = p.id ${role === 'admin' ? '' : 'WHERE p.creator_id = ?'} AND pr.status = 'failed' AND pr.start_time >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
            role === 'admin' ? [daysNum] : [userId, daysNum]
        );
        const failedRunCount = failedRunRow.count;

        const fixedRunTrend = await buildTrend(userId, role, 7, 'run');
        const failedTrend = await buildTrend(userId, role, daysNum, 'failed');

        const recentPipelines = await db.query(
            `SELECT p.id, p.name, p.status, p.updated_at, u.nickname as creator_name FROM pipeline p LEFT JOIN sys_user u ON p.creator_id = u.id ${role === 'admin' ? '' : 'WHERE p.creator_id = ?'} ORDER BY p.updated_at DESC LIMIT 5`,
            pipelineParams
        );

        const recentFailedRuns = await db.query(
            `SELECT pr.id as run_id, pr.pipeline_id, p.name as pipeline_name, pr.status, pr.start_time, pr.end_time, pr.error_count FROM pipeline_run pr INNER JOIN pipeline p ON pr.pipeline_id = p.id ${role === 'admin' ? '' : 'WHERE p.creator_id = ?'} AND pr.status = 'failed' ORDER BY pr.start_time DESC LIMIT 5`,
            pipelineParams
        );

        res.json({
            success: true,
            data: {
                pipelineCount,
                todayRunCount,
                pendingCount,
                failedRunCount,
                pendingApprovalCount: approvalPendingCount,
                fixedRunTrend,
                failedTrend,
                recentPipelines,
                recentFailedRuns
            }
        });
    } catch (error) {
        logger.error('Dashboard summary error:', { message: error.message });
        res.status(500).json({ success: false, message: '获取仪表盘数据失败' });
    }
});

module.exports = router;
