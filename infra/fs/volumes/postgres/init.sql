-- Seed data for the test fixture Postgres container.
-- See TESTING.md for how to bring this up: `bun run fixtures:up`.

CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  status      TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'refunded')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS orders_user_idx ON orders(user_id);

INSERT INTO users (email, name, active) VALUES
  ('alice@example.com', 'Alice', TRUE),
  ('bob@example.com',   'Bob',   TRUE),
  ('carol@example.com', 'Carol', FALSE)
ON CONFLICT (email) DO NOTHING;

INSERT INTO orders (user_id, total_cents, status) VALUES
  (1, 1999, 'paid'),
  (1, 4500, 'pending'),
  (2,  799, 'refunded'),
  (2, 12_000, 'paid');
