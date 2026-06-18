const express = require('express');
const db = require('../utils/db');
const logger = require('../utils/logger');
const { roleGuard } = require('../middleware/auth');

const router = express.Router();

const buildCommentWithUser = (row) => ({
  id: row.id,
  pipeline_id: row.pipeline_id,
  user_id: row.user_id,
  user: {
    id: row.user_id,
    nickname: row.user_nickname,
    username: row.user_username,
    role: row.user_role,
    avatar: row.user_avatar
  },
  content: row.content,
  reply_to_id: row.reply_to_id,
  reply_to: row.reply_to_id ? {
    id: row.reply_to_id,
    user_id: row.reply_user_id,
    nickname: row.reply_nickname,
    content: row.reply_content
  } : null,
  is_pinned: row.is_pinned === 1,
  pinned_at: row.pinned_at,
  pinned_by: row.pinned_by,
  created_at: row.created_at,
  updated_at: row.updated_at,
  can_edit: false,
  can_delete: false
});

const setPermissions = (comment, currentUser) => {
  if (!currentUser) return comment;
  comment.can_edit = currentUser.id === comment.user_id;
  comment.can_delete = currentUser.id === comment.user_id || currentUser.role === 'admin';
  return comment;
};

router.get('/pipeline/:pipelineId', async (req, res) => {
  try {
    const { pipelineId } = req.params;
    const { page = 1, pageSize = 10 } = req.query;

    const pipelineExists = await db.query('SELECT id FROM pipeline WHERE id = ?', [pipelineId]);
    if (pipelineExists.length === 0) {
      return res.status(404).json({ success: false, message: '生产线不存在' });
    }

    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM pipeline_comment WHERE pipeline_id = ? AND is_pinned = 0',
      [pipelineId]
    );
    const total = countResult[0].total;

    const pinnedRows = await db.query(`
      SELECT 
        pc.*,
        u.nickname as user_nickname, u.username as user_username, u.role as user_role, u.avatar as user_avatar,
        ru.nickname as reply_nickname, ru.id as reply_user_id, rpc.content as reply_content
      FROM pipeline_comment pc
      LEFT JOIN sys_user u ON pc.user_id = u.id
      LEFT JOIN pipeline_comment rpc ON pc.reply_to_id = rpc.id
      LEFT JOIN sys_user ru ON rpc.user_id = ru.id
      WHERE pc.pipeline_id = ? AND pc.is_pinned = 1
      ORDER BY pc.pinned_at DESC
    `, [pipelineId]);

    const limit = parseInt(pageSize);
    const offset = (parseInt(page) - 1) * limit;
    const commentRows = await db.query(`
      SELECT 
        pc.*,
        u.nickname as user_nickname, u.username as user_username, u.role as user_role, u.avatar as user_avatar,
        ru.nickname as reply_nickname, ru.id as reply_user_id, rpc.content as reply_content
      FROM pipeline_comment pc
      LEFT JOIN sys_user u ON pc.user_id = u.id
      LEFT JOIN pipeline_comment rpc ON pc.reply_to_id = rpc.id
      LEFT JOIN sys_user ru ON rpc.user_id = ru.id
      WHERE pc.pipeline_id = ? AND pc.is_pinned = 0
      ORDER BY pc.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `, [pipelineId]);

    const currentUser = req.user;
    const pinned = pinnedRows.map(r => setPermissions(buildCommentWithUser(r), currentUser));
    const comments = commentRows.map(r => setPermissions(buildCommentWithUser(r), currentUser));

    res.json({
      success: true,
      data: {
        pinned,
        list: comments,
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total_pinned: pinned.length
      }
    });
  } catch (error) {
    logger.error('Get comments error:', { message: error.message });
    res.status(500).json({ success: false, message: '获取评论列表失败' });
  }
});

router.get('/pipeline/:pipelineId/summary', async (req, res) => {
  try {
    const { pipelineId } = req.params;
    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM pipeline_comment WHERE pipeline_id = ?',
      [pipelineId]
    );
    const latestResult = await db.query(`
      SELECT 
        pc.*,
        u.nickname as user_nickname
      FROM pipeline_comment pc
      LEFT JOIN sys_user u ON pc.user_id = u.id
      WHERE pc.pipeline_id = ? AND pc.is_pinned = 0
      ORDER BY pc.created_at DESC
      LIMIT 1
    `, [pipelineId]);

    res.json({
      success: true,
      data: {
        comment_count: countResult[0].total,
        latest_comment: latestResult.length > 0 ? {
          id: latestResult[0].id,
          content: latestResult[0].content.substring(0, 100),
          user_nickname: latestResult[0].user_nickname,
          created_at: latestResult[0].created_at
        } : null
      }
    });
  } catch (error) {
    logger.error('Get comment summary error:', { message: error.message });
    res.status(500).json({ success: false, message: '获取评论摘要失败' });
  }
});

