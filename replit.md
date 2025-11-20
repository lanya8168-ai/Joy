# K-pop Card Collecting Discord Bot

## Overview
A Discord bot that allows users to collect K-pop trading cards with an economy system, marketplace, and admin management tools. Built with Discord.js v14 and Supabase for persistent storage.

## Recent Changes
- **2025-11-20**: Initial project setup with Node.js, TypeScript, Discord.js v14, and Supabase client

## Features
- **Card Collection**: Drop and collect K-pop cards with rarity tiers
- **Economy System**: Earn coins through daily/weekly rewards and surfing
- **Marketplace**: Buy and sell cards with other users
- **Admin Tools**: Add, edit, and delete cards from the database
- **Slash Commands**: Modern Discord interaction system

## Commands
- `/start` - Initialize user profile
- `/drop` - Open a card pack
- `/inventory` - View your card collection
- `/daily` - Claim daily coin reward
- `/weekly` - Claim weekly coin reward
- `/surf` - Surf for coins
- `/shop` - Browse and buy card packs
- `/mp` - Access marketplace
- `/cooldowns` - Check cooldown timers
- `/addcard` - (Admin) Add new card
- `/deletecard` - (Admin) Remove card
- `/editcard` - (Admin) Modify card

## Project Architecture
- **Language**: TypeScript with Node.js 20
- **Framework**: Discord.js v14
- **Database**: Supabase (PostgreSQL)
- **Structure**:
  - `src/index.ts` - Bot initialization
  - `src/commands/` - Slash command handlers
  - `src/database/` - Supabase client and schema
  - `src/utils/` - Helper functions

## Environment Variables
- `DISCORD_TOKEN` - Discord bot token from Developer Portal
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_KEY` - Supabase anon/public key
