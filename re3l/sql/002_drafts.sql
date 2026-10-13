CREATE TABLE IF NOT EXISTS re3l_drafts (
 id uuid PRIMARY KEY,
 recipient text NOT NULL,
 subject text NOT NULL,
 body_text text NOT NULL,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sending','sent','failed')),
 approval_hash text,
 approval_expires timestamptz,
 provider_id text,
 created_at timestamptz NOT NULL DEFAULT now()
);
