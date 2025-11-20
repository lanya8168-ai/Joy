# Supabase Database Setup Instructions

To set up your K-pop card bot database, follow these steps:

## Step 1: Access Supabase SQL Editor
1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Click on "SQL Editor" in the left sidebar
4. Click "New query"

## Step 2: Run the Database Schema

Copy and paste the following SQL code into the SQL Editor and click "Run":

```sql
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
```

## Step 3: Add Sample Cards (Optional)

To add some sample K-pop cards to test with, run this SQL:

```sql
INSERT INTO cards (name, group, rarity, image_url) VALUES
  ('Jisoo', 'BLACKPINK', 'legendary', 'https://i.imgur.com/placeholder1.jpg'),
  ('Jennie', 'BLACKPINK', 'legendary', 'https://i.imgur.com/placeholder2.jpg'),
  ('Rosé', 'BLACKPINK', 'epic', 'https://i.imgur.com/placeholder3.jpg'),
  ('Lisa', 'BLACKPINK', 'epic', 'https://i.imgur.com/placeholder4.jpg'),
  ('RM', 'BTS', 'legendary', 'https://i.imgur.com/placeholder5.jpg'),
  ('Jin', 'BTS', 'epic', 'https://i.imgur.com/placeholder6.jpg'),
  ('Suga', 'BTS', 'epic', 'https://i.imgur.com/placeholder7.jpg'),
  ('J-Hope', 'BTS', 'rare', 'https://i.imgur.com/placeholder8.jpg'),
  ('Jimin', 'BTS', 'rare', 'https://i.imgur.com/placeholder9.jpg'),
  ('V', 'BTS', 'rare', 'https://i.imgur.com/placeholder10.jpg'),
  ('Jungkook', 'BTS', 'common', 'https://i.imgur.com/placeholder11.jpg'),
  ('Karina', 'aespa', 'epic', 'https://i.imgur.com/placeholder12.jpg'),
  ('Winter', 'aespa', 'rare', 'https://i.imgur.com/placeholder13.jpg'),
  ('Giselle', 'aespa', 'rare', 'https://i.imgur.com/placeholder14.jpg'),
  ('Ningning', 'aespa', 'common', 'https://i.imgur.com/placeholder15.jpg');
```

## Step 4: Verify Setup

Check that everything is created correctly:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';

-- Count cards
SELECT COUNT(*) as total_cards FROM cards;
```

## Done!

Your database is now ready! You can use the Discord bot commands:
- Use `/start` to register as a user
- Use `/addcard` (admin only) to add more cards
- Use `/drop` to collect cards
- And all other commands!
