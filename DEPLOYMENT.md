# Deployment Guide: Render + Uptime Robot

This guide will help you deploy your K-pop Card Bot to Render and set up monitoring with Uptime Robot.

## 📦 Prerequisites

Before you start, make sure you have:
- ✅ A Render account (render.com)
- ✅ An Uptime Robot account (uptimerobot.com) - Free tier works!
- ✅ Your Discord bot token
- ✅ Your Discord client ID
- ✅ Your Supabase URL and API key

## 🚀 Part 1: Deploy to Render

### Step 1: Push Your Code to GitHub

1. Create a new GitHub repository (if you haven't already)
2. Push your code to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin YOUR_GITHUB_REPO_URL
   git push -u origin main
   ```

### Step 2: Create a New Web Service on Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub account and select your repository
4. Render will automatically detect the `render.yaml` file

### Step 3: Configure Your Web Service

Render should auto-fill most settings from `render.yaml`, but verify:

- **Name**: `kpop-card-bot` (or your preferred name)
- **Runtime**: Node
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Plan**: Free (or your preferred plan)

### Step 4: Add Environment Variables

Click on **"Environment"** and add these variables:

| Variable Name | Value | Where to Get It |
|--------------|-------|-----------------|
| `DISCORD_TOKEN` | Your bot token | [Discord Developer Portal](https://discord.com/developers/applications) → Your App → Bot → Token |
| `DISCORD_CLIENT_ID` | Your application ID | Discord Developer Portal → Your App → General Information → Application ID |
| `SUPABASE_URL` | Your Supabase URL | [Supabase Dashboard](https://app.supabase.com/) → Your Project → Settings → API |
| `SUPABASE_KEY` | Your Supabase anon key | Supabase Dashboard → Your Project → Settings → API → `anon` `public` key |
| `NODE_ENV` | `production` | Just type "production" |

### Step 5: Deploy!

1. Click **"Create Web Service"**
2. Render will start building and deploying your bot
3. Wait for the deployment to complete (usually 2-5 minutes)
4. Your bot should now be online! 🎉

### Step 6: Get Your Health Check URL

Once deployed, your service will have a URL like:
```
https://kpop-card-bot.onrender.com
```

You can test the health check by visiting:
```
https://kpop-card-bot.onrender.com/health
```

You should see a JSON response like:
```json
{
  "status": "ok",
  "ready": true,
  "bot": "YourBotName#1234",
  "servers": 1,
  "uptime": 123.45,
  "timestamp": "2025-11-24T12:00:00.000Z"
}
```

**Note**: The health check always returns HTTP 200 OK. The `ready` field indicates whether the Discord bot has fully connected. During startup, you might see `"ready": false` and `"bot": "starting up"`, which is normal.

---

## 🔍 Part 2: Set Up Uptime Robot Monitoring

Uptime Robot will ping your bot every 5 minutes to make sure it stays online. This is important because Render's free tier can spin down after inactivity.

### Step 1: Create an Uptime Robot Account

1. Go to [uptimerobot.com](https://uptimerobot.com/)
2. Sign up for a free account
3. Verify your email

### Step 2: Add a New Monitor

1. Click **"+ Add New Monitor"**
2. Fill in the details:

   - **Monitor Type**: HTTP(s)
   - **Friendly Name**: `K-pop Card Bot` (or your preferred name)
   - **URL**: `https://kpop-card-bot.onrender.com/health` (use YOUR Render URL)
   - **Monitoring Interval**: 5 minutes (free tier)
   - **Monitor Timeout**: 30 seconds

3. Click **"Create Monitor"**

### Step 3: Configure Alerts (Optional)

You can set up alerts to notify you if your bot goes down:

1. Click on **"Alert Contacts"** in the sidebar
2. Add your email or SMS number
3. Go back to your monitor and edit it
4. Under **"Alert Contacts to Notify"**, select your contact
5. Save

### Step 4: Verify It's Working

1. Wait a few minutes for the first check
2. You should see a green checkmark ✅ next to your monitor
3. If it's red ❌, check your Render logs for errors

---

## 🎯 Important Notes

### Render Free Tier Limitations
- **Spins down after 15 minutes of inactivity**
  - Uptime Robot pings prevent this!
- **750 hours per month** (about 31 days)
  - More than enough for one bot
- **Cold starts** take 30-60 seconds
  - First request after sleep will be slow

### Keeping Your Bot Alive 24/7
With Uptime Robot pinging every 5 minutes, your bot will:
- ✅ Never spin down due to inactivity
- ✅ Restart automatically if it crashes
- ✅ Stay online 24/7 for free!

### Troubleshooting

**Bot won't start?**
- Check Render logs: Dashboard → Your Service → Logs
- Verify all environment variables are set correctly
- Make sure your Discord token is valid

**Uptime Robot shows "down"?**
- Check if your Render service is running
- Verify the health check URL is correct
- Check Render logs for errors

**Bot is online but not responding?**
- Make sure you invited the bot to your Discord server
- Check that bot has proper permissions
- Verify Discord commands are registered (check Render logs)

---

## 🔄 Updating Your Bot

Whenever you make changes:

1. Push to GitHub:
   ```bash
   git add .
   git commit -m "Your update message"
   git push
   ```

2. Render will automatically detect the changes and redeploy
3. Your bot will restart with the new code!

---

## 📊 Monitoring Your Bot

### Render Dashboard
- View logs in real-time
- Check deployment status
- Monitor resource usage

### Uptime Robot Dashboard
- See uptime percentage
- View response time graphs
- Check alert history

---

## ✅ Checklist

- [ ] Code pushed to GitHub
- [ ] Render web service created
- [ ] All environment variables added to Render
- [ ] Bot successfully deployed on Render
- [ ] Health check URL is accessible
- [ ] Uptime Robot monitor created
- [ ] Uptime Robot shows "up" status
- [ ] Bot is responding in Discord

---

## 🆘 Need Help?

- **Render Docs**: https://render.com/docs
- **Uptime Robot Docs**: https://uptimerobot.com/api/
- **Discord.js Guide**: https://discordjs.guide/

---

🎉 **Congratulations!** Your K-pop Card Bot is now deployed and monitored!
