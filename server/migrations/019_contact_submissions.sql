-- Contact form submissions. Stored regardless of spam status so admins can
-- review/triage. Spam-flagged rows are NOT emailed but still saved.
CREATE TABLE IF NOT EXISTS contact_submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(40) NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  is_spam TINYINT(1) NOT NULL DEFAULT 0,
  spam_reason VARCHAR(80) NOT NULL DEFAULT '',
  ip VARCHAR(64) NOT NULL DEFAULT '',
  user_agent VARCHAR(255) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cs_created (created_at),
  INDEX idx_cs_spam (is_spam)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
