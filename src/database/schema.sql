-- Users table
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  coins INTEGER DEFAULT 0,
  last_daily TIMESTAMP,
  last_weekly TIMESTAMP,
  last_surf TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Cards table
CREATE TABLE IF NOT EXISTS cards (
  card_id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  "group" TEXT NOT NULL,
  era TEXT,
  rarity TEXT CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')) NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Inventory table
CREATE TABLE IF NOT EXISTS inventory (
  id SERIAL PRIMARY KEY,
  user_id TEXT REFERENCES users(user_id) ON DELETE CASCADE,
  card_id INTEGER REFERENCES cards(card_id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  acquired_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, card_id)
);

-- Marketplace listings table
CREATE TABLE IF NOT EXISTS marketplace (
  listing_id SERIAL PRIMARY KEY,
  seller_id TEXT REFERENCES users(user_id) ON DELETE CASCADE,
  card_id INTEGER REFERENCES cards(card_id) ON DELETE CASCADE,
  price INTEGER NOT NULL,
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_inventory_user ON inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_card ON marketplace(card_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_seller ON marketplace(seller_id);
