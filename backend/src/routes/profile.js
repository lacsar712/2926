const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../utils/db');
const logger = require('../utils/logger');

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const users = await db.query(
            'SELECT id, username, nickname, email, phone, avatar, role, status, created_at FROM sys_user WHERE id = ?',
            [userId]
        );
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: '用户不存在' });
        }
        res.json({ success: true, data: users[0] });
    } catch (error) {
        logger.error('Get profile error:', { message: error.message });
        res.status(500).json({ success: false, message: '获取个人信息失败' });
    }
});

router.put('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const { nickname, email, phone } = req.body;

        if (!nickname || !nickname.trim()) {
            return res.status(400).json({ success: false, message: '昵称不能为空' });
        }

        const updates = [];
        const params = [];

        if (nickname !== undefined) {
            updates.push('nickname = ?');
            params.push(nickname);
        }
        if (email !== undefined) {
            updates.push('email = ?');
            params.push(email || '');
        }
        if (phone !== undefined) {
            updates.push('phone = ?');
            params.push(phone || '');
        }

        if (updates.length > 0) {
            params.push(userId);
            await db.query(`UPDATE sys_user SET ${updates.join(', ')} WHERE id = ?`, params);
        }

        const users = await db.query(
            'SELECT id, username, nickname, email, phone, avatar, role, status FROM sys_user WHERE id = ?',
            [userId]
        );

        await db.query(
            'INSERT INTO operation_log (user_id, username, action, target, detail, ip) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, req.user.username, '更新个人信息', '个人中心', '更新基本信息', req.ip]
        );

        res.json({ success: true, data: users[0], message: '更新成功' });
    } catch (error) {
        logger.error('Update profile error:', { message: error.message });
        res.status(500).json({ success: false, message: '更新个人信息失败' });
    }
});

router.post('/change-password', async (req, res) => {
    try {
        const userId = req.user.id;
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            return res.status(400).json({ success: false, message: '旧密码和新密码不能为空' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: '新密码长度不能少于6位' });
        }

        const users = await db.query('SELECT password FROM sys_user WHERE id = ?', [userId]);
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: '用户不存在' });
        }

        const isValid = await bcrypt.compare(oldPassword, users[0].password);
        if (!isValid) {
            return res.status(400).json({ success: false, message: '旧密码不正确' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE sys_user SET password = ? WHERE id = ?', [hashedPassword, userId]);

        await db.query(
            'INSERT INTO operation_log (user_id, username, action, target, detail, ip) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, req.user.username, '修改密码', '个人中心', '修改登录密码', req.ip]
        );

        res.json({ success: true, message: '密码修改成功' });
    } catch (error) {
        logger.error('Change password error:', { message: error.message });
        res.status(500).json({ success: false, message: '修改密码失败' });
    }
});

router.get('/preference', async (req, res) => {
    try {
        const userId = req.user.id;
        let prefs = await db.query('SELECT * FROM user_preference WHERE user_id = ?', [userId]);

        if (prefs.length === 0) {
            await db.query(
                'INSERT INTO user_preference (user_id, theme, page_size, auto_save) VALUES (?, ?, ?, ?)',
                [userId, 'dark', 10, 1]
            );
            prefs = await db.query('SELECT * FROM user_preference WHERE user_id = ?', [userId]);
        }

        const pref = prefs[0];
        res.json({
            success: true,
            data: {
                theme: pref.theme,
                pageSize: pref.page_size,
                autoSave: pref.auto_save === 1
            }
        });
    } catch (error) {
        logger.error('Get preference error:', { message: error.message });
        res.status(500).json({ success: false, message: '获取偏好设置失败' });
    }
});

router.put('/preference', async (req, res) => {
    try {
        const userId = req.user.id;
        const { theme, pageSize, autoSave } = req.body;

        const updates = [];
        const params = [];

        if (theme !== undefined) {
            if (!['light', 'dark', 'system'].includes(theme)) {
                return res.status(400).json({ success: false, message: '无效的主题值' });
            }
            updates.push('theme = ?');
            params.push(theme);
        }
        if (pageSize !== undefined) {
            const ps = parseInt(pageSize);
            if (isNaN(ps) || ps < 1 || ps > 100) {
                return res.status(400).json({ success: false, message: '无效的分页大小' });
            }
            updates.push('page_size = ?');
            params.push(ps);
        }
        if (autoSave !== undefined) {
            updates.push('auto_save = ?');
            params.push(autoSave ? 1 : 0);
        }

        if (updates.length === 0) {
            return res.status(400).json({ success: false, message: '没有需要更新的字段' });
        }

        const existing = await db.query('SELECT id FROM user_preference WHERE user_id = ?', [userId]);

        if (existing.length > 0) {
            params.push(userId);
            await db.query(`UPDATE user_preference SET ${updates.join(', ')} WHERE user_id = ?`, params);
        } else {
            const themeVal = theme || 'dark';
            const pageSizeVal = pageSize || 10;
            const autoSaveVal = autoSave !== undefined ? (autoSave ? 1 : 0) : 1;
            await db.query(
                'INSERT INTO user_preference (user_id, theme, page_size, auto_save) VALUES (?, ?, ?, ?)',
                [userId, themeVal, pageSizeVal, autoSaveVal]
            );
        }

        const prefs = await db.query('SELECT * FROM user_preference WHERE user_id = ?', [userId]);
        const pref = prefs[0];

        await db.query(
            'INSERT INTO operation_log (user_id, username, action, target, detail, ip) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, req.user.username, '更新偏好设置', '个人中心', '更新用户偏好设置', req.ip]
        );

        res.json({
            success: true,
            data: {
                theme: pref.theme,
                pageSize: pref.page_size,
                autoSave: pref.auto_save === 1
            },
            message: '偏好设置更新成功'
        });
    } catch (error) {
        logger.error('Update preference error:', { message: error.message });
        res.status(500).json({ success: false, message: '更新偏好设置失败' });
    }
});

module.exports = router;
