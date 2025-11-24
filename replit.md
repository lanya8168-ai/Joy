# K-pop Card Collecting Discord Bot

## Overview
A Discord bot that allows users to collect K-pop trading cards with an economy system, marketplace, and admin management tools. Built with Discord.js v14 and Supabase for persistent storage.

## Recent Changes
- **2025-11-24**: Updated reward commands with image merging: /daily gives random coins (50-100) + legendary card, /weekly gives 4 cards with merged image, /inventory shows 3 cards per page with merged images, card codes formatted as inline code
- **2025-11-24**: Added sharp package for card image merging, created imageUtils.ts utility for generating merged card images
- **2025-11-24**: Added Render deployment support with health check endpoint and Uptime Robot monitoring configuration
- **2025-11-23**: Reformatted /drop embed with user author, "You fished and found.." title, and clean field display (Idol, Group, Era, Rarity, Card code), added drop cooldown to /cooldowns
- **2025-11-23**: Fixed /drop to only select droppable cards, added pagination and filters to /inventory (page, rarity, group)
- **2025-11-23**: Added cardcode and droppable fields to cards table, updated /addcard and /editcard commands
- **2025-11-23**: Made /drop FREE with 2-minute cooldown (no cost), converted /shop to sell card packs (100/200/500/1000 coins), display rarities as numbers only, fixed /addcard timeout by adding deferReply()
- **2025-11-23**: Changed rarity system from 1-4 to 1-5 (Common, Uncommon, Rare, Epic, Legendary)
- **2025-11-20**: Added "era" field to cards table for tracking album/era information
- **2025-11-20**: Implemented atomic transaction safety using Supabase RPC functions for all economy and marketplace operations
- **2025-11-20**: Added runtime permission checks to all admin commands
- **2025-11-20**: Initial project setup with Node.js, TypeScript, Discord.js v14, and Supabase client

## Features
- **Free Daily Drops**: Get one free card pack every 24 hours via /drop
- **Daily Rewards**: Earn random coins (50-100) with shell emoji + receive a random legendary card every 24 hours
- **Weekly Rewards**: Claim coins + receive 4 random cards displayed in a merged image every 7 days
- **Card Shop**: Buy packs with coins (Starter: 1 card, Double: 2 cards, Premium: 5 cards, Ultimate: 10 cards)
- **Economy System**: Earn coins through daily/weekly rewards and surfing, then spend in shop
- **Marketplace**: Buy and sell cards with other users
- **Image Merging**: Inventory and weekly rewards display multiple cards in a single merged image
- **Admin Tools**: Add, edit, and delete cards from the database
- **Rarity System**: 5 tiers (1=Common, 2=Uncommon, 3=Rare, 4=Epic, 5=Legendary)
- **Slash Commands**: Modern Discord interaction system

## Commands
- `/start` - Initialize user profile
- `/drop` - Open a FREE card pack with 2-minute cooldown (card codes shown as inline code)
- `/inventory` - View your card collection (3 cards per page with merged image, no rarity emojis)
- `/daily` - Claim daily coin reward (50-100 random coins + 1 legendary card)
- `/weekly` - Claim weekly coin reward (300 coins + 4 random cards with merged image)
- `/surf` - Surf for coins
- `/shop browse` - View available card packs
- `/shop buy` - Purchase card packs (100, 200, 500, 1000 coins)
- `/mp list` - List cards for sale
- `/mp browse` - View marketplace listings
- `/mp buy` - Purchase cards from marketplace
- `/cooldowns` - Check cooldown timers
- `/addcard` - (Admin) Add new card
- `/deletecard` - (Admin) Remove card
- `/editcard` - (Admin) Modify card
- `/reload` - (Admin) Refresh command registrations

## Project Architecture
- **Language**: TypeScript with Node.js 20
- **Framework**: Discord.js v14
- **Database**: Supabase (PostgreSQL) with atomic RPC functions
- **Deployment**: Render (24/7 hosting) with Uptime Robot monitoring
- **Health Check**: Built-in HTTP server on port 3000 for monitoring
- **Dependencies**: sharp (image processing for card merging)
- **Structure**:
  - `src/index.ts` - Bot initialization with health check server
  - `src/commands/` - Slash command handlers
  - `src/database/` - Supabase client, schema, and RPC functions
  - `src/utils/` - Helper functions (cooldowns, card rarities, image merging)
  - `render.yaml` - Render deployment configuration
  - `DEPLOYMENT.md` - Complete deployment guide for Render and Uptime Robot

## Security Features
- **Atomic Transactions**: All coin/inventory operations use PostgreSQL RPC functions with row-level locking
- **Race Condition Prevention**: Database-level locks prevent double-spend and concurrent modification issues
- **Admin Protection**: Runtime permission checks enforce administrator-only access to card management
- **Transaction Rollback**: Failed operations automatically rollback to prevent data loss

## Environment Variables
- `DISCORD_TOKEN` - Discord bot token from Developer Portal
- `DISCORD_CLIENT_ID` - Discord application/client ID
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_KEY` - Supabase anon/public key
- `PORT` - (Optional) HTTP server port, defaults to 3000
- `NODE_ENV` - (Optional) Environment mode, set to "production" on Render

## Deployment
The bot is configured for deployment to Render with Uptime Robot monitoring. See `DEPLOYMENT.md` for detailed deployment instructions including:
- Pushing code to GitHub
- Creating a Render web service
- Setting up environment variables
- Configuring Uptime Robot for 24/7 monitoring
- Troubleshooting common issues
