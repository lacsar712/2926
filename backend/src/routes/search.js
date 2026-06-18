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

const searchPipeline = async (like, page, pageSize) => {
  const limit = Math.min(parseInt(pageSize), 20);
  const offset = (parseInt(page) - 1) * limit;
  const countResult = await db.query(
    'SELECT COUNT(*) as total FROM pipeline WHERE name LIKE ? OR description LIKE ?',
    [like, like]
  );
  const total = countResult[0].total;
  const rows = await db.query(
    `SELECT id, name, description, status FROM pipeline WHERE name LIKE ? OR description LIKE ? ORDER BY updated_at DESC LIMIT ${limit} OFFSET ${offset}`,
    [like, like]
  );
  return {
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
  };
};

const searchTag = async (like, page, pageSize) => {
  const limit = Math.min(parseInt(pageSize), 20);
  const offset = (parseInt(page) - 1) * limit;
  const countResult = await db.query(
    'SELECT COUNT(*) as total FROM tag WHERE name LIKE ?',
    [like]
  );
  const total = countResult[0].total;
  const rows = await db.query(
    `SELECT id, name, color FROM tag WHERE name LIKE ? ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
    [like]
  );
  return {
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
  };
};

const searchUser = async (like, page, pageSize) => {
  const limit = Math.min(parseInt(pageSize), 20);
  const offset = (parseInt(page) - 1) * limit;
  const countResult = await db.query(
    'SELECT COUNT(*) as total FROM sys_user WHERE username LIKE ? OR nickname LIKE ?',
    [like, like]
  );
  const total = countResult[0].total;
  const rows = await db.query(
    `SELECT id, username, nickname, role FROM sys_user WHERE username LIKE ? OR nickname LIKE ? ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
    [like, like]
  );
  return {
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
  };
};

const searchLog = async (like, page, pageSize) => {
  const limit = Math.min(parseInt(pageSize), 20);
  const offset = (parseInt(page) - 1) * limit;
  const countResult = await db.query(
    'SELECT COUNT(*) as total FROM operation_log WHERE action LIKE ? OR target LIKE ? OR detail LIKE ?',
    [like, like, like]
  );
  const total = countResult[0].total;
  const rows = await db.query(
    `SELECT id, action, target, detail, created_at FROM operation_log WHERE action LIKE ? OR target LIKE ? OR detail LIKE ? ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
    [like, like, like]
  );
  return {
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
  };
};

const searchHandlers = {
  pipeline: searchPipeline,
  tag: searchTag,
  user: searchUser,
  log: searchLog
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

    const groups = [];
    for (const type of allowedTypes) {
      const handler = searchHandlers[type];
      if (handler) {
        const group = await handler(like, page, pageSize);
        if (group.total > 0) {
          groups.push(group);
        }
      }
    }

    const overallTotal = groups.reduce((sum, g) => sum + g.total, 0);
    res.json({ success: true, data: { groups, total: overallTotal, keyword: kw } });
  } catch (error) {
    logger.error('Search error:', { message: error.message });
    res.status(500).json({ success: false, message: '搜索失败' });
  }
});

router.get('/more', async (req, res) => {
  try {
    const { keyword, type, page = 2, pageSize = 5 } = req.query;
    if (!keyword || !keyword.trim() || !type) {
      return res.json({ success: false, message: '参数错误' });
    }

    const kw = keyword.trim();
    const like = `%${kw}%`;
    const userRole = req.user?.role || 'viewer';
    if ((type === 'user' || type === 'log') && userRole !== 'admin') {
      return res.json({ success: false, message: '权限不足' });
    }
    if (!GROUP_CONFIG[type]) {
      return res.json({ success: false, message: '无效的类型' });
    }

    const handler = searchHandlers[type];
    const group = await handler(like, page, pageSize);
    res.json({ success: true, data: group });
  } catch (error) {
    logger.error('Search more error:', { message: error.message });
    res.status(500).json({ success: false, message: '加载更多失败' });
  }
});

module.exports = router;
