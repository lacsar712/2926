const express = require('express');
const db = require('../utils/db');
const logger = require('../utils/logger');

const router = express.Router();

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
        const pendingCount = pendingRow.count;

        const [failedRunRow] = await db.query(
            `SELECT COUNT(*) as count FROM pipeline_run pr INNER JOIN pipeline p ON pr.pipeline_id = p.id ${role === 'admin' ? '' : 'WHERE p.creator_id = ?'} AND pr.status = 'failed' AND pr.start_time >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
            role === 'admin' ? [daysNum] : [userId, daysNum]
        );
        const failedRunCount = failedRunRow.count;

        const trendLabels = [];
        const trendRunData = [];
        const trendFailedData = [];
        for (let i = daysNum - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().slice(0, 10);
            trendLabels.push(`${d.getMonth() + 1}/${d.getDate()}`);

            const [runRow] = await db.query(
                `SELECT COUNT(*) as count FROM pipeline_run pr INNER JOIN pipeline p ON pr.pipeline_id = p.id ${role === 'admin' ? '' : 'WHERE p.creator_id = ?'} AND DATE(pr.start_time) = ?`,
                role === 'admin' ? [dateStr] : [userId, dateStr]
            );
            trendRunData.push(runRow.count);

            const [failRow] = await db.query(
                `SELECT COUNT(*) as count FROM pipeline_run pr INNER JOIN pipeline p ON pr.pipeline_id = p.id ${role === 'admin' ? '' : 'WHERE p.creator_id = ?'} AND pr.status = 'failed' AND DATE(pr.start_time) = ?`,
                role === 'admin' ? [dateStr] : [userId, dateStr]
            );
            trendFailedData.push(failRow.count);
        }

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
                trend: { labels: trendLabels, run: trendRunData, failed: trendFailedData },
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
