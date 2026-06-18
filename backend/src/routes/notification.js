const express = require('express');
const db = require('../utils/db');
const logger = require('../utils/logger');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { type, isRead, page = 1, pageSize = 10 } = req.query;
    const userId = req.user.id;
    
    let sql = 'SELECT * FROM notification WHERE user_id = ?';
    const params = [userId];
    
    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    if (isRead !== undefined && isRead !== '') {
      sql += ' AND is_read = ?';
      params.push(isRead === '1' ? 1 : 0);
    }
    
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
    const [countResult] = await db.query(countSql, params);
    const total = countResult.total;
    
    const limit = parseInt(pageSize) || 10;
    const offset = (parseInt(page) - 1) * limit;
    sql += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    
    const list = await db.query(sql, params);
    
    res.json({
      success: true,
      data: {
        list,
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (error) {
    logger.error('Get notifications error:', { message: error.message });
    res.status(500).json({ success: false, message: '获取通知列表失败' });
  }
});

router.get('/recent', async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 5 } = req.query;
    const limitNum = Math.min(parseInt(limit) || 5, 50);

    const list = await db.query(
      `SELECT * FROM notification WHERE user_id = ? ORDER BY created_at DESC LIMIT ${limitNum}`,
      [userId]
    );
    
    res.json({ success: true, data: list });
  } catch (error) {
    logger.error('Get recent notifications error:', { message: error.message });
    res.status(500).json({ success: false, message: '获取最近通知失败' });
  }
});

router.get('/unread-count', async (req, res) => {
  try {
    const userId = req.user.id;
    
    const [result] = await db.query(
      'SELECT COUNT(*) as count FROM notification WHERE user_id = ? AND is_read = 0',
      [userId]
    );
    
    res.json({ success: true, data: { count: result.count } });
  } catch (error) {
    logger.error('Get unread count error:', { message: error.message });
    res.status(500).json({ success: false, message: '获取未读数量失败' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const rows = await db.query(
      'SELECT * FROM notification WHERE id = ? AND user_id = ?',
      [req.params.id, userId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '通知不存在' });
    }
    
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    logger.error('Get notification detail error:', { message: error.message });
    res.status(500).json({ success: false, message: '获取通知详情失败' });
  }
});

router.put('/:id/read', async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;
    
    const rows = await db.query(
      'SELECT id FROM notification WHERE id = ? AND user_id = ?',
      [notificationId, userId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '通知不存在' });
    }
    
    await db.query(
      'UPDATE notification SET is_read = 1, read_at = NOW() WHERE id = ?',
      [notificationId]
    );
    
    res.json({ success: true, message: '标记已读成功' });
  } catch (error) {
    logger.error('Mark notification read error:', { message: error.message });
    res.status(500).json({ success: false, message: '标记已读失败' });
  }
});

router.put('/read-batch', async (req, res) => {
  try {
    const userId = req.user.id;
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: '请选择要标记的通知' });
    }
    
    const placeholders = ids.map(() => '?').join(',');
    const params = [...ids, userId];
    
    await db.query(
      `UPDATE notification SET is_read = 1, read_at = NOW() WHERE id IN (${placeholders}) AND user_id = ?`,
      params
    );
    
    res.json({ success: true, message: `已将 ${ids.length} 条通知标记为已读` });
  } catch (error) {
    logger.error('Mark batch read error:', { message: error.message });
    res.status(500).json({ success: false, message: '批量标记已读失败' });
  }
});

router.put('/read-all', async (req, res) => {
  try {
    const userId = req.user.id;
    
    await db.query(
      'UPDATE notification SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0',
      [userId]
    );
    
    res.json({ success: true, message: '已将全部通知标记为已读' });
  } catch (error) {
    logger.error('Mark all read error:', { message: error.message });
    res.status(500).json({ success: false, message: '标记全部已读失败' });
  }
});

router.delete('/clear-read', async (req, res) => {
  try {
    const userId = req.user.id;
    
    await db.query(
      'DELETE FROM notification WHERE user_id = ? AND is_read = 1',
      [userId]
    );
    
    res.json({ success: true, message: '已清空已读通知' });
  } catch (error) {
    logger.error('Clear read notifications error:', { message: error.message });
    res.status(500).json({ success: false, message: '清空已读通知失败' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;
    
    const rows = await db.query(
      'SELECT id FROM notification WHERE id = ? AND user_id = ?',
      [notificationId, userId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '通知不存在' });
    }
    
    await db.query('DELETE FROM notification WHERE id = ?', [notificationId]);
    
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    logger.error('Delete notification error:', { message: error.message });
    res.status(500).json({ success: false, message: '删除失败' });
  }
});

module.exports = router;
