# K-pop Card Collecting Discord Bot

A Discord bot that lets users collect, trade, and manage K-pop trading cards with an economy system!

## Features

### 🎴 Card Collection System
- **Random Card Drops**: Open packs to get cards with different rarities (Common, Rare, Epic, Legendary)
- **Personal Inventory**: Track all your collected cards
- **Rarity Tiers**: Beautiful color-coded embeds for each rarity level

### 💰 Economy System
- **Daily Rewards**: Claim 50 coins every 24 hours
- **Weekly Rewards**: Claim 300 coins every 7 days
- **Surf for Coins**: Earn 10-30 coins every hour
- **Starting Bonus**: New users get 100 coins to begin

### 🛒 Marketplace
- **List Cards**: Sell your cards to other users
- **Browse Listings**: See what's available
- **Buy Cards**: Purchase cards from other collectors

### ⚙️ Admin Tools
- **Add Cards**: `/addcard` - Add new K-pop cards to the database
- **Edit Cards**: `/editcard` - Modify existing cards
- **Delete Cards**: `/deletecard` - Remove cards from the database

## Commands

| Command | Description |
|---------|-------------|
| `/start` | Initialize your account and start collecting |
| `/drop` | Open a card pack (costs 50 coins) |
| `/inventory` | View your card collection |
| `/daily` | Claim daily coin reward (50 coins, 24h cooldown) |
| `/weekly` | Claim weekly coin reward (300 coins, 7d cooldown) |
| `/surf` | Surf for coins (10-30 coins, 1h cooldown) |
| `/cooldowns` | Check all your cooldown timers |
| `/shop` | Browse the card pack shop |
| `/mp list` | List a card for sale on the marketplace |
| `/mp browse` | Browse marketplace listings |
| `/mp buy` | Purchase a card from the marketplace |
| `/addcard` | (Admin) Add a new card to the database |
| `/editcard` | (Admin) Edit an existing card |
| `/deletecard` | (Admin) Delete a card from the database |

## Setup

### Prerequisites
- Node.js 20 or higher
- A Discord Bot Token
- A Supabase account and project

### Installation

1. **Clone and Install Dependencies**
   ```bash
   npm install
   ```

2. **Set Environment Variables**
   - `DISCORD_TOKEN` - Your Discord bot token
   - `DISCORD_CLIENT_ID` - Your Discord application ID
   - `SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_KEY` - Your Supabase anon/public key

3. **Set Up Supabase Database**
   - Follow the instructions in `setup-database.md`
   - Run the SQL schema in your Supabase SQL Editor
   - Optionally add sample cards

4. **Run the Bot**
   ```bash
   npm run dev
   ```

### Discord Bot Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to the "Bot" section and create a bot
4. Copy the bot token for `DISCORD_TOKEN`
5. Copy the application ID from "General Information" for `DISCORD_CLIENT_ID`
6. Enable these Privileged Gateway Intents:
   - Server Members Intent (optional)
   - Message Content Intent (optional)
7. Go to OAuth2 → URL Generator
8. Select scopes: `bot` and `applications.commands`
9. Select bot permissions: `Send Messages`, `Embed Links`, `Use Slash Commands`
10. Use the generated URL to invite the bot to your server

## Technology Stack

- **Runtime**: Node.js 20 with TypeScript
- **Discord Library**: Discord.js v14
- **Database**: Supabase (PostgreSQL)
- **Command Type**: Slash Commands (modern Discord interactions)

## Database Schema

- **users**: User profiles with coins and cooldown tracking
- **cards**: K-pop card catalog with rarities
- **inventory**: User card ownership with quantities
- **marketplace**: Card listings for trading

## Card Rarity System

- **🟡 Legendary** (5% drop rate) - Ultra rare cards
- **🟣 Epic** (15% drop rate) - Very rare cards
- **🔵 Rare** (30% drop rate) - Uncommon cards
- **⚪ Common** (50% drop rate) - Standard cards

## Contributing

Feel free to add more features like:
- Trading system between users
- Card fusion/upgrading
- Collection achievements
- Leaderboards
- Group/bias filtering
- Wishlists

## License

ISC
