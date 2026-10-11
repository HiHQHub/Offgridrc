-- Additive reply-draft metadata and RFC correlation index; apply to existing deployments.
ALTER TABLE re3l_drafts ADD COLUMN IF NOT EXISTS thread_id uuid;
ALTER TABLE re3l_drafts ADD COLUMN IF NOT EXISTS in_reply_to text;
CREATE INDEX IF NOT EXISTS re3l_messages_message_id ON re3l_messages(message_id);
