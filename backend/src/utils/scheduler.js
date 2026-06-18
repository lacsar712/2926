const cron = require('node-cron');
const db = require('./db');
const logger = require('./logger');

const activeTasks = new Map();

const parseCronToNodeCron = (cronExpr) => {
    const parts = cronExpr.trim().split(/\s+/);
    let minute, hour, day, month, week;
    
    if (parts.length === 6) {
        [, minute, hour, day, month, week] = parts;
    } else if (parts.length === 5) {
        [minute, hour, day, month, week] = parts;
    } else {
        return cronExpr;
    }
    
    if (day === '?') day = '*';
    if (week === '?') week = '*';
    
    const weekDayMap = {
        'SUN': 0, 'MON': 1, 'TUE': 2, 'WED': 3, 'THU': 4, 'FRI': 5, 'SAT': 6,
        'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6
    };
    
    const convertWeekValue = (val) => {
        if (val === '*') return '*';
        
        const convertSingle = (v) => {
            if (weekDayMap[v] !== undefined) return weekDayMap[v];
            const num = parseInt(v);
            return isNaN(num) ? v : (num === 7 ? 0 : num - 1);
        };
        
        if (val.includes(',')) {
            return val.split(',').map(convertSingle).join(',');
        }
        if (val.includes('-')) {
            const [start, end] = val.split('-').map(convertSingle);
            return `${start}-${end}`;
        }
        if (val.includes('/')) {
            return val;
        }
        return convertSingle(val);
    };
    
    week = convertWeekValue(week);
    
    return `${minute} ${hour} ${day} ${month} ${week}`;
};

const calculateNextRunTime = (cronExpr) => {
    try {
        const nodeCronExpr = parseCronToNodeCron(cronExpr);
        if (!cron.validate(nodeCronExpr)) {
            return null;
        }
        const now = new Date();
        const nextDate = getNextCronTime(nodeCronExpr, now);
        return nextDate;
    } catch (error) {
        logger.error('Calculate next run time error:', { cronExpr, error: error.message });
        return null;
    }
};

const getNextCronTime = (cronExpr, fromDate) => {
    const parts = cronExpr.split(' ');
    if (parts.length !== 5) return null;
    
    const [minuteExpr, hourExpr, dayExpr, monthExpr, weekExpr] = parts;
    
    const weekDayMap = {
        'SUN': 0, 'MON': 1, 'TUE': 2, 'WED': 3, 'THU': 4, 'FRI': 5, 'SAT': 6,
        'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6
    };
    
    const parseField = (expr, min, max, isWeek = false) => {
        const values = [];
        const parseValue = (v) => {
            if (isWeek && weekDayMap[v] !== undefined) return weekDayMap[v];
            const num = parseInt(v);
            return isNaN(num) ? v : num;
        };
        if (expr === '*') {
            for (let i = min; i <= max; i++) values.push(i);
        } else if (expr.includes('/')) {
            const [range, step] = expr.split('/');
            const stepNum = parseInt(step);
            let start = min;
            let end = max;
            if (range !== '*') {
                [start, end] = range.includes('-') ? range.split('-').map(v => parseValue(v)) : [parseValue(range), max];
            }
            for (let i = start; i <= end; i += stepNum) values.push(i);
        } else if (expr.includes(',')) {
            expr.split(',').forEach(v => values.push(parseValue(v)));
        } else if (expr.includes('-')) {
            const [start, end] = expr.split('-').map(v => parseValue(v));
            for (let i = start; i <= end; i++) values.push(i);
        } else {
            values.push(parseValue(expr));
        }
        return values;
    };
    
    const minutes = parseField(minuteExpr, 0, 59);
    const hours = parseField(hourExpr, 0, 23);
    const days = parseField(dayExpr, 1, 31);
    const months = parseField(monthExpr, 1, 12);
    const weeks = parseField(weekExpr, 0, 6, true);
    
    const next = new Date(fromDate);
    next.setSeconds(0, 0);
    next.setMinutes(next.getMinutes() + 1);
    
    for (let i = 0; i < 525600; i++) {
        const month = next.getMonth() + 1;
        const day = next.getDate();
        const weekDay = next.getDay();
        const hour = next.getHours();
        const minute = next.getMinutes();
        
        if (months.includes(month) && 
            days.includes(day) && 
            weeks.includes(weekDay) &&
            hours.includes(hour) && 
            minutes.includes(minute)) {
            return next;
        }
        
        next.setMinutes(next.getMinutes() + 1);
    }
    
    return null;
};