router.post('/', roleGuard('admin', 'editor'), async (req, res) => {
  try {
    const { pipeline_id, content, reply_to_id } = req.body;

    if (!pipeline_id || !content || !content.trim()) {
      return res.status(400).json({ success: false, message: '评论内容不能为空' });
    }

    const pipelineExists = await db.query('SELECT id FROM pipeline WHERE id = ?', [pipeline_id]);
    if (pipelineExists.length === 0) {
      return res.status(404).json({ success: false, message: '生产线不存在' });
    }

    if (reply_to_id) {
      const replyExists = await db.query('SELECT id FROM pipeline_comment WHERE id = ?', [reply_to_id]);
      if (replyExists.length === 0) {
        return res.status(404).json({ success: false, message: '回复的评论不存在' });
      }
    }

    const result = await db.query(
      'INSERT INTO pipeline_comment (pipeline_id, user_id, content, reply_to_id) VALUES (?, ?, ?, ?)',
      [pipeline_id, req.user.id, content.trim(), reply_to_id || null]
    );

    const rows = await db.query(`
      SELECT 
        pc.*,
        u.nickname as user_nickname, u.username as user_username, u.role as user_role, u.avatar as user_avatar,
        ru.nickname as reply_nickname, ru.id as reply_user_id, rpc.content as reply_content
      FROM pipeline_comment pc
      LEFT JOIN sys_user u ON pc.user_id = u.id
      LEFT JOIN pipeline_comment rpc ON pc.reply_to_id = rpc.id
      LEFT JOIN sys_user ru ON rpc.user_id = ru.id
      WHERE pc.id = ?
    `, [result.insertId]);

    const comment = setPermissions(buildCommentWithUser(rows[0]), req.user);

    logger.info('Comment created:', { id: result.insertId, pipeline_id, user_id: req.user.id });
    res.json({ success: true, data: comment, message: '评论发表成功' });
  } catch (error) {
    logger.error('Create comment error:', { message: error.message });
    res.status(500).json({ success: false, message: '发表评论失败' });
  }
});

router.put('/:id', roleGuard('admin', 'editor'), async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: '评论内容不能为空' });
    }

    const existing = await db.query('SELECT * FROM pipeline_comment WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: '评论不存在' });
    }

    if (existing[0].user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '无权限编辑此评论' });
    }

    await db.query('UPDATE pipeline_comment SET content = ? WHERE id = ?', [content.trim(), id]);

    const rows = await db.query(`
      SELECT 
        pc.*,
        u.nickname as user_nickname, u.username as user_username, u.role as user_role, u.avatar as user_avatar,
        ru.nickname as reply_nickname, ru.id as reply_user_id, rpc.content as reply_content
      FROM pipeline_comment pc
      LEFT JOIN sys_user u ON pc.user_id = u.id
      LEFT JOIN pipeline_comment rpc ON pc.reply_to_id = rpc.id
      LEFT JOIN sys_user ru ON rpc.user_id = ru.id
      WHERE pc.id = ?
    `, [id]);

    const comment = setPermissions(buildCommentWithUser(rows[0]), req.user);

    logger.info('Comment updated:', { id, user_id: req.user.id });
    res.json({ success: true, data: comment, message: '评论更新成功' });
  } catch (error) {
    logger.error('Update comment error:', { message: error.message });
    res.status(500).json({ success: false, message: '更新评论失败' });
  }
});

router.delete('/:id', roleGuard('admin', 'editor'), async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await db.query('SELECT * FROM pipeline_comment WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: '评论不存在' });
    }

    if (existing[0].user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '无权限删除此评论' });
    }

    await db.query('DELETE FROM pipeline_comment WHERE id = ?', [id]);

    logger.info('Comment deleted:', { id, user_id: req.user.id });
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    logger.error('Delete comment error:', { message: error.message });
    res.status(500).json({ success: false, message: '删除评论失败' });
  }
});

router.put('/:id/pin', roleGuard('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { is_pinned } = req.body;

    const existing = await db.query('SELECT * FROM pipeline_comment WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: '评论不存在' });
    }

    const pinned = is_pinned ? 1 : 0;
    await db.query(
      'UPDATE pipeline_comment SET is_pinned = ?, pinned_at = ?, pinned_by = ? WHERE id = ?',
      [pinned, is_pinned ? new Date() : null, is_pinned ? req.user.id : null, id]
    );

    logger.info('Comment pinned:', { id, is_pinned, user_id: req.user.id });
    res.json({ success: true, message: is_pinned ? '置顶成功' : '取消置顶成功' });
  } catch (error) {
    logger.error('Pin comment error:', { message: error.message });
    res.status(500).json({ success: false, message: '操作失败' });
  }
});

router.get('/users/mention', async (req, res) => {
  try {
    const { keyword } = req.query;
    let sql = 'SELECT id, nickname, username, role, avatar FROM sys_user WHERE status = 1';
    const params = [];
    if (keyword) {
      sql += ' AND (nickname LIKE ? OR username LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    sql += ' ORDER BY nickname LIMIT 20';
    const users = await db.query(sql, params);
    res.json({ success: true, data: users });
  } catch (error) {
    logger.error('Get mention users error:', { message: error.message });
    res.status(500).json({ success: false, message: '获取用户列表失败' });
  }
});

module.exports = router;
