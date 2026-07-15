-- Existing installations of 002_qna.sql initially allowed only the create
-- action. Expand the same short-lived, one-way fingerprint table so private
-- post password attempts and failed admin logins can also be throttled.
ALTER TABLE qna_rate_limits
  DROP CONSTRAINT IF EXISTS qna_rate_limits_action_check;

ALTER TABLE qna_rate_limits
  ADD CONSTRAINT qna_rate_limits_action_check
  CHECK (action IN ('create', 'password', 'admin_login'));
