-- Staff attendance / shift tracking.
-- Each row = one shift. `check_out_at IS NULL` means the shift is still open.
-- Times are stored in the DB's session timezone (Node process is pinned to
-- America/Toronto via process.env.TZ). `work_date` is the CA_TZ calendar
-- date of check_in, computed by the server so late-night shifts stay grouped
-- with their start date.

CREATE TABLE IF NOT EXISTS staff_attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  username VARCHAR(80) NOT NULL,
  check_in_at DATETIME NOT NULL,
  check_out_at DATETIME NULL,
  check_in_ip VARCHAR(64) NULL,
  check_out_ip VARCHAR(64) NULL,
  source ENUM('login_modal','manual','auto') NOT NULL DEFAULT 'login_modal',
  notes VARCHAR(255) NULL,
  work_date DATE NOT NULL,
  INDEX (user_id, work_date),
  INDEX (work_date),
  FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
