const express = require('express');
const db = require('../utils/db');
const logger = require('../utils/logger');
const { roleGuard } = require('../middleware/auth');
const { startTask, stopTask, calculateNextRunTime } = require('../utils/scheduler');

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const { keyword, pipelineId, enabled, page = 1, pageSize = 10 } = req.query;
        let sql = `SELECT st.*, p.name as pipeline_name, u.nickname as creator_name 
                   FROM schedule_task st 
                   LEFT JOIN pipeline p ON st.pipeline_id = p.id 
                   LEFT JOIN sys_user u ON st.created_by = u.id 
                   WHERE 1=1`;
        const params = [];
        if (keyword) {
            sql += ` AND (st.name LIKE ? OR p.name LIKE ?)`;
            params.push(`%${keyword}%`, `%${keyword}%`);
        }
        if (pipelineId) {
            sql += ` AND st.pipeline_id = ?`;
            params.push(pipelineId);
        }
        if (enabled !== undefined && enabled !== '') {
            sql += ` AND st.enabled = ?`;
            params.push(enabled === '1' ? 1 : 0);
        }
        const countSql = sql.replace('SELECT st.*, p.name as pipeline_name, u.nickname as creator_name', 'SELECT COUNT(*) as total');
        const [countResult] = await db.query(countSql, params);
        const total = countResult.total;
        const limit = parseInt(pageSize);
        const offset = (parseInt(page) - 1) * limit;
        sql += ` ORDER BY st.updated_at DESC LIMIT ${limit} OFFSET ${offset}`;
        const rows = await db.query(sql, params);
        res.json({ success: true, data: { list: rows, total, page: parseInt(page), pageSize: parseInt(pageSize) } });
    } catch (error) {
        logger.error('Get schedule tasks error:', { message: error.message });
        res.status(500).json({ success: false, message: '获取调度任务列表失败' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const rows = await db.query(
            `SELECT st.*, p.name as pipeline_name, u.nickname as creator_name 
             FROM schedule_task st 
             LEFT JOIN pipeline p ON st.pipeline_id = p.id 
             LEFT JOIN sys_user u ON st.created_by = u.id 
             WHERE st.id = ?`,
            [req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ success: false, message: '调度任务不存在' });
        res.json({ success: true, data: rows[0] });
    } catch (error) {
        logger.error('Get schedule task error:', { message: error.message });
        res.status(500).json({ success: false, message: '获取调度任务详情失败' });
    }
});

router.get('/:id/history', async (req, res) => {
    try {
        const { limit = 20 } = req.query;
        const limitNum = Math.min(parseInt(limit) || 20, 100);
        const rows = await db.query(
            `SELECT h.*, pr.status as run_status 
             FROM schedule_task_history h 
             LEFT JOIN pipeline_run pr ON h.run_id = pr.id 
             WHERE h.task_id = ? 
             ORDER BY h.trigger_time DESC 
             LIMIT ${limitNum}`,
            [req.params.id]
        );
        res.json({ success: true, data: rows });
    } catch (error) {
        logger.error('Get schedule task history error:', { message: error.message });
        res.status(500).json({ success: false, message: '获取执行历史失败' });
    }
});

