PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  uid TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS documents (
  path TEXT PRIMARY KEY,
  collection_name TEXT NOT NULL,
  doc_id TEXT NOT NULL,
  data TEXT NOT NULL CHECK(json_valid(data)),
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_documents_collection ON documents(collection_name);
CREATE INDEX IF NOT EXISTS idx_documents_updated ON documents(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_doc_id ON documents(doc_id);
