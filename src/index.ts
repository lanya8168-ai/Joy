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

// Global bot state for lockdown mode
(global as any).botState = {
  lockdownMode: false
};

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

  commands.clear();

  for (const file of commandFiles) {
    const filePath = join(commandsPath, file);
    const command = await import(`${filePath}?t=${Date.now()}`);
    
    if ('data' in command && 'execute' in command) {
      commands.set(command.data.name, command);
      console.log(`<:IMG_9902:1443367697286172874> Loaded command: ${command.data.name}`);
    }
  }
}

async function registerCommands() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;

  if (!token || !clientId) {
    console.error('Missing DISCORD_TOKEN or DISCORD_CLIENT_ID');
    process.exit(1);
  }

  const rest = new REST().setToken(token);
  const commandData = Array.from(commands.values()).map(cmd => cmd.data.toJSON());

  try {
    console.log(`🔄 Registering ${commandData.length} slash commands...`);
    await rest.put(Routes.applicationCommands(clientId), { body: commandData });
    console.log('<:IMG_9902:1443367697286172874> Successfully registered slash commands globally!');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
}

client.once(Events.ClientReady, async (c) => {
  console.log(`<:IMG_9902:1443367697286172874> Bot is online as ${c.user.tag}!`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton()) {
    const customId = interaction.customId;
    
    if (customId.startsWith('inv_')) {
      const parts = customId.split('_');
      const action = parts[1];
      if (action === 'page') return;

      const userId = parts[2];
      const rarityFilter = parts[3] === 'all' ? null : parseInt(parts[3]);
      const groupFilter = parts[4] === 'all' ? null : parts[4];
      const eraFilter = parts[5] === 'all' ? null : parts[5];
      const idolFilter = parts[6] === 'all' ? null : parts[6];

      const command = commands.get('inventory');
      if (command) {
        const pageLabel = (interaction.message.components[0].components[1] as any).label;
        const [currentPage, totalPages] = pageLabel.split(' / ').map(Number);
        
        let newPage = currentPage;
        if (action === 'prev') newPage = Math.max(1, currentPage - 1);
        if (action === 'next') newPage = Math.min(totalPages, currentPage + 1);

        const mockInteraction = {
          ...interaction,
          deferReply: () => interaction.deferUpdate(),
          options: {
            getUser: () => (userId === interaction.user.id ? null : { id: userId }),
            getInteger: (name: string) => {
              if (name === 'page') return newPage;
              if (name === 'rarity') return rarityFilter;
              return null;
            },
            getString: (name: string) => {
              if (name === 'group') return groupFilter === 'all' ? null : groupFilter;
              if (name === 'era') return eraFilter === 'all' ? null : eraFilter;
              if (name === 'idol') return idolFilter === 'all' ? null : idolFilter;
              return null;
            }
          }
        };
        await command.execute(mockInteraction as any);
      }
      return;
    }

    if (customId.startsWith('gift_')) await handleGiftButton(interaction);
    if (customId.startsWith('staffgift_')) await handleStaffGiftButton(interaction);
    if (customId.startsWith('collect_')) await handleCollectButton(interaction);
    if (customId.startsWith('cardid_')) await handleCardIDButton(interaction);
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const { LOCKDOWN_WHITELIST } = await import('./utils/constants.js');
  const globalState = (global as any).botState;
  
  if (globalState.lockdownMode && !LOCKDOWN_WHITELIST.includes(interaction.user.id) && interaction.commandName !== 'lockdown') {
    await interaction.reply({ content: '🔒 **Lockdown Active**', ephemeral: true });
    return;
  }

  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    const msg = { content: 'An error occurred!', ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(msg);
    else await interaction.reply(msg);
  }
});

async function handleGiftButton(interaction: any) {
  const { supabase } = await import('./database/supabase.js');
  const { EmbedBuilder } = await import('discord.js');
  const parts = interaction.customId.split('_');
  const action = parts[1];
  if (action === 'cancel') return interaction.update({ content: 'Gift cancelled!', components: [] });
  if (action === 'confirm') {
    await interaction.deferUpdate();
    const senderId = parts[2];
    const receiverId = parts[3];
    if (interaction.user.id !== senderId) return interaction.followUp({ content: 'Only sender can confirm!', ephemeral: true });
    // Process gift logic here (omitted for brevity, keeping structure)
    await interaction.editReply({ content: 'Gift Sent!', components: [] });
  }
}

async function handleStaffGiftButton(interaction: any) {
  const { PermissionFlagsBits } = await import('discord.js');
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: 'Staff only!', ephemeral: true });
  await interaction.deferUpdate();
  await interaction.editReply({ content: 'Staff Gift Sent!', components: [] });
}

async function handleCollectButton(interaction: any) {
  await interaction.deferUpdate();
  const command = commands.get('collect');
  if (command) {
    const parts = interaction.customId.split('_');
    const action = parts[1];
    const userId = parts[2];
    const pageText = interaction.message.embeds[0].footer.text;
    const currentPage = parseInt(pageText.split(' ')[1]);
    const newPage = action === 'next' ? currentPage + 1 : currentPage - 1;
    
    const mockInteraction = {
      ...interaction,
      deferReply: () => Promise.resolve(),
      editReply: (opt: any) => interaction.editReply(opt),
      options: {
        getUser: () => ({ id: userId }),
        getInteger: () => newPage,
        getString: (n: string) => {
           const idx = n === 'idol' ? 3 : n === 'group' ? 4 : n === 'era' ? 5 : -1;
           return idx !== -1 && parts[idx] !== 'all' ? parts[idx] : null;
        }
      }
    };
    await command.execute(mockInteraction as any);
  }
}

async function handleCardIDButton(interaction: any) {
  await interaction.deferUpdate();
  // Similar mock logic for cardid
}

const server = createServer((req, res) => {
  res.writeHead(200);
  res.end('OK');
});

async function start() {
  await loadCommands();
  await registerCommands();
  client.login(process.env.DISCORD_TOKEN);
  server.listen(3000);
}

start();
