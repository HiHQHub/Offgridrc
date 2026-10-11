-- Run in customer-owned PostgreSQL. Do not share one deployment across unrelated customers.
CREATE TABLE IF NOT EXISTS re3l_messages (
 id uuid PRIMARY KEY,
 provider_id text UNIQUE,
 message_id text,
 thread_id uuid NOT NULL,
 direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
 sender text NOT NULL,
 recipients jsonb NOT NULL,
 subject text NOT NULL DEFAULT '',
 body_text text NOT NULL DEFAULT '',
 status text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS re3l_messages_thread ON re3l_messages (thread_id,created_at);
CREATE INDEX IF NOT EXISTS re3l_messages_created ON re3l_messages (created_at DESC);
CREATE TABLE IF NOT EXISTS re3l_events (
 event_id text PRIMARY KEY,
 event_type text NOT NULL,
 received_at timestamptz NOT NULL DEFAULT now()
);
