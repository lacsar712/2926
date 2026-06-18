const express = require('express');
const db = require('../utils/db');
const logger = require('../utils/logger');

const router = express.Router();

const GROUP_CONFIG = {
  pipeline: { label: '生产线', icon: 'Operation', routePrefix: '/pipeline/flow' },
  tag: { label: '标签', icon: 'PriceTag', routePrefix: '/system/tag' },
  user: { label: '用户', icon: 'User', routePrefix: '/system/user' },
  log: { label: '操作日志', icon: 'Document', routePrefix: '/system/log' }
};

router.get('/', async (req, res) => {
  try {
    const { keyword, types, page = 1, pageSize = 5 } = req.query;
    if (!keyword || !keyword.trim()) {
      return res.json({ success: true, data: { groups: [], total: 0 } });
    }

    const kw = keyword.trim();
    const like = `%${kw}%`;
    const userRole = req.user?.role || 'viewer';
    const requestedTypes = types ? types.split(',').filter(Boolean) : Object.keys(GROUP_CONFIG);
    const allowedTypes = requestedTypes.filter((t) => {
      if ((t === 'user' || t === 'log') && userRole !== 'admin') return false;
      return GROUP_CONFIG[t];
    });

    const limit = Math.min(parseInt(pageSize), 20);
    const offset = (parseInt(page) - 1) * limit;
    const groups = [];

    for (const type of allowedTypes) {
      let rows = [];
      let total = 0;

      if (type === 'pipeline') {
        const countResult = await db.query(
          'SELECT COUNT(*) as total FROM pipeline WHERE name LIKE ? OR description LIKE ?',
          [like, like]
        );
        total = countResult[0].total;
        rows = await db.query(
          `SELECT id, name, description, status FROM pipeline WHERE name LIKE ? OR description LIKE ? ORDER BY updated_at DESC LIMIT ${limit} OFFSET ${offset}`,
          [like, like]
        );
        groups.push({
          type: 'pipeline',
          label: GROUP_CONFIG.pipeline.label,
          icon: GROUP_CONFIG.pipeline.icon,
          total,
          items: rows.map((r) => ({
            type: 'pipeline',
            id: r.id,
            title: r.name,
            subtitle: r.status,
            route: `/pipeline/flow/${r.id}`
          }))
        });
      }

      if (type === 'tag') {
        const countResult = await db.query(
          'SELECT COUNT(*) as total FROM tag WHERE name LIKE ?',
          [like]
        );
        total = countResult[0].total;
        rows = await db.query(
          `SELECT id, name, color FROM tag WHERE name LIKE ? ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
          [like]
        );
        groups.push({
          type: 'tag',
          label: GROUP_CONFIG.tag.label,
          icon: GROUP_CONFIG.tag.icon,
          total,
          items: rows.map((r) => ({
            type: 'tag',
            id: r.id,
            title: r.name,
            subtitle: r.color,
            route: '/system/tag'
          }))
        });
      }

      if (type === 'user') {
        const countResult = await db.query(
          'SELECT COUNT(*) as total FROM sys_user WHERE username LIKE ? OR nickname LIKE ?',
          [like, like]
        );
        total = countResult[0].total;
        rows = await db.query(
          `SELECT id, username, nickname, role FROM sys_user WHERE username LIKE ? OR nickname LIKE ? ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
          [like, like]
        );
        groups.push({
          type: 'user',
          label: GROUP_CONFIG.user.label,
          icon: GROUP_CONFIG.user.icon,
          total,
          items: rows.map((r) => ({
            type: 'user',
            id: r.id,
            title: r.nickname || r.username,
            subtitle: `${r.username} · ${r.role}`,
            route: '/system/user'
          }))
        });
      }

      if (type === 'log') {
        const countResult = await db.query(
          'SELECT COUNT(*) as total FROM operation_log WHERE action LIKE ? OR target LIKE ? OR detail LIKE ?',
          [like, like, like]
        );
        total = countResult[0].total;
        rows = await db.query(
          `SELECT id, action, target, detail, created_at FROM operation_log WHERE action LIKE ? OR target LIKE ? OR detail LIKE ? ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
          [like, like, like]
        );
        groups.push({
          type: 'log',
          label: GROUP_CONFIG.log.label,
          icon: GROUP_CONFIG.log.icon,
          total,
          items: rows.map((r) => ({
            type: 'log',
            id: r.id,
            title: r.action,
            subtitle: r.target,
            route: '/system/log'
          }))
        });
      }
    }

    const overallTotal = groups.reduce((sum, g) => sum + g.total, 0);
    res.json({ success: true, data: { groups, total: overallTotal, keyword: kw } });
  } catch (error) {
    logger.error('Search error:', { message: error.message });
    res.status(500).json({ success: false, message: '搜索失败' });
  }
});

module.exports = router;
