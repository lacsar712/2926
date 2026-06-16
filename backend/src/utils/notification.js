const db = require('./db');
const logger = require('./logger');

const NOTIFICATION_TYPES = {
  PUBLISH_SUCCESS: 'publish_success',
  RUN_FAILED: 'run_failed',
  SYSTEM: 'system'
};

const sendNotification = async ({
  userIds,
  type = NOTIFICATION_TYPES.SYSTEM,
  title,
  summary,
  content,
  relatedType,
  relatedId
}) => {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    logger.warn('sendNotification called with empty userIds');
    return;
  }
  if (!title) {
    logger.error('sendNotification called without title');
    return;
  }

  try {
    const values = userIds.map(userId => [
      userId, type, title, summary || '', content || '',
      relatedType || null, relatedId || null, 0
    ]);
    
    const placeholders = userIds.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, NOW())').join(', ');
    const flatParams = values.flat();
    
    const sql = `
      INSERT INTO notification 
      (user_id, type, title, summary, content, related_type, related_id, is_read, created_at)
      VALUES ${placeholders}
    `;
    
    const result = await db.query(sql, flatParams);
    
    logger.info('Notifications sent:', { 
      count: userIds.length, 
      type, 
      relatedType, 
      relatedId 
    });
    
    return result;
  } catch (error) {
    logger.error('sendNotification error:', { message: error.message, type, title });
    throw error;
  }
};

const notifyPipelinePublish = async (pipelineId, pipelineName, version, creatorId, operatorId) => {
  const userIds = new Set();
  userIds.add(creatorId);
  if (operatorId && operatorId !== creatorId) {
    userIds.add(operatorId);
  }
  
  return sendNotification({
    userIds: Array.from(userIds),
    type: NOTIFICATION_TYPES.PUBLISH_SUCCESS,
    title: `生产线「${pipelineName}」发布成功`,
    summary: `版本 v${version} 已成功发布`,
    content: `生产线「${pipelineName}」已成功发布版本 v${version}。`,
    relatedType: 'pipeline',
    relatedId: pipelineId
  });
};

const notifyPipelineRunFailed = async (pipelineId, pipelineName, runId, errorCount, userIds) => {
  return sendNotification({
    userIds: userIds,
    type: NOTIFICATION_TYPES.RUN_FAILED,
    title: `生产线「${pipelineName}」运行失败`,
    summary: `运行过程中出现 ${errorCount} 个错误，请及时处理`,
    content: `生产线「${pipelineName}」在运行过程中出现异常，共产生 ${errorCount} 个错误。请查看运行详情进行排查。`,
    relatedType: 'run',
    relatedId: runId
  });
};

const notifySystem = async (userIds, title, summary, content) => {
  return sendNotification({
    userIds,
    type: NOTIFICATION_TYPES.SYSTEM,
    title,
    summary,
    content
  });
};

const getPipelineSubscribers = async (pipelineId) => {
  try {
    const rows = await db.query(
      'SELECT creator_id FROM pipeline WHERE id = ?',
      [pipelineId]
    );
    if (rows.length === 0) return [];
    const userIds = [rows[0].creator_id];
    
    const editorRows = await db.query(
      "SELECT id FROM sys_user WHERE role IN ('admin', 'editor')"
    );
    editorRows.forEach(u => {
      if (!userIds.includes(u.id)) userIds.push(u.id);
    });
    
    return userIds;
  } catch (error) {
    logger.error('getPipelineSubscribers error:', { message: error.message });
    return [];
  }
};

module.exports = {
  NOTIFICATION_TYPES,
  sendNotification,
  notifyPipelinePublish,
  notifyPipelineRunFailed,
  notifySystem,
  getPipelineSubscribers
};
