SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- 用户表
CREATE TABLE IF NOT EXISTS `sys_user` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `nickname` VARCHAR(50) NOT NULL,
  `email` VARCHAR(100),
  `phone` VARCHAR(20),
  `avatar` VARCHAR(255),
  `role` ENUM('admin','editor','viewer') DEFAULT 'viewer',
  `status` TINYINT DEFAULT 1 COMMENT '1启用 0禁用',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 标签表
CREATE TABLE IF NOT EXISTS `tag` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `name` VARCHAR(50) NOT NULL UNIQUE,
  `color` VARCHAR(20) DEFAULT '#409EFF',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 生产线表
CREATE TABLE IF NOT EXISTS `pipeline` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT,
  `status` ENUM('draft','published','running','stopped','error') DEFAULT 'draft',
  `version` INT DEFAULT 1,
  `creator_id` INT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`creator_id`) REFERENCES `sys_user`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 生产线标签关联表
CREATE TABLE IF NOT EXISTS `pipeline_tag` (
  `pipeline_id` INT NOT NULL,
  `tag_id` INT NOT NULL,
  PRIMARY KEY (`pipeline_id`, `tag_id`),
  FOREIGN KEY (`pipeline_id`) REFERENCES `pipeline`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`tag_id`) REFERENCES `tag`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 生产线编排数据表（存储画布JSON）
CREATE TABLE IF NOT EXISTS `pipeline_flow` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `pipeline_id` INT NOT NULL UNIQUE,
  `flow_data` JSON COMMENT '画布节点和连线数据',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`pipeline_id`) REFERENCES `pipeline`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 生产线发布历史表
CREATE TABLE IF NOT EXISTS `pipeline_history` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `pipeline_id` INT NOT NULL,
  `version` INT NOT NULL,
  `flow_data` JSON,
  `operator` VARCHAR(50),
  `action` VARCHAR(20) COMMENT 'publish/rollback',
  `remark` TEXT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`pipeline_id`) REFERENCES `pipeline`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 生产线运行记录表
CREATE TABLE IF NOT EXISTS `pipeline_run` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `pipeline_id` INT NOT NULL,
  `status` ENUM('running','completed','failed','cancelled') DEFAULT 'running',
  `start_time` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `end_time` DATETIME,
  `total_input` INT DEFAULT 0,
  `total_output` INT DEFAULT 0,
  `error_count` INT DEFAULT 0,
  FOREIGN KEY (`pipeline_id`) REFERENCES `pipeline`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 节点运行详情表
CREATE TABLE IF NOT EXISTS `node_run_detail` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `run_id` INT NOT NULL,
  `node_id` VARCHAR(100) NOT NULL,
  `node_name` VARCHAR(100),
  `node_type` VARCHAR(50),
  `status` ENUM('pending','running','completed','failed') DEFAULT 'pending',
  `input_count` INT DEFAULT 0,
  `output_count` INT DEFAULT 0,
  `error_count` INT DEFAULT 0,
  `start_time` DATETIME,
  `end_time` DATETIME,
  `input_sample` JSON COMMENT '输入数据样例',
  `output_sample` JSON COMMENT '输出数据样例',
  FOREIGN KEY (`run_id`) REFERENCES `pipeline_run`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 操作日志表
CREATE TABLE IF NOT EXISTS `operation_log` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT,
  `username` VARCHAR(50),
  `action` VARCHAR(50),
  `target` VARCHAR(100),
  `detail` TEXT,
  `ip` VARCHAR(50),
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 模板表
CREATE TABLE IF NOT EXISTS `template` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL COMMENT '模板名称',
  `description` TEXT COMMENT '模板描述',
  `category` VARCHAR(50) COMMENT '分类标签',
  `flow_data` JSON COMMENT '模板编排数据',
  `node_count` INT DEFAULT 0 COMMENT '节点数量',
  `status` ENUM('online','offline') DEFAULT 'offline' COMMENT 'online上架 offline下架',
  `creator_id` INT COMMENT '创建者ID',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`creator_id`) REFERENCES `sys_user`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 通知表
