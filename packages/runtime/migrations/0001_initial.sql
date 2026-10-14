CREATE TABLE "user" (
  id TEXT PRIMARY KEY NOT NULL,
  username TEXT NOT NULL UNIQUE,
  payload TEXT NOT NULL CHECK (json_valid(payload) AND json_extract(payload, '$.id') IS id AND json_extract(payload, '$.username') IS username AND json_type(payload, '$.password') IS NULL)
);

CREATE TABLE app_session (
  id TEXT PRIMARY KEY NOT NULL,
  owner TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  payload TEXT NOT NULL CHECK (json_valid(payload) AND json_extract(payload, '$.id') IS id AND json_extract(payload, '$.userId') IS owner)
);
CREATE INDEX app_session_owner_idx ON app_session(owner);

CREATE TABLE event (
  id TEXT PRIMARY KEY NOT NULL,
  owner TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  payload TEXT NOT NULL CHECK (json_valid(payload) AND json_extract(payload, '$.id') IS id AND json_extract(payload, '$.ownerId') IS owner)
);
CREATE INDEX event_owner_idx ON event(owner);

CREATE TABLE feed_token (
  id TEXT PRIMARY KEY NOT NULL,
  owner TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  payload TEXT NOT NULL CHECK (json_valid(payload) AND json_extract(payload, '$.id') IS id AND json_extract(payload, '$.ownerId') IS owner AND json_extract(payload, '$.tokenHash') IS token_hash AND json_type(payload, '$.token') IS NULL)
);
CREATE INDEX feed_token_owner_idx ON feed_token(owner);
