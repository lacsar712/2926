const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'pipeline_jwt_secret_2024_secure';

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: '未提供认证令牌' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        logger.warn('Token verification failed:', { error: error.message });
        return res.status(401).json({ success: false, message: '令牌无效或已过期' });
    }
};

const roleGuard = (...allowedRoles) => (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ success: false, message: '权限不足，无法执行此操作' });
    }
    next();
};

module.exports = { authMiddleware, roleGuard, JWT_SECRET };
