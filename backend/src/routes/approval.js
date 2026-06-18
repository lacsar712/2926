const express = require('express');
const db = require('../utils/db');
const logger = require('../utils/logger');
const { roleGuard } = require('../middleware/auth');

const router = express.Router();

const typeMap = {
  pipeline_publish: '生产线发布',
  pipeline_delete: '生产线删除',
  template_online: '模板上线',
  user_role_change: '角色变更'
};

router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const { status, tab = 'todo', page = 1, pageSize = 10 } = req.query;
    let sql = 'SELECT * FROM approval_record WHERE 1=1';
    const params = [];

    if (tab === 'todo') {
      sql += ' AND approver_id = ? AND status = ?';
      params.push(userId, 'pending');
    } else if (tab === 'done') {
      sql += ' AND approver_id = ? AND status != ?';
      params.push(userId, 'pending');
    } else if (tab === 'mine') {
      sql += ' AND applicant_id = ?';
      params.push(userId);
    } else if (tab === 'all' && role === 'admin') {
    }

    if (status) { sql += ' AND status = ?'; params.push(status); }

    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
    const [countRow] = await db.query(countSql, params);
    const total = countRow.total;

    const limit = parseInt(pageSize, 10) || 10;
    const offset = ((parseInt(page, 10) || 1) - 1) * limit;
    sql += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

    const rows = await db.query(sql, params);
    rows.forEach(r => { r.typeLabel = typeMap[r.type] || r.type; });

    res.json({ success: true, data: { list: rows, total, page: parseInt(page), pageSize: parseInt(pageSize) } });
  } catch (error) {
    logger.error('Get approvals error:', { message: error.message });
    res.status(500).json({ success: false, message: '获取审批列表失败' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;
    const [todoRow] = await db.query(
      `SELECT COUNT(*) as count FROM approval_record WHERE approver_id = ? AND status = 'pending'`,
      [userId]
    );
    const [doneRow] = await db.query(
      `SELECT COUNT(*) as count FROM approval_record WHERE approver_id = ? AND status != 'pending'`,
      [userId]
    );
    const [mineRow] = await db.query(
      `SELECT COUNT(*) as count FROM approval_record WHERE applicant_id = ?`,
      [userId]
    );
    res.json({ success: true, data: { todo: todoRow.count, done: doneRow.count, mine: mineRow.count } });
  } catch (error) {
    logger.error('Approval stats error:', { message: error.message });
    res.status(500).json({ success: false, message: '获取统计失败' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const rows = await db.query('SELECT * FROM approval_record WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: '审批记录不存在' });
    const r = rows[0];
    r.typeLabel = typeMap[r.type] || r.type;
    res.json({ success: true, data: r });
  } catch (error) {
    logger.error('Get approval detail error:', { message: error.message });
    res.status(500).json({ success: false, message: '获取详情失败' });
  }
});

router.put('/:id/approve', async (req, res) => {
  try {
    const userId = req.user.id;
    const { remark = '' } = req.body;
    const rows = await db.query('SELECT * FROM approval_record WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: '审批记录不存在' });
    const record = rows[0];
    if (record.approver_id !== userId) {
      return res.status(403).json({ success: false, message: '无权审批该记录' });
    }
    if (record.status !== 'pending') {
      return res.status(400).json({ success: false, message: '该记录已处理' });
    }
    await db.query(
      `UPDATE approval_record SET status = 'approved', approve_remark = ?, approved_at = NOW(), updated_at = NOW() WHERE id = ?`,
      [remark, req.params.id]
    );
    await db.query(
      `INSERT INTO notification (user_id, type, title, summary, content, is_read, related_type, related_id) VALUES (?, ?, ?, ?, ?, 0, 'approval', ?)`,
      [record.applicant_id, 'system', `审批通过：${record.title}`, `审批人已通过您的申请`, `您提交的「${record.title}」已审核通过。`, req.params.id]
    );
    logger.info('Approval approved:', { id: req.params.id, approver: userId });
    res.json({ success: true, message: '已通过' });
  } catch (error) {
    logger.error('Approval approve error:', { message: error.message });
    res.status(500).json({ success: false, message: '审批失败' });
  }
});

router.put('/:id/reject', async (req, res) => {
  try {
    const userId = req.user.id;
    const { remark = '' } = req.body;
    const rows = await db.query('SELECT * FROM approval_record WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: '审批记录不存在' });
    const record = rows[0];
    if (record.approver_id !== userId) {
      return res.status(403).json({ success: false, message: '无权审批该记录' });
    }
    if (record.status !== 'pending') {
      return res.status(400).json({ success: false, message: '该记录已处理' });
    }
    await db.query(
      `UPDATE approval_record SET status = 'rejected', approve_remark = ?, approved_at = NOW(), updated_at = NOW() WHERE id = ?`,
      [remark, req.params.id]
    );
    await db.query(
      `INSERT INTO notification (user_id, type, title, summary, content, is_read, related_type, related_id) VALUES (?, ?, ?, ?, ?, 0, 'approval', ?)`,
      [record.applicant_id, 'system', `审批驳回：${record.title}`, `驳回原因：${remark || '未填写'}`, `您提交的「${record.title}」被驳回。原因：${remark || '未填写'}`, req.params.id]
    );
    logger.info('Approval rejected:', { id: req.params.id, approver: userId });
    res.json({ success: true, message: '已驳回' });
  } catch (error) {
    logger.error('Approval reject error:', { message: error.message });
    res.status(500).json({ success: false, message: '驳回失败' });
  }
});

router.post('/', roleGuard('admin', 'editor'), async (req, res) => {
  try {
    const { type, title, related_id, related_data, approver_id, remark } = req.body;
    if (!type || !title || !approver_id) {
      return res.status(400).json({ success: false, message: '缺少必填字段' });
    }
    const result = await db.query(
      `INSERT INTO approval_record (type, title, related_id, related_data, applicant_id, applicant_name, approver_id, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [type, title, related_id || null, related_data ? JSON.stringify(related_data) : null, req.user.id, req.user.nickname || req.user.username, approver_id, remark || '']
    );
    logger.info('Approval created:', { id: result.insertId, applicant: req.user.id });
    res.json({ success: true, data: { id: result.insertId }, message: '已提交审批' });
  } catch (error) {
    logger.error('Create approval error:', { message: error.message });
    res.status(500).json({ success: false, message: '提交审批失败' });
  }
});

module.exports = router;
