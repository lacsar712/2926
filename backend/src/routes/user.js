const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../utils/db');
const logger = require('../utils/logger');
const { roleGuard } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const { keyword, role, page = 1, pageSize = 10 } = req.query;
        let sql = 'SELECT id, username, nickname, email, phone, role, status, avatar, created_at FROM sys_user WHERE 1=1';
        const params = [];
        if (keyword) { sql += ' AND (username LIKE ? OR nickname LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`); }
        if (role) { sql += ' AND role = ?'; params.push(role); }
        const countSql = sql.replace('SELECT id, username, nickname, email, phone, role, status, avatar, created_at', 'SELECT COUNT(*) as total');
        const [countResult] = await db.query(countSql, params);
        const limit = parseInt(pageSize);
        const offset = (parseInt(page) - 1) * limit;
        sql += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
        const rows = await db.query(sql, params);
        res.json({ success: true, data: { list: rows, total: countResult.total, page: parseInt(page), pageSize: parseInt(pageSize) } });
    } catch (error) {
        logger.error('Get users error:', { message: error.message });
        res.status(500).json({ success: false, message: '获取用户列表失败' });
    }
});

router.post('/', roleGuard('admin'), async (req, res) => {
    try {
        const { username, password, nickname, email, phone, role } = req.body;
        if (!username || !password || !nickname) return res.status(400).json({ success: false, message: '用户名、密码和昵称不能为空' });
        const existing = await db.query('SELECT id FROM sys_user WHERE username = ?', [username]);
        if (existing.length > 0) return res.status(400).json({ success: false, message: '用户名已存在' });
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await db.query(
            'INSERT INTO sys_user (username, password, nickname, email, phone, role) VALUES (?, ?, ?, ?, ?, ?)',
            [username, hashedPassword, nickname, email || '', phone || '', role || 'viewer']
        );
        logger.info('User created:', { id: result.insertId, username });
        res.json({ success: true, data: { id: result.insertId }, message: '创建成功' });
    } catch (error) {
        logger.error('Create user error:', { message: error.message });
        res.status(500).json({ success: false, message: '创建用户失败' });
    }
});

router.put('/:id', roleGuard('admin'), async (req, res) => {
    try {
        const { nickname, email, phone, role, status, password } = req.body;
        const updates = [];
        const params = [];
        if (nickname) { updates.push('nickname = ?'); params.push(nickname); }
        if (email !== undefined) { updates.push('email = ?'); params.push(email); }
        if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
        if (role) { updates.push('role = ?'); params.push(role); }
        if (status !== undefined) { updates.push('status = ?'); params.push(status); }
        if (password) { updates.push('password = ?'); params.push(await bcrypt.hash(password, 10)); }
        if (updates.length > 0) {
            params.push(req.params.id);
            await db.query(`UPDATE sys_user SET ${updates.join(', ')} WHERE id = ?`, params);
        }
        res.json({ success: true, message: '更新成功' });
    } catch (error) {
        logger.error('Update user error:', { message: error.message });
        res.status(500).json({ success: false, message: '更新用户失败' });
    }
});

router.delete('/:id', roleGuard('admin'), async (req, res) => {
    try {
        if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ success: false, message: '不能删除自己' });
        await db.query('DELETE FROM sys_user WHERE id = ?', [req.params.id]);
        logger.info('User deleted:', { id: req.params.id });
        res.json({ success: true, message: '删除成功' });
    } catch (error) {
        logger.error('Delete user error:', { message: error.message });
        res.status(500).json({ success: false, message: '删除用户失败' });
    }
});

module.exports = router;
