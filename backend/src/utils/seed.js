const bcrypt = require('bcryptjs');
const db = require('./db');
const logger = require('./logger');

const DEFAULT_USERS = [
    { username: 'admin', nickname: '系统管理员', email: 'admin@pipeline.com', phone: '13800138000', role: 'admin' },
    { username: 'zhangsan', nickname: '张三', email: 'zhangsan@pipeline.com', phone: '13800138001', role: 'editor' },
    { username: 'lisi', nickname: '李四', email: 'lisi@pipeline.com', phone: '13800138002', role: 'viewer' }
];

const ensureSeedData = async () => {
    const [{ count }] = await db.query('SELECT COUNT(*) as count FROM sys_user');
    if (count > 0) return;

    logger.info('No users found, seeding default accounts...');
    const passwordHash = bcrypt.hashSync('123456', 10);

    for (const user of DEFAULT_USERS) {
        await db.query(
            'INSERT INTO sys_user (username, password, nickname, email, phone, role, status) VALUES (?, ?, ?, ?, ?, ?, 1)',
            [user.username, passwordHash, user.nickname, user.email, user.phone, user.role]
        );
    }

    logger.info('Default users seeded (password: 123456)');
};

module.exports = { ensureSeedData };
