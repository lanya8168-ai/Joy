import { Client, GatewayIntentBits, Collection, Events, REST, Routes } from 'discord.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdir } from 'fs/promises';
import { createServer } from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface Command {
  data: any;
  execute: (interaction: any) => Promise<void>;
}

(global as any).botState = { lockdownMode: false };

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const commands = new Collection<string, Command>();

async function loadCommands() {
  const commandsPath = join(__dirname, 'commands');
  const commandFiles = (await readdir(commandsPath)).filter(file => file.endsWith('.js'));
  commands.clear();
  for (const file of commandFiles) {
    const filePath = join(commandsPath, file);
    const command = await import(`${filePath}?t=${Date.now()}`);
    if ('data' in command && 'execute' in command) {
      commands.set(command.data.name, command);
      console.log(`<:cottage:1457128646274973766> Loaded command: ${command.data.name}`);
    }
  }
}

async function registerCommands() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!token || !clientId) { 
    console.error('Missing env vars'); 
    process.exit(1); 
  }

  const rest = new REST().setToken(token);
  const commandData = Array.from(commands.values()).map(cmd => cmd.data.toJSON());

  try {
    await rest.put(Routes.applicationCommands(clientId), { body: commandData });
    console.log('<:cottage:1457128646274973766> Successfully registered slash commands!');
  } catch (error) { 
    console.error('Error registering commands:', error); 
  }
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
  }
});

/* =========================
   RENDER PORT FIX START
========================= */

const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running.');
});

const PORT = process.env.PORT || 3000;

// START SERVER FIRST (important)
server.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

// THEN start the bot
async function start() {
  try {
    await loadCommands();
    await registerCommands();
    await client.login(process.env.DISCORD_TOKEN);
    console.log("Discord bot logged in successfully.");
  } catch (err) {
    console.error("Startup error:", err);
  }
}

start();