const executeTask = async (task) => {
    const startTime = Date.now();
    let historyId = null;
    let runId = null;

    try {
        logger.info('Executing scheduled task:', { taskId: task.id, name: task.name, pipelineId: task.pipeline_id });

        const historyResult = await db.query(
            'INSERT INTO schedule_task_history (task_id, status, retry_attempt) VALUES (?, ?, ?)',
            [task.id, 'running', 0]
        );
        historyId = historyResult.insertId;

        const runResult = await db.query(
            'INSERT INTO pipeline_run (pipeline_id, status, start_time) VALUES (?, ?, NOW())',
            [task.pipeline_id, 'running']
        );
        runId = runResult.insertId;

        await db.query(
            'UPDATE schedule_task_history SET run_id = ? WHERE id = ?',
            [runId, historyId]
        );

        await db.query(
            'UPDATE schedule_task SET last_run_time = NOW(), last_run_result = ?, next_run_time = ? WHERE id = ?',
            ['running', calculateNextRunTime(task.cron_expression), task.id]
        );

        const simulateDelay = Math.floor(Math.random() * 5000) + 2000;
        
        setTimeout(async () => {
            try {
                const success = Math.random() > 0.2;
                const endTime = Date.now();
                const duration = Math.floor((endTime - startTime) / 1000);

                if (success) {
                    await db.query(
                        'UPDATE pipeline_run SET status = ?, end_time = NOW(), total_input = ?, total_output = ?, error_count = ? WHERE id = ?',
                        ['completed', Math.floor(Math.random() * 10000) + 1000, Math.floor(Math.random() * 9000) + 500, Math.floor(Math.random() * 10), runId]
                    );
                    await db.query(
                        'UPDATE schedule_task_history SET status = ?, duration_seconds = ? WHERE id = ?',
                        ['success', duration, historyId]
                    );
                    await db.query(
                        'UPDATE schedule_task SET last_run_result = ? WHERE id = ?',
                        ['success', task.id]
                    );
                    logger.info('Scheduled task completed successfully:', { taskId: task.id, name: task.name, duration });
                } else {
                    await handleFailure(task, historyId, runId, startTime, '模拟执行失败', 0);
                }
            } catch (error) {
                logger.error('Simulate task result error:', { taskId: task.id, error: error.message });
                await handleFailure(task, historyId, runId, startTime, error.message, 0);
            }
        }, simulateDelay);

    } catch (error) {
        logger.error('Execute scheduled task error:', { taskId: task.id, error: error.message });
        if (historyId) {
            await db.query(
                'UPDATE schedule_task_history SET status = ?, error_message = ? WHERE id = ?',
                ['failed', error.message, historyId]
            );
        }
        await db.query(
            'UPDATE schedule_task SET last_run_result = ? WHERE id = ?',
            ['failed', task.id]
        );
    }
};

