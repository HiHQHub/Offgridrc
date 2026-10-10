-- Additive migration. Does not modify the prototype's tables or website.
CREATE TABLE IF NOT EXISTS re3l_tenants(id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE IF NOT EXISTS re3l_mailboxes(
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES re3l_tenants(id),
 address text UNIQUE NOT NULL, owner_user_id bigint NOT NULL, enabled boolean NOT NULL DEFAULT false,
 domain_verified_at timestamptz, UNIQUE(id,tenant_id),
 CHECK (enabled=false OR domain_verified_at IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS re3l_keys(
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL, mailbox_id uuid NOT NULL, token_hash text UNIQUE NOT NULL,
 scopes text[] NOT NULL DEFAULT ARRAY['read'], created_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz,
 FOREIGN KEY(mailbox_id,tenant_id) REFERENCES re3l_mailboxes(id,tenant_id)
);
CREATE TABLE IF NOT EXISTS re3l_messages(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,mailbox_id uuid NOT NULL,thread_id uuid NOT NULL,
 direction text NOT NULL CHECK(direction IN ('inbound','outbound')),sender text NOT NULL,
 recipients jsonb NOT NULL,subject text NOT NULL,body_text text NOT NULL,headers jsonb NOT NULL DEFAULT '{}',
 attachments jsonb NOT NULL DEFAULT '[]', status text NOT NULL,
 provider_id text,rfc_message_id text,created_at timestamptz NOT NULL DEFAULT now(),sent_at timestamptz,
 approval_hash text,approval_expires timestamptz,attempts integer NOT NULL DEFAULT 0,next_attempt timestamptz,lease_until timestamptz,
 FOREIGN KEY(mailbox_id,tenant_id) REFERENCES re3l_mailboxes(id,tenant_id),
 UNIQUE(tenant_id,mailbox_id,provider_id)
);
CREATE INDEX IF NOT EXISTS re3l_thread_idx ON re3l_messages(tenant_id,mailbox_id,thread_id,created_at);
CREATE INDEX IF NOT EXISTS re3l_rfc_idx ON re3l_messages(tenant_id,mailbox_id,rfc_message_id);
CREATE INDEX IF NOT EXISTS re3l_queue_idx ON re3l_messages(status,next_attempt);
CREATE TABLE IF NOT EXISTS re3l_events(provider_event_id text PRIMARY KEY,event_type text NOT NULL,payload jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS re3l_audit(id bigserial PRIMARY KEY,tenant_id uuid NOT NULL,key_id uuid NOT NULL,action text NOT NULL,message_id uuid,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS re3l_suppressions(tenant_id uuid NOT NULL,address text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,address));
CREATE TABLE IF NOT EXISTS re3l_rate_windows(key_id uuid NOT NULL,window_start timestamptz NOT NULL,requests integer NOT NULL,PRIMARY KEY(key_id,window_start));
ALTER TABLE re3l_keys ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE re3l_keys ADD COLUMN IF NOT EXISTS audience text;
CREATE TABLE IF NOT EXISTS re3l_oauth_codes(code_hash text PRIMARY KEY,client_id text NOT NULL,redirect_uri text NOT NULL,challenge text NOT NULL,tenant_id uuid NOT NULL,mailbox_id uuid NOT NULL,resource text NOT NULL,scopes text[] NOT NULL,expires_at timestamptz NOT NULL,used_at timestamptz);
CREATE TABLE IF NOT EXISTS re3l_oauth_refresh(token_hash text PRIMARY KEY,client_id text NOT NULL,key_id uuid NOT NULL REFERENCES re3l_keys(id),expires_at timestamptz NOT NULL,used_at timestamptz);
CREATE TABLE IF NOT EXISTS re3l_settings(name text PRIMARY KEY,value text NOT NULL);
