-- Track row changes for external sync (real-time polling / webhooks).
ALTER TABLE staff_attendance
  ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  ADD INDEX idx_updated_at (updated_at);
