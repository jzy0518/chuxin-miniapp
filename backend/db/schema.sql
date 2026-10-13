-- =============================================================
-- chuxin 羽毛球动作纠正小程序 · 数据库 schema (MySQL 8.4 LTS)
-- 库名: chuxin   字符集: utf8mb4
-- 表: user / action_type / action_correct / video / video_analysis
-- =============================================================

CREATE DATABASE IF NOT EXISTS `chuxin`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE `chuxin`;

-- -------------------------------------------------------------
-- 1. 用户表（我的模块 / 微信登录）
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `openid`      VARCHAR(64)  NOT NULL COMMENT '微信 openid，唯一',
  `nick_name`   VARCHAR(64)  NULL COMMENT '昵称',
  `avatar_url`  VARCHAR(512) NULL COMMENT '头像地址',
  `skill_level` TINYINT NOT NULL DEFAULT 0 COMMENT '技术等级 0-10',
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_openid` (`openid`)
) ENGINE=InnoDB COMMENT='用户';

-- -------------------------------------------------------------
-- 2. 动作类型表（动作纠正/训练模块的分类与纠正点）
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `action_type` (
  `id`          SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code`        VARCHAR(32) NOT NULL COMMENT '动作编码，如 clear/smash',
  `name`        VARCHAR(64) NOT NULL COMMENT '动作名，如 高远球',
  `category`    VARCHAR(32) NOT NULL COMMENT '分组：后场/网前/步法等',
  `icon`        VARCHAR(16) NOT NULL DEFAULT '' COMMENT '图标 emoji',
  `sort_order`  INT NOT NULL DEFAULT 0 COMMENT '排序',
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`)
) ENGINE=InnoDB COMMENT='动作类型';

INSERT IGNORE INTO `action_type` (`code`, `name`, `category`, `icon`, `sort_order`) VALUES
  ('clear',      '高远球', '后场', '🏸', 10),
  ('smash',      '杀球',   '后场', '⚡', 20),
  ('drop',       '吊球',   '后场', '🎾', 30),
  ('net',        '放网',   '网前', '🕊', 40),
  ('lift',       '挑球',   '网前', '🔄', 50),
  ('push',       '推球',   '网前', '🎯', 60),
  ('sidle',      '并步',   '步法', '👟', 70),
  ('cross',      '交叉步', '步法', '🦶', 80),
  ('starts',     '启动步', '步法', '🚀', 90);

-- -------------------------------------------------------------
-- 3. 动作纠正记录（用户对某个动作的纠正点进度）
--    熟练度进度环 = 已纠正数(status=1) / 该动作纠正点总数
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `action_correct` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`        BIGINT UNSIGNED NOT NULL,
  `action_type_id` SMALLINT UNSIGNED NOT NULL,
  `point_name`     VARCHAR(128) NOT NULL COMMENT '纠正点，如 持拍手肘抬太低',
  `status`         TINYINT NOT NULL DEFAULT 0 COMMENT '0=待纠正 1=已纠正',
  `note`           VARCHAR(255) NULL COMMENT '备注/改善建议',
  `corrected_at`   DATETIME NULL COMMENT '纠正完成时间',
  `created_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_action` (`user_id`, `action_type_id`),
  CONSTRAINT `fk_correct_action` FOREIGN KEY (`action_type_id`) REFERENCES `action_type`(`id`)
) ENGINE=InnoDB COMMENT='动作纠正记录';

-- -------------------------------------------------------------
-- 4. 实战视频表（实战模块，上传的视频元数据）
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `video` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`     BIGINT UNSIGNED NOT NULL,
  `title`       VARCHAR(128) NULL COMMENT '视频标题',
  `file_key`    VARCHAR(512) NOT NULL COMMENT '对象存储 key/路径',
  `file_url`    VARCHAR(512) NULL COMMENT '可访问 URL',
  `duration_sec` INT NOT NULL DEFAULT 0 COMMENT '时长(秒)',
  `status`      TINYINT NOT NULL DEFAULT 0 COMMENT '0=处理中 1=完成 2=失败',
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`)
) ENGINE=InnoDB COMMENT='实战视频';

-- -------------------------------------------------------------
-- 5. 视频动作分析表（实战/AI 分析，预留未来闭环）
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `video_analysis` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `video_id`     BIGINT UNSIGNED NOT NULL,
  `action_type_id` SMALLINT UNSIGNED NULL,
  `status`       TINYINT NOT NULL DEFAULT 0 COMMENT '0=排队中 1=完成 2=失败',
  `score`        TINYINT NULL COMMENT '动作得分 0-100',
  `result_json`  JSON NULL COMMENT 'AI 分析结果',
  `error_msg`    VARCHAR(255) NULL COMMENT '失败原因',
  `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_video` (`video_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `fk_analysis_video` FOREIGN KEY (`video_id`) REFERENCES `video`(`id`)
) ENGINE=InnoDB COMMENT='视频动作分析';

-- -------------------------------------------------------------
-- 应用专用账号（后端连接用，避免直接用 root）
-- -------------------------------------------------------------
CREATE USER IF NOT EXISTS 'chuxin'@'localhost' IDENTIFIED BY 'chuxin123';
GRANT ALL PRIVILEGES ON `chuxin`.* TO 'chuxin'@'localhost';
FLUSH PRIVILEGES;