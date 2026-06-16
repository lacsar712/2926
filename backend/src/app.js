const express = require('express');
const cors = require('cors');
const logger = require('./utils/logger');
const db = require('./utils/db');

const authRoutes = require('./routes/auth');
const pipelineRoutes = require('./routes/pipeline');
const flowRoutes = require('./routes/flow');
const monitorRoutes = require('./routes/monitor');
const tagRoutes = require('./routes/tag');
const userRoutes = require('./routes/user');
const logRoutes = require('./routes/log');
const notificationRoutes = require('./routes/notification');
const templateRoutes = require('./routes/template');
const qualityRuleRoutes = require('./routes/quality-rule');
const scheduleRoutes = require('./routes/schedule');
const componentDocRoutes = require('./routes/component-doc');

const { authMiddleware } = require('./middleware/auth');
const { initScheduler } = require('./utils/scheduler');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 健康检查
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 公开路由
app.use('/api/auth', authRoutes);

// 需要认证的路由
app.use('/api/pipelines', authMiddleware, pipelineRoutes);
app.use('/api/flows', authMiddleware, flowRoutes);
app.use('/api/monitor', authMiddleware, monitorRoutes);
app.use('/api/tags', authMiddleware, tagRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/logs', authMiddleware, logRoutes);
app.use('/api/notifications', authMiddleware, notificationRoutes);
app.use('/api/templates', authMiddleware, templateRoutes);
app.use('/api/quality-rules', authMiddleware, qualityRuleRoutes);
app.use('/api/schedules', authMiddleware, scheduleRoutes);
app.use('/api/component-docs', authMiddleware, componentDocRoutes);

// 全局错误处理
app.use((err, _req, res, _next) => {
    logger.error('Unhandled error:', { message: err.message, stack: err.stack });
    res.status(500).json({ success: false, message: '服务器内部错误' });
});

const startServer = async () => {
    try {
        await db.testConnection();
        logger.info('Database connection established');
        await initScheduler();
        app.listen(PORT, '0.0.0.0', () => {
            logger.info(`Server running on port ${PORT}`);
        });
    } catch (error) {
        logger.error('Failed to start server:', { message: error.message });
        setTimeout(startServer, 5000);
    }
};

startServer();
