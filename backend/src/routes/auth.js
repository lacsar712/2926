const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../utils/db');
const logger = require('../utils/logger');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
        }
        const users = await db.query('SELECT * FROM sys_user WHERE username = ?', [username]);
        if (users.length === 0) {
            return res.status(401).json({ success: false, message: '用户名或密码错误' });
        }
        const user = users[0];
        if (user.status !== 1) {
            return res.status(403).json({ success: false, message: '账号已被禁用' });
        }
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(401).json({ success: false, message: '用户名或密码错误' });
        }
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, nickname: user.nickname },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        await db.query(
            'INSERT INTO operation_log (user_id, username, action, target, detail, ip) VALUES (?, ?, ?, ?, ?, ?)',
            [user.id, user.username, '登录系统', '用户认证', '登录成功', req.ip]
        );
        logger.info('User logged in:', { username: user.username });
        res.json({
            success: true,
            data: {
                token,
                user: { id: user.id, username: user.username, nickname: user.nickname, role: user.role, email: user.email, avatar: user.avatar }
            }
        });
    } catch (error) {
        logger.error('Login error:', { message: error.message });
        res.status(500).json({ success: false, message: '登录失败' });
    }
});

router.get('/info', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ success: false, message: '未认证' });
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const users = await db.query('SELECT id, username, nickname, email, phone, role, avatar, status FROM sys_user WHERE id = ?', [decoded.id]);
        if (users.length === 0) return res.status(404).json({ success: false, message: '用户不存在' });
        res.json({ success: true, data: users[0] });
    } catch (error) {
        logger.error('Get user info error:', { message: error.message });
        res.status(500).json({ success: false, message: '获取用户信息失败' });
    }
});

module.exports = router;