router.post('/', roleGuard('admin', 'editor'), async (req, res) => {
    try {
        const { name, pipelineId, environment, cronExpression, enabled = 1, retryCount = 0, timeoutMinutes = 60 } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ success: false, message: '任务名称不能为空' });
        if (!pipelineId) return res.status(400).json({ success: false, message: '请选择关联生产线' });
        if (!cronExpression || !cronExpression.trim()) return res.status(400).json({ success: false, message: 'cron表达式不能为空' });

        const nextRunTime = calculateNextRunTime(cronExpression);
        
        const result = await db.query(
            `INSERT INTO schedule_task 
             (name, pipeline_id, environment, cron_expression, enabled, retry_count, timeout_minutes, next_run_time, created_by) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [name.trim(), pipelineId, environment || 'test', cronExpression.trim(), enabled ? 1 : 0, 
             parseInt(retryCount) || 0, parseInt(timeoutMinutes) || 60, nextRunTime, req.user.id]
        );
        const taskId = result.insertId;

        if (enabled) {
            const [task] = await db.query('SELECT * FROM schedule_task WHERE id = ?', [taskId]);
            startTask(task[0]);
        }

        await db.query(
            'INSERT INTO operation_log (user_id, username, action, target, detail, ip) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, req.user.username, '创建调度任务', name, `创建调度任务: ${name}`, req.ip]
        );

        logger.info('Schedule task created:', { id: taskId, name });
        res.json({ success: true, data: { id: taskId }, message: '创建成功' });
    } catch (error) {
        logger.error('Create schedule task error:', { message: error.message });
        res.status(500).json({ success: false, message: '创建调度任务失败' });
    }
});

router.put('/:id', roleGuard('admin', 'editor'), async (req, res) => {
    try {
        const { name, pipelineId, environment, cronExpression, enabled, retryCount, timeoutMinutes } = req.body;
        if (name !== undefined && !name.trim()) return res.status(400).json({ success: false, message: '名称不能为空' });

        const [existingTasks] = await db.query('SELECT * FROM schedule_task WHERE id = ?', [req.params.id]);
        if (existingTasks.length === 0) return res.status(404).json({ success: false, message: '调度任务不存在' });

        const updates = [];
        const params = [];
        if (name) { updates.push('name = ?'); params.push(name.trim()); }
        if (pipelineId) { updates.push('pipeline_id = ?'); params.push(pipelineId); }
        if (environment) { updates.push('environment = ?'); params.push(environment); }
        if (cronExpression) { 
            updates.push('cron_expression = ?'); 
            params.push(cronExpression.trim());
            updates.push('next_run_time = ?');
            params.push(calculateNextRunTime(cronExpression));
        }
        if (enabled !== undefined) { updates.push('enabled = ?'); params.push(enabled ? 1 : 0); }
        if (retryCount !== undefined) { updates.push('retry_count = ?'); params.push(parseInt(retryCount) || 0); }
        if (timeoutMinutes !== undefined) { updates.push('timeout_minutes = ?'); params.push(parseInt(timeoutMinutes) || 60); }

        if (updates.length > 0) {
            params.push(req.params.id);
            await db.query(`UPDATE schedule_task SET ${updates.join(', ')} WHERE id = ?`, params);
        }

        const [updatedTasks] = await db.query('SELECT * FROM schedule_task WHERE id = ?', [req.params.id]);
        const updatedTask = updatedTasks[0];

        stopTask(updatedTask.id);
        if (updatedTask.enabled) {
            startTask(updatedTask);
        }

        logger.info('Schedule task updated:', { id: req.params.id });
        res.json({ success: true, message: '更新成功' });
    } catch (error) {
        logger.error('Update schedule task error:', { message: error.message });
        res.status(500).json({ success: false, message: '更新调度任务失败' });
    }
});

router.patch('/:id/toggle', roleGuard('admin', 'editor'), async (req, res) => {
    try {
        const [tasks] = await db.query('SELECT * FROM schedule_task WHERE id = ?', [req.params.id]);
        if (tasks.length === 0) return res.status(404).json({ success: false, message: '调度任务不存在' });

        const task = tasks[0];
        const newEnabled = task.enabled ? 0 : 1;

        await db.query('UPDATE schedule_task SET enabled = ? WHERE id = ?', [newEnabled, req.params.id]);

        if (newEnabled) {
            task.enabled = 1;
            startTask(task);
        } else {
            stopTask(task.id);
        }

        await db.query(
            'INSERT INTO operation_log (user_id, username, action, target, detail, ip) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, req.user.username, newEnabled ? '启用调度任务' : '禁用调度任务', 
             task.name, `${newEnabled ? '启用' : '禁用'}调度任务: ${task.name}`, req.ip]
        );

        logger.info('Schedule task toggled:', { id: req.params.id, enabled: newEnabled });
        res.json({ success: true, data: { enabled: newEnabled }, message: newEnabled ? '已启用' : '已禁用' });
    } catch (error) {
        logger.error('Toggle schedule task error:', { message: error.message });
        res.status(500).json({ success: false, message: '操作失败' });
    }
});

router.delete('/:id', roleGuard('admin', 'editor'), async (req, res) => {
    try {
        const rows = await db.query('SELECT name FROM schedule_task WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: '调度任务不存在' });

        stopTask(parseInt(req.params.id));
        await db.query('DELETE FROM schedule_task WHERE id = ?', [req.params.id]);

        await db.query(
            'INSERT INTO operation_log (user_id, username, action, target, detail, ip) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, req.user.username, '删除调度任务', rows[0].name, `删除调度任务: ${rows[0].name}`, req.ip]
        );

        logger.info('Schedule task deleted:', { id: req.params.id });
        res.json({ success: true, message: '删除成功' });
    } catch (error) {
        logger.error('Delete schedule task error:', { message: error.message });
        res.status(500).json({ success: false, message: '删除调度任务失败' });
    }
});

module.exports = router;