CREATE TABLE IF NOT EXISTS `notification` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT NOT NULL COMMENT '接收用户ID',
  `type` ENUM('publish_success','run_failed','system') DEFAULT 'system' COMMENT '通知类型',
  `title` VARCHAR(200) NOT NULL COMMENT '通知标题',
  `summary` VARCHAR(500) COMMENT '通知摘要',
  `content` TEXT COMMENT '通知详情',
  `is_read` TINYINT DEFAULT 0 COMMENT '0未读 1已读',
  `related_type` VARCHAR(50) COMMENT '关联类型: pipeline/run等',
  `related_id` INT COMMENT '关联ID',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `read_at` DATETIME,
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_user_read` (`user_id`, `is_read`),
  FOREIGN KEY (`user_id`) REFERENCES `sys_user`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 用户偏好设置表
CREATE TABLE IF NOT EXISTS `user_preference` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT NOT NULL UNIQUE COMMENT '用户ID',
  `theme` ENUM('light','dark','system') DEFAULT 'dark' COMMENT '主题偏好',
  `page_size` INT DEFAULT 10 COMMENT '列表默认分页大小',
  `auto_save` TINYINT DEFAULT 1 COMMENT '编排自动保存开关 1开启 0关闭',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `sys_user`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============ 种子数据 ============

-- 模板数据
INSERT INTO `template` (`name`, `description`, `category`, `flow_data`, `node_count`, `status`, `creator_id`) VALUES
('文本清洗入库', '对原始文本数据进行清洗、去重、归一化处理后存入数据库，适用于数据预处理场景', '数据处理',
 '{"nodes":[{"id":"node-1","type":"custom","position":{"x":80,"y":200},"data":{"category":"data-access","component":"file-reader","label":"文件读取","config":{}}},{"id":"node-2","type":"custom","position":{"x":350,"y":120},"data":{"category":"data-preprocess","component":"data-cleaner","label":"数据清洗","config":{"removeNull":true,"removeDuplicate":true}}},{"id":"node-3","type":"custom","position":{"x":350,"y":280},"data":{"category":"data-preprocess","component":"text-normalizer","label":"文本归一化","config":{}}},{"id":"node-4","type":"custom","position":{"x":620,"y":200},"data":{"category":"data-access","component":"database-writer","label":"数据入库","config":{}}}],"edges":[{"id":"e1-2","source":"node-1","target":"node-2","animated":true},{"id":"e1-3","source":"node-1","target":"node-3","animated":true},{"id":"e2-4","source":"node-2","target":"node-4","animated":true},{"id":"e3-4","source":"node-3","target":"node-4","animated":true}]}',
 4, 'online', 1),
('实体关系抽取', '从文本中自动识别命名实体并抽取实体间的语义关系，支持多种实体类型和关系类型', '知识抽取',
 '{"nodes":[{"id":"node-1","type":"custom","position":{"x":80,"y":200},"data":{"category":"data-access","component":"text-reader","label":"文本读取","config":{}}},{"id":"node-2","type":"custom","position":{"x":350,"y":200},"data":{"category":"data-preprocess","component":"text-splitter","label":"文本分段","config":{}}},{"id":"node-3","type":"custom","position":{"x":620,"y":120},"data":{"category":"entity-extract","component":"ner-model","label":"实体识别","config":{}}},{"id":"node-4","type":"custom","position":{"x":620,"y":280},"data":{"category":"relation-build","component":"relation-extractor","label":"关系抽取","config":{}}},{"id":"node-5","type":"custom","position":{"x":890,"y":200},"data":{"category":"data-browse","component":"result-viewer","label":"结果展示","config":{}}}],"edges":[{"id":"e1-2","source":"node-1","target":"node-2","animated":true},{"id":"e2-3","source":"node-2","target":"node-3","animated":true},{"id":"e2-4","source":"node-2","target":"node-4","animated":true},{"id":"e3-5","source":"node-3","target":"node-5","animated":true},{"id":"e4-5","source":"node-4","target":"node-5","animated":true}]}',
 5, 'online', 1),
('知识图谱构建', '从多源异构数据中抽取实体和关系，构建领域知识图谱并存储到图数据库', '知识图谱',
 '{"nodes":[{"id":"node-1","type":"custom","position":{"x":80,"y":200},"data":{"category":"data-access","component":"database-reader","label":"数据源读取","config":{}}},{"id":"node-2","type":"custom","position":{"x":350,"y":120},"data":{"category":"data-preprocess","component":"data-cleaner","label":"数据清洗","config":{}}},{"id":"node-3","type":"custom","position":{"x":350,"y":280},"data":{"category":"data-preprocess","component":"text-normalizer","label":"文本归一化","config":{}}},{"id":"node-4","type":"custom","position":{"x":620,"y":120},"data":{"category":"entity-extract","component":"ner-model","label":"实体识别","config":{}}},{"id":"node-5","type":"custom","position":{"x":620,"y":280},"data":{"category":"relation-build","component":"relation-extractor","label":"关系抽取","config":{}}},{"id":"node-6","type":"custom","position":{"x":890,"y":200},"data":{"category":"knowledge-production","component":"kg-builder","label":"图谱构建","config":{}}},{"id":"node-7","type":"custom","position":{"x":1160,"y":200},"data":{"category":"data-browse","component":"graph-viewer","label":"图谱浏览","config":{}}}],"edges":[{"id":"e1-2","source":"node-1","target":"node-2","animated":true},{"id":"e1-3","source":"node-1","target":"node-3","animated":true},{"id":"e2-4","source":"node-2","target":"node-4","animated":true},{"id":"e3-5","source":"node-3","target":"node-5","animated":true},{"id":"e4-6","source":"node-4","target":"node-6","animated":true},{"id":"e5-6","source":"node-5","target":"node-6","animated":true},{"id":"e6-7","source":"node-6","target":"node-7","animated":true}]}',
 7, 'online', 1),
('情感分析流水线', '对文本数据进行情感倾向分析，支持正面、负面、中性三分类，可批量处理', '文本分析',
 '{"nodes":[{"id":"node-1","type":"custom","position":{"x":80,"y":200},"data":{"category":"data-access","component":"file-reader","label":"数据导入","config":{}}},{"id":"node-2","type":"custom","position":{"x":350,"y":200},"data":{"category":"data-preprocess","component":"text-cleaner","label":"文本清洗","config":{}}},{"id":"node-3","type":"custom","position":{"x":620,"y":200},"data":{"category":"model-labeling","component":"sentiment-model","label":"情感分析","config":{}}},{"id":"node-4","type":"custom","position":{"x":890,"y":200},"data":{"category":"data-browse","component":"data-dashboard","label":"分析看板","config":{}}}],"edges":[{"id":"e1-2","source":"node-1","target":"node-2","animated":true},{"id":"e2-3","source":"node-2","target":"node-3","animated":true},{"id":"e3-4","source":"node-3","target":"node-4","animated":true}]}',
 4, 'online', 1),
('数据脱敏处理', '对敏感数据进行脱敏处理，支持手机号、身份证、地址等多种敏感信息类型', '数据处理',
 '{"nodes":[{"id":"node-1","type":"custom","position":{"x":80,"y":200},"data":{"category":"data-access","component":"database-reader","label":"数据读取","config":{}}},{"id":"node-2","type":"custom","position":{"x":350,"y":200},"data":{"category":"data-preprocess","component":"data-masker","label":"数据脱敏","config":{}}},{"id":"node-3","type":"custom","position":{"x":620,"y":200},"data":{"category":"data-access","component":"database-writer","label":"结果输出","config":{}}}],"edges":[{"id":"e1-2","source":"node-1","target":"node-2","animated":true},{"id":"e2-3","source":"node-2","target":"node-3","animated":true}]}',
 3, 'online', 1),
('文档智能分类', '基于机器学习模型对文档进行自动分类，支持自定义分类体系和批量处理', '文本分析',
 '{"nodes":[{"id":"node-1","type":"custom","position":{"x":80,"y":200},"data":{"category":"data-access","component":"file-reader","label":"文档读取","config":{}}},{"id":"node-2","type":"custom","position":{"x":350,"y":120},"data":{"category":"data-preprocess","component":"text-extractor","label":"文本提取","config":{}}},{"id":"node-3","type":"custom","position":{"x":350,"y":280},"data":{"category":"data-preprocess","component":"feature-extractor","label":"特征提取","config":{}}},{"id":"node-4","type":"custom","position":{"x":620,"y":200},"data":{"category":"model-labeling","component":"text-classifier","label":"文本分类","config":{}}},{"id":"node-5","type":"custom","position":{"x":890,"y":200},"data":{"category":"data-browse","component":"result-viewer","label":"分类结果","config":{}}}],"edges":[{"id":"e1-2","source":"node-1","target":"node-2","animated":true},{"id":"e1-3","source":"node-1","target":"node-3","animated":true},{"id":"e2-4","source":"node-2","target":"node-4","animated":true},{"id":"e3-4","source":"node-3","target":"node-4","animated":true},{"id":"e4-5","source":"node-4","target":"node-5","animated":true}]}',
 5, 'offline', 1);

-- 用户（密码均为 123456 的 bcrypt 哈希）
INSERT INTO `sys_user` (`username`, `password`, `nickname`, `email`, `phone`, `role`, `status`) VALUES
('admin', '$2a$10$V7zTEvGyQpcpykMmLuIds.SDpxvYpFhVnbTCrK8z2VuLcoX7WSPOq', '系统管理员', 'admin@pipeline.com', '13800138000', 'admin', 1),
('zhangsan', '$2a$10$V7zTEvGyQpcpykMmLuIds.SDpxvYpFhVnbTCrK8z2VuLcoX7WSPOq', '张三', 'zhangsan@pipeline.com', '13800138001', 'editor', 1),
('lisi', '$2a$10$V7zTEvGyQpcpykMmLuIds.SDpxvYpFhVnbTCrK8z2VuLcoX7WSPOq', '李四', 'lisi@pipeline.com', '13800138002', 'viewer', 1);

-- 标签
INSERT INTO `tag` (`name`, `color`) VALUES
('知识图谱', '#409EFF'),
('数据清洗', '#67C23A'),
('实体识别', '#E6A23C'),
('关系抽取', '#F56C6C'),
('文本处理', '#909399'),
('生产环境', '#ff6b6b'),
('测试环境', '#51cf66');

-- 生产线
INSERT INTO `pipeline` (`name`, `description`, `status`, `version`, `creator_id`) VALUES
('企业知识图谱构建', '从多源数据中抽取实体和关系，构建企业级知识图谱', 'published', 3, 1),
('医疗文献分析流水线', '对医学文献进行结构化处理和知识抽取', 'running', 2, 2),
('金融舆情监控', '实时采集金融新闻并进行情感分析与实体关联', 'published', 1, 1),
('电商评论分析', '用户评论的情感分析和产品特征抽取', 'draft', 1, 2),
('法律文书结构化', '法律文书的自动解析、实体抽取和关系构建', 'stopped', 2, 1);

-- 生产线标签关联
INSERT INTO `pipeline_tag` (`pipeline_id`, `tag_id`) VALUES
(1, 1), (1, 3), (1, 4),
(2, 1), (2, 5),
(3, 3), (3, 6),
(4, 2), (4, 5), (4, 7),
(5, 1), (5, 4), (5, 6);

-- 生产线编排数据
INSERT INTO `pipeline_flow` (`pipeline_id`, `flow_data`) VALUES
(1, '{"nodes":[{"id":"node-1","type":"custom","position":{"x":80,"y":200},"data":{"category":"data-access","component":"database-reader","label":"MySQL数据读取","config":{"host":"10.0.1.100","port":3306,"database":"enterprise_data","table":"company_info"}}},{"id":"node-2","type":"custom","position":{"x":350,"y":120},"data":{"category":"data-preprocess","component":"data-cleaner","label":"数据清洗","config":{"removeNull":true,"removeDuplicate":true,"trimWhitespace":true}}},{"id":"node-3","type":"custom","position":{"x":350,"y":300},"data":{"category":"data-preprocess","component":"text-normalizer","label":"文本归一化","config":{"lowercase":false,"removeSpecialChars":true,"encoding":"utf-8"}}},{"id":"node-4","type":"custom","position":{"x":620,"y":200},"data":{"category":"model-labeling","component":"ner-model","label":"NER实体识别","config":{"model":"bert-base-chinese","entityTypes":["PER","ORG","LOC","TIME"],"confidence":0.85}}},{"id":"node-5","type":"custom","position":{"x":890,"y":200},"data":{"category":"relation-build","component":"relation-extractor","label":"关系抽取","config":{"model":"re-bert-chinese","relationTypes":["任职","投资","合作","收购"],"threshold":0.8}}},{"id":"node-6","type":"custom","position":{"x":1160,"y":200},"data":{"category":"knowledge-production","component":"kg-builder","label":"知识图谱构建","config":{"graphDB":"neo4j","host":"10.0.1.200","port":7687}}},{"id":"node-7","type":"custom","position":{"x":1430,"y":200},"data":{"category":"data-browse","component":"graph-viewer","label":"图谱浏览器","config":{"maxNodes":500,"layout":"force"}}}],"edges":[{"id":"e1-2","source":"node-1","target":"node-2","animated":true},{"id":"e1-3","source":"node-1","target":"node-3","animated":true},{"id":"e2-4","source":"node-2","target":"node-4","animated":true},{"id":"e3-4","source":"node-3","target":"node-4","animated":true},{"id":"e4-5","source":"node-4","target":"node-5","animated":true},{"id":"e5-6","source":"node-5","target":"node-6","animated":true},{"id":"e6-7","source":"node-6","target":"node-7","animated":true}]}'),
(2, '{"nodes":[{"id":"node-1","type":"custom","position":{"x":80,"y":200},"data":{"category":"data-access","component":"file-reader","label":"文献PDF读取","config":{"path":"/data/medical/papers","format":"pdf","batchSize":100}}},{"id":"node-2","type":"custom","position":{"x":350,"y":200},"data":{"category":"data-preprocess","component":"text-splitter","label":"文本分段","config":{"method":"paragraph","maxLength":512,"overlap":50}}},{"id":"node-3","type":"custom","position":{"x":620,"y":200},"data":{"category":"entity-extract","component":"medical-ner","label":"医学实体识别","config":{"model":"biobert-ner","entityTypes":["疾病","药物","症状","治疗方案"],"confidence":0.9}}},{"id":"node-4","type":"custom","position":{"x":890,"y":200},"data":{"category":"relation-build","component":"relation-extractor","label":"医学关系抽取","config":{"model":"biobert-re","relationTypes":["治疗","副作用","适应症","禁忌"],"threshold":0.85}}},{"id":"node-5","type":"custom","position":{"x":1160,"y":200},"data":{"category":"knowledge-production","component":"kg-writer","label":"知识库写入","config":{"target":"elasticsearch","index":"medical_kg"}}}],"edges":[{"id":"e1-2","source":"node-1","target":"node-2","animated":true},{"id":"e2-3","source":"node-2","target":"node-3","animated":true},{"id":"e3-4","source":"node-3","target":"node-4","animated":true},{"id":"e4-5","source":"node-4","target":"node-5","animated":true}]}'),
(3, '{"nodes":[{"id":"node-1","type":"custom","position":{"x":80,"y":200},"data":{"category":"data-access","component":"api-connector","label":"新闻API采集","config":{"url":"https://api.finance.com/news","interval":"5m","format":"json"}}},{"id":"node-2","type":"custom","position":{"x":350,"y":200},"data":{"category":"data-preprocess","component":"data-cleaner","label":"数据去重清洗","config":{"removeDuplicate":true,"deduplicateField":"title","timeWindow":"24h"}}},{"id":"node-3","type":"custom","position":{"x":620,"y":200},"data":{"category":"model-labeling","component":"sentiment-model","label":"情感分析","config":{"model":"finbert-sentiment","labels":["positive","negative","neutral"]}}},{"id":"node-4","type":"custom","position":{"x":890,"y":200},"data":{"category":"entity-extract","component":"finance-ner","label":"金融实体识别","config":{"entityTypes":["公司","股票","行业","人物"]}}},{"id":"node-5","type":"custom","position":{"x":1160,"y":200},"data":{"category":"data-browse","component":"data-dashboard","label":"监控看板","config":{"refreshInterval":30,"chartTypes":["line","bar","pie"]}}}],"edges":[{"id":"e1-2","source":"node-1","target":"node-2","animated":true},{"id":"e2-3","source":"node-2","target":"node-3","animated":true},{"id":"e2-4","source":"node-2","target":"node-4","animated":true},{"id":"e3-5","source":"node-3","target":"node-5","animated":true},{"id":"e4-5","source":"node-4","target":"node-5","animated":true}]}');

-- 运行记录
INSERT INTO `pipeline_run` (`pipeline_id`, `status`, `start_time`, `end_time`, `total_input`, `total_output`, `error_count`) VALUES
(1, 'completed', '2024-12-10 08:00:00', '2024-12-10 10:35:00', 15000, 12800, 23),
(1, 'completed', '2024-12-15 09:00:00', '2024-12-15 11:20:00', 18000, 16200, 15),
(2, 'running', '2024-12-20 14:00:00', NULL, 8500, 6200, 8),
(3, 'completed', '2024-12-18 06:00:00', '2024-12-18 06:45:00', 3200, 3100, 5),
(1, 'completed', '2024-12-20 08:00:00', '2024-12-20 10:10:00', 20000, 18500, 10);

-- 节点运行详情
INSERT INTO `node_run_detail` (`run_id`, `node_id`, `node_name`, `node_type`, `status`, `input_count`, `output_count`, `error_count`, `start_time`, `end_time`, `input_sample`, `output_sample`) VALUES
(5, 'node-1', 'MySQL数据读取', 'database-reader', 'completed', 20000, 20000, 0, '2024-12-20 08:00:00', '2024-12-20 08:15:00', '[{"id":1,"company":"华为技术有限公司","industry":"通信设备","location":"深圳市"},{"id":2,"company":"阿里巴巴集团","industry":"互联网","location":"杭州市"}]', '[{"id":1,"company":"华为技术有限公司","industry":"通信设备","location":"深圳市","raw_text":"华为技术有限公司是一家民营通信科技公司..."}]'),
(5, 'node-2', '数据清洗', 'data-cleaner', 'completed', 20000, 18800, 0, '2024-12-20 08:15:00', '2024-12-20 08:35:00', '[{"raw":"  华为技术有限公司  ","has_null":false}]', '[{"clean":"华为技术有限公司","trimmed":true,"valid":true}]'),
(5, 'node-3', '文本归一化', 'text-normalizer', 'completed', 20000, 19500, 0, '2024-12-20 08:15:00', '2024-12-20 08:40:00', '[{"text":"华为（HUAWEI）技术有限公司..."}]', '[{"text":"华为技术有限公司","normalized":true}]'),
(5, 'node-4', 'NER实体识别', 'ner-model', 'completed', 19000, 18900, 5, '2024-12-20 08:40:00', '2024-12-20 09:20:00', '[{"text":"任正非于1987年创立华为技术有限公司，总部位于深圳市龙岗区"}]', '[{"entities":[{"text":"任正非","type":"PER","start":0,"end":3},{"text":"华为技术有限公司","type":"ORG","start":11,"end":19},{"text":"深圳市龙岗区","type":"LOC","start":25,"end":31}]}]'),
(5, 'node-5', '关系抽取', 'relation-extractor', 'completed', 18900, 18700, 3, '2024-12-20 09:20:00', '2024-12-20 09:50:00', '[{"text":"任正非于1987年创立华为技术有限公司","entities":["任正非","华为技术有限公司"]}]', '[{"subject":"任正非","predicate":"创立","object":"华为技术有限公司","confidence":0.96}]'),
(5, 'node-6', '知识图谱构建', 'kg-builder', 'completed', 18700, 18500, 2, '2024-12-20 09:50:00', '2024-12-20 10:05:00', '[{"entity1":"任正非","relation":"创立","entity2":"华为技术有限公司"}]', '[{"node_count":8520,"edge_count":15230,"status":"inserted"}]'),
(5, 'node-7', '图谱浏览器', 'graph-viewer', 'completed', 18500, 18500, 0, '2024-12-20 10:05:00', '2024-12-20 10:10:00', '[{"query":"MATCH (n) RETURN n LIMIT 500"}]', '[{"displayed_nodes":500,"displayed_edges":1200,"layout":"force-directed"}]');

-- 操作日志
INSERT INTO `operation_log` (`user_id`, `username`, `action`, `target`, `detail`, `ip`) VALUES
(1, 'admin', '登录系统', '用户认证', '管理员登录成功', '192.168.1.100'),
(1, 'admin', '创建生产线', '企业知识图谱构建', '创建新的数据生产线', '192.168.1.100'),
(2, 'zhangsan', '编辑生产线', '医疗文献分析流水线', '更新编排配置', '192.168.1.101'),
(1, 'admin', '发布生产线', '企业知识图谱构建', '发布版本v3', '192.168.1.100'),
(2, 'zhangsan', '启动运行', '医疗文献分析流水线', '手动触发运行', '192.168.1.101'),
(1, 'admin', '创建标签', '知识图谱', '新增标签分类', '192.168.1.100'),
(3, 'lisi', '查看监控', '金融舆情监控', '查看运行监控数据', '192.168.1.102');

-- 数据质量规则表
CREATE TABLE IF NOT EXISTS `quality_rule` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL COMMENT '规则名称',
  `description` TEXT COMMENT '规则描述',
  `rule_type` ENUM('not_null','regex','numeric_range','enum') NOT NULL COMMENT '规则类型: not_null非空/regex正则/numeric_range数值范围/enum枚举',
  `expression` TEXT COMMENT '规则表达式(正则/范围/枚举值)',
  `severity` ENUM('error','warning') NOT NULL DEFAULT 'warning' COMMENT '严重级别',
  `enabled` TINYINT DEFAULT 1 COMMENT '1启用 0禁用',
  `creator_id` INT COMMENT '创建者ID',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`creator_id`) REFERENCES `sys_user`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 示例通知数据
INSERT INTO `notification` (`user_id`, `type`, `title`, `summary`, `content`, `is_read`, `related_type`, `related_id`, `created_at`) VALUES
(1, 'publish_success', '生产线「企业知识图谱构建」发布成功', '版本 v3 已成功发布', '生产线「企业知识图谱构建」已成功发布版本 v3。', 0, 'pipeline', 1, DATE_SUB(NOW(), INTERVAL 5 MINUTE)),
(1, 'run_failed', '生产线「金融舆情监控」运行失败', '运行过程中出现 5 个错误，请及时处理', '生产线「金融舆情监控」在运行过程中出现异常，共产生 5 个错误。请查看运行详情进行排查。', 0, 'run', 4, DATE_SUB(NOW(), INTERVAL 30 MINUTE)),
(1, 'system', '系统维护通知', '将于本周五 22:00-24:00 进行系统维护', '为提升系统性能，将于本周五 22:00-24:00 进行系统升级维护，期间服务可能短暂中断。', 0, NULL, NULL, DATE_SUB(NOW(), INTERVAL 2 HOUR)),
(2, 'publish_success', '生产线「医疗文献分析流水线」发布成功', '版本 v2 已成功发布', '生产线「医疗文献分析流水线」已成功发布版本 v2。', 0, 'pipeline', 2, DATE_SUB(NOW(), INTERVAL 1 HOUR)),
(2, 'run_failed', '生产线「医疗文献分析流水线」运行失败', '运行过程中出现 8 个错误，请及时处理', '生产线「医疗文献分析流水线」在运行过程中出现异常，共产生 8 个错误。请查看运行详情进行排查。', 1, 'run', 3, DATE_SUB(NOW(), INTERVAL 3 HOUR)),
(1, 'publish_success', '生产线「金融舆情监控」发布成功', '版本 v1 已成功发布', '生产线「金融舆情监控」已成功发布版本 v1。', 1, 'pipeline', 3, DATE_SUB(NOW(), INTERVAL 1 DAY)),
(2, 'system', '欢迎使用数据生产线平台', '您已成功注册账号，开始使用吧！', '欢迎使用数据生产线可视化平台。您可以创建和编排数据生产线，实现数据的自动化处理。', 1, NULL, NULL, DATE_SUB(NOW(), INTERVAL 3 DAY)),
(3, 'system', '欢迎使用数据生产线平台', '您已成功注册账号，开始使用吧！', '欢迎使用数据生产线可视化平台。您可以查看和监控生产线的运行状态。', 1, NULL, NULL, DATE_SUB(NOW(), INTERVAL 5 DAY));

-- 数据质量规则种子数据
INSERT INTO `quality_rule` (`name`, `description`, `rule_type`, `expression`, `severity`, `enabled`, `creator_id`) VALUES
('字段非空校验', '关键字段不允许为空', 'not_null', NULL, 'error', 1, 1),
('手机号格式校验', '校验中国大陆手机号格式', 'regex', '^1[3-9]\\d{9}$', 'error', 1, 1),
('邮箱格式校验', '校验标准邮箱格式', 'regex', '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$', 'warning', 1, 1),
('年龄范围校验', '年龄必须在 0-150 之间', 'numeric_range', '{"min":0,"max":150}', 'warning', 1, 1),
('性别枚举校验', '性别只允许为 男/女/未知', 'enum', '["男","女","未知"]', 'error', 1, 1),
('身份证号格式校验', '校验18位身份证号格式', 'regex', '^[1-9]\\d{5}(18|19|20)\\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\\d|3[01])\\d{3}[\\dXx]$', 'error', 1, 1),
('金额范围校验', '单笔金额必须大于0且不超过100万', 'numeric_range', '{"min":0,"max":1000000}', 'warning', 0, 1);

-- 调度任务表
CREATE TABLE IF NOT EXISTS `schedule_task` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL COMMENT '任务名称',
  `pipeline_id` INT NOT NULL COMMENT '关联生产线ID',
  `environment` ENUM('dev','test','prod') DEFAULT 'test' COMMENT '运行环境',
  `cron_expression` VARCHAR(50) NOT NULL COMMENT 'cron表达式',
  `enabled` TINYINT DEFAULT 1 COMMENT '1启用 0禁用',
  `retry_count` INT DEFAULT 0 COMMENT '失败重试次数',
  `timeout_minutes` INT DEFAULT 60 COMMENT '超时分钟数',
  `last_run_time` DATETIME COMMENT '上次触发时间',
  `next_run_time` DATETIME COMMENT '下次触发时间',
  `last_run_result` ENUM('success','failed','running','none') DEFAULT 'none' COMMENT '最近运行结果',
  `created_by` INT COMMENT '创建者ID',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`pipeline_id`) REFERENCES `pipeline`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`created_by`) REFERENCES `sys_user`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 任务执行历史表
CREATE TABLE IF NOT EXISTS `schedule_task_history` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `task_id` INT NOT NULL COMMENT '任务ID',
  `trigger_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '触发时间',
  `run_id` INT COMMENT '关联的pipeline_run ID',
  `status` ENUM('pending','running','success','failed','timeout') DEFAULT 'pending' COMMENT '执行状态',
  `error_message` TEXT COMMENT '错误信息',
  `retry_attempt` INT DEFAULT 0 COMMENT '重试次数',
  `duration_seconds` INT COMMENT '执行耗时(秒)',
  FOREIGN KEY (`task_id`) REFERENCES `schedule_task`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`run_id`) REFERENCES `pipeline_run`(`id`) ON DELETE SET NULL,
  INDEX `idx_task_id` (`task_id`),
  INDEX `idx_trigger_time` (`trigger_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 调度任务种子数据
INSERT INTO `schedule_task` (`name`, `pipeline_id`, `environment`, `cron_expression`, `enabled`, `retry_count`, `timeout_minutes`, `created_by`) VALUES
('每日知识图谱构建', 1, 'prod', '0 0 2 * * ?', 1, 2, 120, 1),
('每小时医疗文献分析', 2, 'test', '0 0 * * * ?', 1, 1, 60, 2),
('每日金融舆情监控', 3, 'prod', '0 0 6 * * ?', 1, 0, 30, 1),
('每周电商评论分析', 4, 'dev', '0 0 8 ? * MON', 0, 1, 90, 2);

-- 组件文档表
CREATE TABLE IF NOT EXISTS `component_doc` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `component_type` VARCHAR(100) NOT NULL COMMENT '组件类型标识',
  `category` VARCHAR(50) NOT NULL COMMENT '所属分类: data-access/data-preprocess/model-labeling/entity-extract/relation-build/knowledge-production/data-browse',
  `name` VARCHAR(100) NOT NULL COMMENT '组件名称',
  `description` TEXT COMMENT '用途说明',
  `config_fields` JSON COMMENT 'config字段详解',
  `input_schema` JSON COMMENT '输入Schema',
  `output_schema` JSON COMMENT '输出Schema',
  `config_example` JSON COMMENT '配置示例',
  `faq` JSON COMMENT '常见问题',
  `version` INT DEFAULT 1 COMMENT '文档版本号',
  `updated_by` INT COMMENT '最后更新者ID',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_component_type` (`component_type`),
  INDEX `idx_category` (`category`),
  FOREIGN KEY (`updated_by`) REFERENCES `sys_user`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 组件文档种子数据
INSERT INTO `component_doc` (`component_type`, `category`, `name`, `description`, `config_fields`, `input_schema`, `output_schema`, `config_example`, `faq`, `version`) VALUES
('database-reader', 'data-access', 'MySQL数据读取', '从MySQL数据库中读取数据，支持自定义SQL查询和表扫描两种模式，适用于关系型数据源接入场景。可配置连接池参数、读取批次和超时策略。', 
 '[{"field":"host","type":"string","required":true,"default":"10.0.1.100","description":"MySQL服务器地址"},{"field":"port","type":"number","required":true,"default":3306,"description":"MySQL服务端口"},{"field":"database","type":"string","required":true,"default":"data_source","description":"目标数据库名称"},{"field":"table","type":"string","required":true,"default":"raw_data","description":"要读取的数据表名"}]',
 '{"type":"object","properties":{"connection":{"type":"object","description":"数据库连接参数"},"query":{"type":"string","description":"可选的自定义SQL查询语句"}}}',
 '{"type":"object","properties":{"rows":{"type":"array","description":"查询结果行数据"},"total":{"type":"number","description":"总记录数"},"columns":{"type":"array","description":"列元信息"}}}',
 '{"host":"10.0.1.100","port":3306,"database":"data_source","table":"raw_data"}',
 '[{"q":"连接超时怎么处理？","a":"建议增大连接池超时参数，或检查网络连通性和数据库负载。"},{"q":"是否支持分页读取？","a":"支持，默认使用流式读取，内存占用可控。"}]',
 1),
('api-connector', 'data-access', 'API数据采集', '通过HTTP请求采集外部API数据，支持GET/POST方法，可配置请求间隔、重试策略和数据格式。适用于RESTful API、GraphQL等外部数据源接入。', 
 '[{"field":"url","type":"string","required":true,"default":"https://api.example.com/data","description":"API请求地址"},{"field":"method","type":"string","required":false,"default":"GET","description":"请求方法 GET/POST"},{"field":"interval","type":"string","required":false,"default":"5m","description":"采集间隔"},{"field":"format","type":"string","required":false,"default":"json","description":"响应数据格式"}]',
 '{"type":"object","properties":{"url":{"type":"string"},"method":{"type":"string"},"headers":{"type":"object"}}}',
 '{"type":"object","properties":{"status":{"type":"number"},"data":{"type":"array","description":"API返回数据"},"timestamp":{"type":"string"}}}',
 '{"url":"https://api.example.com/data","method":"GET","interval":"5m","format":"json"}',
 '[{"q":"API需要鉴权怎么办？","a":"在headers中配置Authorization字段，支持Bearer Token和Basic Auth。"},{"q":"请求频率过高被限流？","a":"增大interval间隔或启用重试策略。"}]',
 1),
('file-reader', 'data-access', '文件数据读取', '从本地或共享文件系统读取数据文件，支持CSV、JSON、TXT、PDF等格式，可配置编码、批量和路径规则。', 
 '[{"field":"path","type":"string","required":true,"default":"/data/input","description":"文件路径或目录"},{"field":"format","type":"string","required":false,"default":"csv","description":"文件格式 csv/json/txt/pdf"},{"field":"encoding","type":"string","required":false,"default":"utf-8","description":"文件编码"},{"field":"batchSize","type":"number","required":false,"default":1000,"description":"每批读取行数"}]',
 '{"type":"object","properties":{"path":{"type":"string"},"format":{"type":"string"}}}',
 '{"type":"object","properties":{"rows":{"type":"array"},"fileCount":{"type":"number"},"totalSize":{"type":"string"}}}',
 '{"path":"/data/input","format":"csv","encoding":"utf-8","batchSize":1000}',
 '[{"q":"支持哪些文件格式？","a":"支持CSV、JSON、TXT、PDF、Excel等常见格式。"},{"q":"大文件如何处理？","a":"使用流式读取+分批处理，不会一次性加载到内存。"}]',
 1),
('kafka-consumer', 'data-access', 'Kafka消费者', '从Kafka Topic消费实时数据流，支持消费者组、偏移量管理和消息反序列化配置。', 
 '[{"field":"brokers","type":"string","required":true,"default":"kafka:9092","description":"Kafka Broker地址列表"},{"field":"topic","type":"string","required":true,"default":"data-input","description":"消费的Topic名称"},{"field":"groupId","type":"string","required":true,"default":"pipeline-group","description":"消费者组ID"}]',
 '{"type":"object","properties":{"brokers":{"type":"string"},"topic":{"type":"string"},"groupId":{"type":"string"}}}',
 '{"type":"object","properties":{"message":{"type":"object","description":"消息体"},"offset":{"type":"number"},"partition":{"type":"number"}}}',
 '{"brokers":"kafka:9092","topic":"data-input","groupId":"pipeline-group"}',
 '[{"q":"如何保证消息不丢失？","a":"启用自动提交偏移量+重试机制，建议配合死信队列使用。"},{"q":"消费延迟过大怎么办？","a":"增加消费者实例数或调整max.poll.records参数。"}]',
 1),
('ftp-loader', 'data-access', 'FTP文件加载', '从FTP服务器加载文件数据，支持主动/被动模式、断点续传和定时同步。', 
 '[{"field":"host","type":"string","required":true,"default":"ftp.example.com","description":"FTP服务器地址"},{"field":"port","type":"number","required":false,"default":21,"description":"FTP端口"},{"field":"username","type":"string","required":true,"default":"reader","description":"FTP用户名"},{"field":"remotePath","type":"string","required":true,"default":"/data","description":"远程文件路径"}]',
 '{"type":"object","properties":{"host":{"type":"string"},"credentials":{"type":"object"}}}',
 '{"type":"object","properties":{"files":{"type":"array","description":"下载的文件列表"},"totalSize":{"type":"string"}}}',
 '{"host":"ftp.example.com","port":21,"username":"reader","remotePath":"/data"}',
 '[{"q":"是否支持SFTP？","a":"目前仅支持FTP协议，SFTP支持在后续版本中规划。"},{"q":"大文件传输中断了怎么办？","a":"支持断点续传，重新启动任务即可继续。"}]',
 1),
('data-cleaner', 'data-preprocess', '数据清洗', '对数据进行去重、去空、去空白等清洗操作，支持自定义清洗规则和条件过滤。', 
 '[{"field":"removeNull","type":"boolean","required":false,"default":true,"description":"移除空值记录"},{"field":"removeDuplicate","type":"boolean","required":false,"default":true,"description":"去除重复记录"},{"field":"trimWhitespace","type":"boolean","required":false,"default":true,"description":"去除首尾空白字符"}]',
 '{"type":"object","properties":{"rows":{"type":"array","description":"原始数据行"}}}',
 '{"type":"object","properties":{"rows":{"type":"array","description":"清洗后数据"},"removed":{"type":"number","description":"移除记录数"}}}',
 '{"removeNull":true,"removeDuplicate":true,"trimWhitespace":true}',
 '[{"q":"去重的依据是什么？","a":"默认按所有字段完全匹配去重，也可指定去重字段。"},{"q":"清洗后数据量减少了怎么办？","a":"检查清洗规则是否过于严格，可在日志中查看每条规则的命中数量。"}]',
 1),
('text-normalizer', 'data-preprocess', '文本归一化', '对文本数据进行大小写转换、特殊字符移除、编码统一等归一化处理，提升后续处理一致性。', 
 '[{"field":"lowercase","type":"boolean","required":false,"default":false,"description":"是否转小写"},{"field":"removeSpecialChars","type":"boolean","required":false,"default":true,"description":"移除特殊字符"},{"field":"encoding","type":"string","required":false,"default":"utf-8","description":"目标编码"}]',
 '{"type":"object","properties":{"text":{"type":"string","description":"原始文本"}}}',
 '{"type":"object","properties":{"text":{"type":"string","description":"归一化后文本"},"normalized":{"type":"boolean"}}}',
 '{"lowercase":false,"removeSpecialChars":true,"encoding":"utf-8"}',
 '[{"q":"特殊字符的定义范围？","a":"默认移除非字母数字和中文字符，可通过正则自定义范围。"},{"q":"是否支持繁简转换？","a":"暂不支持，建议在数据接入阶段预处理。"}]',
 1),
('data-filter', 'data-preprocess', '数据过滤', '按条件对数据进行过滤筛选，支持AND/OR逻辑组合和多条件嵌套。', 
 '[{"field":"conditions","type":"array","required":true,"default":["field != null"],"description":"过滤条件列表"},{"field":"mode","type":"string","required":false,"default":"AND","description":"逻辑模式 AND/OR"}]',
 '{"type":"object","properties":{"rows":{"type":"array"},"conditions":{"type":"array"}}}',
 '{"type":"object","properties":{"rows":{"type":"array","description":"过滤后数据"},"filtered":{"type":"number"}}}',
 '{"conditions":["field != null"],"mode":"AND"}',
 '[{"q":"支持哪些比较运算符？","a":"支持 =, !=, >, <, >=, <=, LIKE, IN 等常用运算符。"},{"q":"条件语法是什么？","a":"使用字段名+运算符+值的表达式，如 age > 18。"}]',
 1),
('text-splitter', 'data-preprocess', '文本分段', '将长文本按段落、句子或固定长度进行分段切割，支持重叠窗口设置。', 
 '[{"field":"method","type":"string","required":false,"default":"paragraph","description":"分段方法 paragraph/sentence/fixed"},{"field":"maxLength","type":"number","required":false,"default":512,"description":"最大段长"},{"field":"overlap","type":"number","required":false,"default":50,"description":"重叠字符数"}]',
 '{"type":"object","properties":{"text":{"type":"string"},"maxLength":{"type":"number"}}}',
 '{"type":"object","properties":{"segments":{"type":"array","description":"分段结果"},"segmentCount":{"type":"number"}}}',
 '{"method":"paragraph","maxLength":512,"overlap":50}',
 '[{"q":"overlap参数的作用？","a":"设置相邻段落的重叠字符数，避免语义截断。"},{"q":"段落分割和句子分割有什么区别？","a":"段落按换行符分割，句子按句号等标点分割。"}]',
 1),
('format-converter', 'data-preprocess', '格式转换', '在不同数据格式之间进行转换，支持JSON/CSV/Parquet互转及日期格式化。', 
 '[{"field":"inputFormat","type":"string","required":true,"default":"json","description":"输入格式"},{"field":"outputFormat","type":"string","required":true,"default":"csv","description":"输出格式"},{"field":"dateFormat","type":"string","required":false,"default":"YYYY-MM-DD","description":"日期格式"}]',
 '{"type":"object","properties":{"data":{"type":"object"},"inputFormat":{"type":"string"}}}',
 '{"type":"object","properties":{"data":{"type":"string","description":"转换后数据"},"outputFormat":{"type":"string"}}}',
 '{"inputFormat":"json","outputFormat":"csv","dateFormat":"YYYY-MM-DD"}',
 '[{"q":"是否支持XML格式？","a":"暂不支持XML，建议先用外部工具转为JSON后使用。"},{"q":"大文件转换很慢怎么办？","a":"使用流式转换模式，避免全量加载。"}]',
 1),
('ner-model', 'model-labeling', 'NER实体识别', '基于BERT等预训练模型对文本进行命名实体识别，支持自定义实体类型和置信度阈值。', 
 '[{"field":"model","type":"string","required":true,"default":"bert-base-chinese","description":"模型名称或路径"},{"field":"entityTypes","type":"array","required":false,"default":["PER","ORG","LOC","TIME"],"description":"识别的实体类型"},{"field":"confidence","type":"number","required":false,"default":0.85,"description":"置信度阈值"}]',
 '{"type":"object","properties":{"text":{"type":"string","description":"输入文本"}}}',
 '{"type":"object","properties":{"entities":{"type":"array","description":"识别出的实体列表","items":{"type":"object","properties":{"text":{"type":"string"},"type":{"type":"string"},"start":{"type":"number"},"end":{"type":"number"},"confidence":{"type":"number"}}}}}}',
 '{"model":"bert-base-chinese","entityTypes":["PER","ORG","LOC","TIME"],"confidence":0.85}',
 '[{"q":"如何添加自定义实体类型？","a":"在entityTypes数组中添加自定义标签，并准备对应的标注数据微调模型。"},{"q":"识别准确率不高怎么办？","a":"尝试降低confidence阈值，或使用领域数据微调模型。"}]',
 1),
('sentiment-model', 'model-labeling', '情感分析', '对文本进行情感倾向分析，输出正面/负面/中性标签及置信度分数。', 
 '[{"field":"model","type":"string","required":true,"default":"sentiment-bert","description":"情感分析模型名称"},{"field":"labels","type":"array","required":false,"default":["positive","negative","neutral"],"description":"情感标签列表"}]',
 '{"type":"object","properties":{"text":{"type":"string"}}}',
 '{"type":"object","properties":{"label":{"type":"string","description":"情感标签"},"confidence":{"type":"number","description":"置信度"}}}',
 '{"model":"sentiment-bert","labels":["positive","negative","neutral"]}',
 '[{"q":"支持多语言吗？","a":"默认支持中文和英文，其他语言需更换模型。"},{"q":"如何处理讽刺文本？","a":"讽刺文本识别较难，建议结合上下文或使用专门训练的模型。"}]',
 1),
('classify-model', 'model-labeling', '文本分类', '基于预训练模型对文本进行多分类标注，支持自定义分类体系和阈值控制。', 
 '[{"field":"model","type":"string","required":true,"default":"text-classifier","description":"分类模型名称"},{"field":"categories","type":"array","required":false,"default":["科技","财经","体育","娱乐"],"description":"分类类别"},{"field":"threshold","type":"number","required":false,"default":0.7,"description":"分类置信度阈值"}]',
 '{"type":"object","properties":{"text":{"type":"string"}}}',
 '{"type":"object","properties":{"category":{"type":"string"},"confidence":{"type":"number"}}}',
 '{"model":"text-classifier","categories":["科技","财经","体育","娱乐"],"threshold":0.7}',
 '[{"q":"分类类别可以动态添加吗？","a":"可以，但添加新类别后需要重新训练或微调模型。"},{"q":"阈值设置多少合适？","a":"一般0.7以上效果较好，可根据实际场景调整。"}]',
 1),
('custom-model', 'model-labeling', '自定义模型', '加载用户自定义的机器学习模型进行推理，支持指定模型路径、输入输出字段映射。', 
 '[{"field":"modelPath","type":"string","required":true,"default":"/models/custom","description":"模型文件路径"},{"field":"inputField","type":"string","required":false,"default":"text","description":"输入字段名"},{"field":"outputField","type":"string","required":false,"default":"label","description":"输出字段名"}]',
 '{"type":"object","properties":{"inputField":{"type":"string"},"data":{"type":"object"}}}',
 '{"type":"object","properties":{"outputField":{"type":"string"},"result":{"type":"object"}}}',
 '{"modelPath":"/models/custom","inputField":"text","outputField":"label"}',
 '[{"q":"支持哪些模型格式？","a":"支持ONNX、SavedModel、PyTorch等常见格式。"},{"q":"模型加载失败怎么排查？","a":"检查路径是否正确、模型文件是否完整、依赖库是否安装。"}]',
 1),
('rule-extractor', 'entity-extract', '规则抽取', '基于正则表达式等规则从文本中抽取结构化实体信息，支持多规则组合和大小写控制。', 
 '[{"field":"rules","type":"array","required":true,"default":["正则表达式"],"description":"抽取规则列表"},{"field":"fieldName","type":"string","required":false,"default":"entity","description":"输出字段名"},{"field":"caseSensitive","type":"boolean","required":false,"default":false,"description":"是否区分大小写"}]',
 '{"type":"object","properties":{"text":{"type":"string"},"rules":{"type":"array"}}}',
 '{"type":"object","properties":{"matches":{"type":"array","description":"匹配结果"},"matchCount":{"type":"number"}}}',
 '{"rules":["正则表达式"],"fieldName":"entity","caseSensitive":false}',
 '[{"q":"规则优先级如何设置？","a":"按数组顺序依次匹配，先匹配到的优先。"},{"q":"正则表达式太复杂影响性能？","a":"建议拆分为多个简单规则，或使用预编译模式。"}]',
 1),
('medical-ner', 'entity-extract', '医学实体识别', '基于BioBERT等医学领域模型识别疾病、药物、症状、治疗方案等医学实体。', 
 '[{"field":"model","type":"string","required":true,"default":"biobert-ner","description":"医学NER模型名称"},{"field":"entityTypes","type":"array","required":false,"default":["疾病","药物","症状","治疗方案"],"description":"医学实体类型"},{"field":"confidence","type":"number","required":false,"default":0.9,"description":"置信度阈值"}]',
 '{"type":"object","properties":{"text":{"type":"string"}}}',
 '{"type":"object","properties":{"entities":{"type":"array","description":"医学实体列表"}}}',
 '{"model":"biobert-ner","entityTypes":["疾病","药物","症状","治疗方案"],"confidence":0.9}',
 '[{"q":"准确率如何？","a":"在中文医学文本上F1可达0.89以上，但不同子领域有差异。"},{"q":"能否识别中药名？","a":"支持常见中药名识别，罕见药名可能需要自定义词典。"}]',
 1),
('finance-ner', 'entity-extract', '金融实体识别', '专门针对金融领域文本进行实体识别，支持公司、股票、行业、人物等实体类型。', 
 '[{"field":"entityTypes","type":"array","required":true,"default":["公司","股票","行业","人物"],"description":"金融实体类型"}]',
 '{"type":"object","properties":{"text":{"type":"string"}}}',
 '{"type":"object","properties":{"entities":{"type":"array","description":"金融实体列表"}}}',
 '{"entityTypes":["公司","股票","行业","人物"]}',
 '[{"q":"支持港股和美股公司名吗？","a":"支持常见港股和美股上市公司名称识别。"},{"q":"如何更新实体词典？","a":"可通过管理界面上传自定义词典文件。"}]',
 1),
('address-parser', 'entity-extract', '地址解析', '将非结构化地址文本解析为省/市/区/街道等层级结构，支持坐标反查。', 
 '[{"field":"level","type":"string","required":false,"default":"district","description":"解析精度级别 province/city/district/street"},{"field":"includeCoords","type":"boolean","required":false,"default":true,"description":"是否包含经纬度坐标"}]',
 '{"type":"object","properties":{"address":{"type":"string"}}}',
 '{"type":"object","properties":{"province":{"type":"string"},"city":{"type":"string"},"district":{"type":"string"},"coords":{"type":"object"}}}',
 '{"level":"district","includeCoords":true}',
 '[{"q":"地址不规范能解析吗？","a":"支持常见简写和别名，但过于模糊的地址可能解析失败。"},{"q":"坐标精度如何？","a":"一般精确到区级别，街道级别精度依赖地图数据质量。"}]',
 1),
('relation-extractor', 'relation-build', '关系抽取', '从文本中抽取实体间的语义关系，支持自定义关系类型和置信度过滤。', 
 '[{"field":"model","type":"string","required":true,"default":"re-bert-chinese","description":"关系抽取模型"},{"field":"relationTypes","type":"array","required":false,"default":["任职","投资","合作","收购"],"description":"关系类型列表"},{"field":"threshold","type":"number","required":false,"default":0.8,"description":"置信度阈值"}]',
 '{"type":"object","properties":{"text":{"type":"string"},"entities":{"type":"array"}}}',
 '{"type":"object","properties":{"subject":{"type":"string"},"predicate":{"type":"string"},"object":{"type":"string"},"confidence":{"type":"number"}}}',
 '{"model":"re-bert-chinese","relationTypes":["任职","投资","合作","收购"],"threshold":0.8}',
 '[{"q":"如何添加新的关系类型？","a":"在relationTypes中添加，然后准备标注数据微调模型。"},{"q":"关系抽取准确率如何提升？","a":"增加训练数据、使用更大模型或降低threshold值。"}]',
 1),
('co-occurrence', 'relation-build', '共现分析', '基于文本共现统计发现实体间的潜在关联，支持PMI、互信息等统计方法。', 
 '[{"field":"windowSize","type":"number","required":false,"default":5,"description":"共现窗口大小"},{"field":"minFrequency","type":"number","required":false,"default":3,"description":"最小共现频次"},{"field":"method","type":"string","required":false,"default":"PMI","description":"统计方法 PMI/MI/LogLikelihood"}]',
 '{"type":"object","properties":{"text":{"type":"string"},"entities":{"type":"array"}}}',
 '{"type":"object","properties":{"pairs":{"type":"array","description":"共现实体对"},"score":{"type":"number"}}}',
 '{"windowSize":5,"minFrequency":3,"method":"PMI"}',
 '[{"q":"窗口大小如何选择？","a":"一般5-10个词，窗口越大发现远距离关联但噪声也增加。"},{"q":"PMI和互信息哪个好？","a":"PMI更常用于共现分析，互信息对低频词更敏感。"}]',
 1),
('causal-analysis', 'relation-build', '因果关系分析', '识别文本中的因果关系，判断因果方向和强度，支持显式和隐式因果关系。', 
 '[{"field":"model","type":"string","required":true,"default":"causal-bert","description":"因果分析模型"},{"field":"confidence","type":"number","required":false,"default":0.75,"description":"置信度阈值"}]',
 '{"type":"object","properties":{"text":{"type":"string"}}}',
 '{"type":"object","properties":{"cause":{"type":"string"},"effect":{"type":"string"},"confidence":{"type":"number"}}}',
 '{"model":"causal-bert","confidence":0.75}',
 '[{"q":"隐式因果关系能识别吗？","a":"模型可识别部分隐式因果，但准确率低于显式因果。"},{"q":"如何标注因果数据？","a":"建议使用[原因]和[结果]标签对进行标注。"}]',
 1),
('event-extractor', 'relation-build', '事件抽取', '从文本中抽取结构化事件信息，包括事件类型、触发词和论元角色。', 
 '[{"field":"eventTypes","type":"array","required":true,"default":["并购","融资","合作","发布"],"description":"事件类型列表"},{"field":"extractArgs","type":"boolean","required":false,"default":true,"description":"是否提取事件论元"}]',
 '{"type":"object","properties":{"text":{"type":"string"}}}',
 '{"type":"object","properties":{"eventType":{"type":"string"},"trigger":{"type":"string"},"arguments":{"type":"array"}}}',
 '{"eventTypes":["并购","融资","合作","发布"],"extractArgs":true}',
 '[{"q":"事件论元是什么？","a":"事件的参与者和属性，如并购事件的收购方、被收购方、金额等。"},{"q":"如何自定义事件类型？","a":"在eventTypes中添加新类型，并准备标注样本。"}]',
 1),
('kg-builder', 'knowledge-production', '知识图谱构建', '将抽取的实体和关系数据构建为知识图谱并写入图数据库，支持Neo4j等主流图数据库。', 
 '[{"field":"graphDB","type":"string","required":true,"default":"neo4j","description":"图数据库类型"},{"field":"host","type":"string","required":true,"default":"10.0.1.200","description":"图数据库地址"},{"field":"port","type":"number","required":true,"default":7687,"description":"图数据库端口"}]',
 '{"type":"object","properties":{"entities":{"type":"array"},"relations":{"type":"array"}}}',
 '{"type":"object","properties":{"nodeCount":{"type":"number"},"edgeCount":{"type":"number"},"status":{"type":"string"}}}',
 '{"graphDB":"neo4j","host":"10.0.1.200","port":7687}',
 '[{"q":"支持哪些图数据库？","a":"目前支持Neo4j，后续将支持NebulaGraph和JanusGraph。"},{"q":"已有图谱如何增量更新？","a":"支持upsert模式，已存在的实体和关系会更新而非重复创建。"}]',
 1),
('kg-writer', 'knowledge-production', '知识库写入', '将结构化知识数据写入搜索引擎或文档数据库，支持Elasticsearch等目标存储。', 
 '[{"field":"target","type":"string","required":true,"default":"elasticsearch","description":"目标存储类型"},{"field":"index","type":"string","required":true,"default":"knowledge_base","description":"目标索引名"}]',
 '{"type":"object","properties":{"documents":{"type":"array"},"index":{"type":"string"}}}',
 '{"type":"object","properties":{"indexed":{"type":"number"},"status":{"type":"string"}}}',
 '{"target":"elasticsearch","index":"knowledge_base"}',
 '[{"q":"写入性能如何优化？","a":"使用批量写入接口，建议batch size 1000-5000。"},{"q":"如何处理写入冲突？","a":"默认使用覆盖模式，可配置为跳过或合并模式。"}]',
 1),
('data-fusion', 'knowledge-production', '数据融合', '对多源数据进行实体对齐和属性融合，支持投票、加权等融合策略。', 
 '[{"field":"strategy","type":"string","required":false,"default":"voting","description":"融合策略 voting/weighted/latest"},{"field":"sources","type":"number","required":false,"default":3,"description":"数据源数量"},{"field":"conflictResolution","type":"string","required":false,"default":"latest","description":"冲突解决策略"}]',
 '{"type":"object","properties":{"sources":{"type":"array"}}}',
 '{"type":"object","properties":{"fused":{"type":"array"},"conflicts":{"type":"number"}}}',
 '{"strategy":"voting","sources":3,"conflictResolution":"latest"}',
 '[{"q":"投票策略如何工作？","a":"多源数据中，取多数一致的结果；无多数时使用conflictResolution策略。"},{"q":"加权策略如何设置权重？","a":"按数据源可信度设置权重，权重高的数据源优先。"}]',
 1),
('quality-check', 'knowledge-production', '质量校验', '对生产数据进行完整性、一致性、准确性等多维度质量校验。', 
 '[{"field":"rules","type":"array","required":true,"default":["完整性","一致性","准确性"],"description":"校验规则列表"},{"field":"strictMode","type":"boolean","required":false,"default":false,"description":"严格模式，任一规则失败即中断"}]',
 '{"type":"object","properties":{"data":{"type":"array"},"rules":{"type":"array"}}}',
 '{"type":"object","properties":{"passed":{"type":"boolean"},"details":{"type":"array"},"score":{"type":"number"}}}',
 '{"rules":["完整性","一致性","准确性"],"strictMode":false}',
 '[{"q":"质量评分如何计算？","a":"按各维度权重加权计算，满分100分。"},{"q":"校验失败如何处理？","a":"严格模式下中断流程，非严格模式记录问题继续执行。"}]',
 1),
('graph-viewer', 'data-browse', '图谱浏览器', '以可视化方式浏览知识图谱数据，支持力导向布局、搜索定位和子图筛选。', 
 '[{"field":"maxNodes","type":"number","required":false,"default":500,"description":"最大显示节点数"},{"field":"layout","type":"string","required":false,"default":"force","description":"布局方式 force/hierarchical/circular"}]',
 '{"type":"object","properties":{"query":{"type":"string"},"maxNodes":{"type":"number"}}}',
 '{"type":"object","properties":{"nodes":{"type":"array"},"edges":{"type":"array"},"displayedNodes":{"type":"number"}}}',
 '{"maxNodes":500,"layout":"force"}',
 '[{"q":"节点太多如何展示？","a":"使用聚合模式，同类型节点合并显示，或缩小maxNodes。"},{"q":"支持导出图谱图片吗？","a":"支持导出PNG和SVG格式。"}]',
 1),
('data-dashboard', 'data-browse', '数据看板', '以图表形式展示数据处理结果，支持折线图、柱状图、饼图等多种图表类型。', 
 '[{"field":"refreshInterval","type":"number","required":false,"default":30,"description":"自动刷新间隔(秒)"},{"field":"chartTypes","type":"array","required":false,"default":["line","bar","pie"],"description":"图表类型列表"}]',
 '{"type":"object","properties":{"data":{"type":"array"},"chartTypes":{"type":"array"}}}',
 '{"type":"object","properties":{"charts":{"type":"array"},"lastRefresh":{"type":"string"}}}',
 '{"refreshInterval":30,"chartTypes":["line","bar","pie"]}',
 '[{"q":"支持自定义图表样式吗？","a":"支持颜色、大小等基本样式自定义，复杂样式需修改模板。"},{"q":"数据量很大时看板卡顿？","a":"启用数据采样模式或增大refreshInterval。"}]',
 1),
('data-export', 'data-browse', '数据导出', '将处理结果数据导出为CSV、Excel等格式文件，支持大数据量分批导出和编码设置。', 
 '[{"field":"format","type":"string","required":false,"default":"csv","description":"导出格式 csv/excel/json"},{"field":"encoding","type":"string","required":false,"default":"utf-8","description":"文件编码"},{"field":"maxRows","type":"number","required":false,"default":100000,"description":"最大导出行数"}]',
 '{"type":"object","properties":{"data":{"type":"array"},"format":{"type":"string"}}}',
 '{"type":"object","properties":{"fileUrl":{"type":"string"},"rowCount":{"type":"number"},"fileSize":{"type":"string"}}}',
 '{"format":"csv","encoding":"utf-8","maxRows":100000}',
 '[{"q":"导出超时怎么办？","a":"减少maxRows或使用分批导出模式。"},{"q":"导出的中文乱码？","a":"确保encoding设为utf-8，用Excel打开时选择UTF-8编码。"}]',
 1),
('report-generator', 'data-browse', '报告生成', '自动生成数据处理报告，支持PDF/HTML格式，可包含图表和统计摘要。', 
 '[{"field":"template","type":"string","required":false,"default":"default","description":"报告模板名称"},{"field":"format","type":"string","required":false,"default":"pdf","description":"输出格式 pdf/html"},{"field":"includeCharts","type":"boolean","required":false,"default":true,"description":"是否包含图表"}]',
 '{"type":"object","properties":{"data":{"type":"object"},"template":{"type":"string"}}}',
 '{"type":"object","properties":{"fileUrl":{"type":"string"},"format":{"type":"string"},"pages":{"type":"number"}}}',
 '{"template":"default","format":"pdf","includeCharts":true}',
 '[{"q":"如何自定义报告模板？","a":"在模板管理中创建新模板，支持变量占位符和条件渲染。"},{"q":"PDF中文显示异常？","a":"确保服务器安装了中文字体包。"}]',
 1);