const handleFailure = async (task, historyId, runId, startTime, errorMessage, currentRetry) => {
    if (currentRetry < task.retry_count) {
        logger.info('Retrying scheduled task:', { taskId: task.id, name: task.name, retry: currentRetry + 1 });
        const newRetry = currentRetry + 1;
        
        const retryHistoryResult = await db.query(
            'INSERT INTO schedule_task_history (task_id, status, retry_attempt) VALUES (?, ?, ?)',
            [task.id, 'running', newRetry]
        );
        const newHistoryId = retryHistoryResult.insertId;

        const newRunResult = await db.query(
            'INSERT INTO pipeline_run (pipeline_id, status, start_time) VALUES (?, ?, NOW())',
            [task.pipeline_id, 'running']
        );
        const newRunId = newRunResult.insertId;

        await db.query(
            'UPDATE schedule_task_history SET run_id = ? WHERE id = ?',
            [newRunId, newHistoryId]
        );

        const retryDelay = Math.floor(Math.random() * 3000) + 1000;
        setTimeout(async () => {
            try {
                const success = Math.random() > 0.3;
                const duration = Math.floor((Date.now() - startTime) / 1000);

                if (success) {
                    await db.query(
                        'UPDATE pipeline_run SET status = ?, end_time = NOW(), total_input = ?, total_output = ?, error_count = ? WHERE id = ?',
                        ['completed', Math.floor(Math.random() * 10000) + 1000, Math.floor(Math.random() * 9000) + 500, Math.floor(Math.random() * 10), newRunId]
                    );
                    await db.query(
                        'UPDATE schedule_task_history SET status = ?, duration_seconds = ? WHERE id = ?',
                        ['success', duration, newHistoryId]
                    );
                    await db.query(
                        'UPDATE schedule_task SET last_run_result = ? WHERE id = ?',
                        ['success', task.id]
                    );
                    logger.info('Scheduled task retry succeeded:', { taskId: task.id, retry: newRetry });
                } else {
                    await handleFailure(task, newHistoryId, newRunId, startTime, '重试执行失败', newRetry);
                }
            } catch (error) {
                await handleFailure(task, newHistoryId, newRunId, startTime, error.message, newRetry);
            }
        }, retryDelay);
    } else {
        const duration = Math.floor((Date.now() - startTime) / 1000);
        await db.query(
            'UPDATE pipeline_run SET status = ?, end_time = NOW(), error_count = ? WHERE id = ?',
            ['failed', 1, runId]
        );
        await db.query(
            'UPDATE schedule_task_history SET status = ?, error_message = ?, duration_seconds = ? WHERE id = ?',
            ['failed', errorMessage, duration, historyId]
        );
        await db.query(
            'UPDATE schedule_task SET last_run_result = ? WHERE id = ?',
            ['failed', task.id]
        );
        logger.info('Scheduled task failed after all retries:', { taskId: task.id, name: task.name });
    }
};

const startTask = (task) => {
    try {
        stopTask(task.id);

        const nodeCronExpr = parseCronToNodeCron(task.cron_expression);
        if (!cron.validate(nodeCronExpr)) {
            logger.error('Invalid cron expression:', { taskId: task.id, cron: task.cron_expression });
            return;
        }

        const cronTask = cron.schedule(nodeCronExpr, () => {
            executeTask(task);
        }, {
            timezone: 'Asia/Shanghai'
        });

        activeTasks.set(task.id, cronTask);
        logger.info('Scheduled task started:', { taskId: task.id, name: task.name, cron: task.cron_expression });

        db.query(
            'UPDATE schedule_task SET next_run_time = ? WHERE id = ?',
            [calculateNextRunTime(task.cron_expression), task.id]
        );
    } catch (error) {
        logger.error('Start scheduled task error:', { taskId: task.id, error: error.message });
    }
};

const stopTask = (taskId) => {
    const cronTask = activeTasks.get(taskId);
    if (cronTask) {
        cronTask.stop();
        activeTasks.delete(taskId);
        logger.info('Scheduled task stopped:', { taskId });
    }
};

const initScheduler = async () => {
    try {
        const tasks = await db.query('SELECT * FROM schedule_task WHERE enabled = 1');
        logger.info(`Initializing scheduler with ${tasks.length} enabled tasks`);
        
        for (const task of tasks) {
            startTask(task);
        }

        logger.info('Scheduler initialized successfully');
    } catch (error) {
        logger.error('Initialize scheduler error:', { message: error.message });
    }
};

module.exports = {
    initScheduler,
    startTask,
    stopTask,
    calculateNextRunTime,
    parseCronToNodeCron
};
