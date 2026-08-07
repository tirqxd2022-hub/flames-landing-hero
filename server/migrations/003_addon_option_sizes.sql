-- Per-option size pricing (e.g., Small / Medium / Large for Coffee).
-- When an addon_option has rows here, the option's own `price` is ignored
-- and the customer picks one size; the chosen size's price is what's charged.
CREATE TABLE IF NOT EXISTS addon_option_sizes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  option_id INT NOT NULL,
  slug VARCHAR(40) NOT NULL,          -- e.g. 's','m','l'
  name VARCHAR(60) NOT NULL,          -- e.g. 'Small'
  price DECIMAL(8,2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE KEY uniq_opt_slug (option_id, slug),
  FOREIGN KEY (option_id) REFERENCES addon_options(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Flag on the group so the UI knows to render the S/M/L price table.
ALTER TABLE addon_groups
  ADD COLUMN is_sized TINYINT(1) NOT NULL DEFAULT 0 AFTER is_required;
