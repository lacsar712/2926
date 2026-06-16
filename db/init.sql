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
