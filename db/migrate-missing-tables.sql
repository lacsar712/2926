-- 增量迁移：补齐缺失表结构（可重复执行，不含种子数据）
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `quality_rule` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL COMMENT '规则名称',
  `description` TEXT COMMENT '规则描述',
  `rule_type` ENUM('not_null','regex','numeric_range','enum') NOT NULL COMMENT '规则类型',
  `expression` TEXT COMMENT '规则表达式',
  `severity` ENUM('error','warning') NOT NULL DEFAULT 'warning' COMMENT '严重级别',
  `enabled` TINYINT DEFAULT 1 COMMENT '1启用 0禁用',
  `creator_id` INT COMMENT '创建者ID',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`creator_id`) REFERENCES `sys_user`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS `component_doc` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `component_type` VARCHAR(100) NOT NULL COMMENT '组件类型标识',
  `category` VARCHAR(50) NOT NULL COMMENT '所属分类',
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

CREATE TABLE IF NOT EXISTS `pipeline_comment` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `pipeline_id` INT NOT NULL COMMENT '关联生产线ID',
  `user_id` INT NOT NULL COMMENT '评论用户ID',
  `content` TEXT NOT NULL COMMENT '评论内容',
  `reply_to_id` INT DEFAULT NULL COMMENT '回复的目标评论ID',
  `is_pinned` TINYINT DEFAULT 0 COMMENT '是否置顶 0否 1是',
  `pinned_at` DATETIME DEFAULT NULL COMMENT '置顶时间',
  `pinned_by` INT DEFAULT NULL COMMENT '置顶操作人ID',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_pipeline_id` (`pipeline_id`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_pinned` (`pipeline_id`, `is_pinned`),
  FOREIGN KEY (`pipeline_id`) REFERENCES `pipeline`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `sys_user`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`reply_to_id`) REFERENCES `pipeline_comment`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`pinned_by`) REFERENCES `sys_user`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
