const express = require('express');
const db = require('../utils/db');
const logger = require('../utils/logger');
const { roleGuard } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (_req, res) => {
    try {
        const rows = await db.query('SELECT * FROM tag ORDER BY created_at DESC');
        res.json({ success: true, data: rows });
    } catch (error) {
        logger.error('Get tags error:', { message: error.message });
        res.status(500).json({ success: false, message: '获取标签列表失败' });
    }
});

router.post('/', roleGuard('admin', 'editor'), async (req, res) => {
    try {
        const { name, color } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ success: false, message: '标签名称不能为空' });
        const existing = await db.query('SELECT id FROM tag WHERE name = ?', [name.trim()]);
        if (existing.length > 0) return res.status(400).json({ success: false, message: '标签名称已存在' });
        const result = await db.query('INSERT INTO tag (name, color) VALUES (?, ?)', [name.trim(), color || '#409EFF']);
        logger.info('Tag created:', { id: result.insertId, name });
        res.json({ success: true, data: { id: result.insertId }, message: '创建成功' });
    } catch (error) {
        logger.error('Create tag error:', { message: error.message });
        res.status(500).json({ success: false, message: '创建标签失败' });
    }
});

router.put('/:id', roleGuard('admin', 'editor'), async (req, res) => {
    try {
        const { name, color } = req.body;
        const updates = [];
        const params = [];
        if (name) { updates.push('name = ?'); params.push(name.trim()); }
        if (color) { updates.push('color = ?'); params.push(color); }
        if (updates.length > 0) {
            params.push(req.params.id);
            await db.query(`UPDATE tag SET ${updates.join(', ')} WHERE id = ?`, params);
        }
        res.json({ success: true, message: '更新成功' });
    } catch (error) {
        logger.error('Update tag error:', { message: error.message });
        res.status(500).json({ success: false, message: '更新标签失败' });
    }
});

router.delete('/:id', roleGuard('admin', 'editor'), async (req, res) => {
    try {
        await db.query('DELETE FROM tag WHERE id = ?', [req.params.id]);
        logger.info('Tag deleted:', { id: req.params.id });
        res.json({ success: true, message: '删除成功' });
    } catch (error) {
        logger.error('Delete tag error:', { message: error.message });
        res.status(500).json({ success: false, message: '删除标签失败' });
    }
});

module.exports = router;
