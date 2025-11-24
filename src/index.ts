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

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

const commands = new Collection<string, Command>();

async function loadCommands() {
  const commandsPath = join(__dirname, 'commands');
  const commandFiles = (await readdir(commandsPath)).filter(file => file.endsWith('.js'));

  // Clear existing commands
  commands.clear();

  for (const file of commandFiles) {
    const filePath = join(commandsPath, file);
    // Clear require cache to force reimport
    delete (globalThis as any)[filePath];
    const command = await import(`${filePath}?t=${Date.now()}`);
    
    if ('data' in command && 'execute' in command) {
      commands.set(command.data.name, command);
      console.log(`✅ Loaded command: ${command.data.name}`);
    } else {
      console.log(`⚠️  Skipped ${file}: missing data or execute`);
    }
  }
}

async function registerCommands() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;

  if (!token || !clientId) {
    console.error('❌ Missing DISCORD_TOKEN or DISCORD_CLIENT_ID environment variables!');
    console.log('\nPlease set these environment variables:');
    console.log('- DISCORD_TOKEN: Your bot token from Discord Developer Portal');
    console.log('- DISCORD_CLIENT_ID: Your bot\'s application ID');
    console.log('- SUPABASE_URL: Your Supabase project URL');
    console.log('- SUPABASE_KEY: Your Supabase anon key');
    process.exit(1);
  }

  const rest = new REST().setToken(token);
  const commandData = Array.from(commands.values()).map(cmd => cmd.data.toJSON());

  try {
    console.log(`🔄 Registering ${commandData.length} slash commands...`);

    await rest.put(
      Routes.applicationCommands(clientId),
      { body: commandData }
    );

    console.log('✅ Successfully registered slash commands globally!');
  } catch (error) {
    console.error('❌ Error registering commands:', error);
  }
}

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ Bot is online as ${c.user.tag}!`);
  console.log(`📊 Serving ${commands.size} commands`);
  console.log(`🏠 Connected to ${c.guilds.cache.size} servers`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);

  if (!command) {
    console.error(`❌ Command not found: ${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction);
    console.log(`✅ ${interaction.user.tag} used /${interaction.commandName}`);
  } catch (error) {
    console.error(`❌ Error executing ${interaction.commandName}:`, error);
    
    const errorMessage = { content: '❌ An error occurred while executing this command!', ephemeral: true };
    
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
});

// Expose reload function for admin commands
export async function reloadCommands() {
  console.log('🔄 Reloading commands...');
  await loadCommands();
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;

  if (token && clientId) {
    const rest = new REST().setToken(token);
    const commandData = Array.from(commands.values()).map(cmd => cmd.data.toJSON());

    try {
      await rest.put(
        Routes.applicationCommands(clientId),
        { body: commandData }
      );
      console.log('✅ Commands reloaded and registered!');
      return true;
    } catch (error) {
      console.error('❌ Error registering reloaded commands:', error);
      return false;
    }
  }
  return false;
}

function startHealthCheckServer() {
  const PORT = process.env.PORT || 3000;
  
  const server = createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
      const isReady = client.isReady();
      const status = isReady ? 200 : 503;
      
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: isReady ? 'ok' : 'not_ready',
        bot: isReady ? client.user?.tag : 'not logged in',
        servers: client.guilds.cache.size,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🏥 Health check server running on port ${PORT}`);
    console.log(`   Access at: http://localhost:${PORT}/health`);
  });
}

async function main() {
  console.log('🚀 Starting K-pop Card Bot...');
  
  const token = process.env.DISCORD_TOKEN;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  if (!token || !supabaseUrl || !supabaseKey) {
    console.error('❌ Missing required environment variables!');
    console.log('\nRequired environment variables:');
    console.log('- DISCORD_TOKEN: Your bot token');
    console.log('- DISCORD_CLIENT_ID: Your bot\'s application ID');
    console.log('- SUPABASE_URL: Your Supabase project URL');
    console.log('- SUPABASE_KEY: Your Supabase anon/public key');
    process.exit(1);
  }

  startHealthCheckServer();

  await loadCommands();
  await registerCommands();
  
  try {
    await client.login(token);
  } catch (error) {
    console.error('❌ Failed to login:', error);
    process.exit(1);
  }
}

main().catch(console.error);
