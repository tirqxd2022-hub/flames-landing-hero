-- Track which addresses received the notification email for each submission.
ALTER TABLE contact_submissions
  ADD COLUMN sent_to TEXT NOT NULL DEFAULT '' AFTER user_agent;
