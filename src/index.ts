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
      console.log(`<:DSwhitecheck:1416237178694139934> Loaded command: ${command.data.name}`);
    } else {
      console.log(`⚠️  Skipped ${file}: missing data or execute`);
    }
  }
}

async function registerCommands() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;

  if (!token || !clientId) {
    console.error('<:DSwhiteno:1416237223979782306> Missing DISCORD_TOKEN or DISCORD_CLIENT_ID environment variables!');
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

    console.log('<:DSwhitecheck:1416237178694139934> Successfully registered slash commands globally!');
  } catch (error) {
    console.error('<:DSwhiteno:1416237223979782306> Error registering commands:', error);
  }
}

client.once(Events.ClientReady, async (c) => {
  console.log(`<:DSwhitecheck:1416237178694139934> Bot is online as ${c.user.tag}!`);
  console.log(`📊 Serving ${commands.size} commands`);
  console.log(`🏠 Connected to ${c.guilds.cache.size} servers`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton()) {
    // Handle pagination buttons
    if (interaction.customId.startsWith('inv_')) {
      await handleInventoryButton(interaction);
    }
    // Handle gift confirmation buttons
    if (interaction.customId.startsWith('gift_')) {
      await handleGiftButton(interaction);
    }
    // Handle staff gift confirmation buttons
    if (interaction.customId.startsWith('staffgift_')) {
      await handleStaffGiftButton(interaction);
    }
    // Handle collect pagination buttons
    if (interaction.customId.startsWith('collect_')) {
      await handleCollectButton(interaction);
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);

  if (!command) {
    console.error(`<:DSwhiteno:1416237223979782306> Command not found: ${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction);
    console.log(`<:DSwhitecheck:1416237178694139934> ${interaction.user.tag} used /${interaction.commandName}`);
  } catch (error) {
    console.error(`<:DSwhiteno:1416237223979782306> Error executing ${interaction.commandName}:`, error);
    
    const errorMessage = { content: '<:DSwhiteno:1416237223979782306> An error occurred while executing this command!', ephemeral: true };
    
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
});

async function handleInventoryButton(interaction: any) {
  const { supabase } = await import('./database/supabase.js');
  const { mergeCardImages } = await import('./utils/imageUtils.js');
  const { EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');

  try {
    await interaction.deferUpdate();

    const parts = interaction.customId.split('_');
    const action = parts[1]; // 'prev' or 'next' or 'page'
    
    if (action === 'page') return; // Just a display button

    const userId = parts[2];
    const rarityFilter = parts[3] === 'all' ? null : parseInt(parts[3]);
    const groupFilter = parts[4] === 'all' ? null : parts[4];

    // Only allow user to interact with their own inventory
    if (interaction.user.id !== userId) {
      await interaction.followUp({ content: '<:DSwhiteno:1416237223979782306> This is not your inventory!', ephemeral: true });
      return;
    }

    // Get user and inventory
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!user) return;

    let query = supabase
      .from('inventory')
      .select(`
        quantity,
        cards (
          card_id,
          name,
          group,
          era,
          rarity,
          cardcode,
          image_url
        )
      `)
      .eq('user_id', userId);

    const { data: inventory } = await query;
    if (!inventory || inventory.length === 0) return;

    // Apply filters
    let filteredInventory = inventory;
    if (rarityFilter !== null) {
      filteredInventory = filteredInventory.filter((item: any) => item.cards.rarity === rarityFilter);
    }
    if (groupFilter) {
      filteredInventory = filteredInventory.filter((item: any) => 
        item.cards.group.toLowerCase() === groupFilter.toLowerCase()
      );
    }

    // Get current page from message
    const currentMessage = interaction.message;
    const pageMatch = currentMessage.embeds[0]?.timestamp?.toString() || '1 / 1';
    const pageText = currentMessage.components[0]?.components[1]?.label || '1 / 1';
    const [currentPage] = pageText.split(' / ').map(Number);

    const CARDS_PER_PAGE = 3;
    const totalPages = Math.ceil(filteredInventory.length / CARDS_PER_PAGE);
    let newPage = currentPage;

    if (action === 'prev') newPage = Math.max(1, currentPage - 1);
    if (action === 'next') newPage = Math.min(totalPages, currentPage + 1);

    const startIndex = (newPage - 1) * CARDS_PER_PAGE;
    const endIndex = startIndex + CARDS_PER_PAGE;
    const pageCards = filteredInventory.slice(startIndex, endIndex);

    const cardList = pageCards
      .map((item: any, index: number) => {
        const card = item.cards;
        const eraText = card.era ? ` • ${card.era}` : '';
        return `**Card ${index + 1}:** ${card.name} (${card.group}${eraText}) • \`${card.cardcode}\` • Qty: ${item.quantity}`;
      })
      .join('\n');

    let attachment = null;
    try {
      const imageUrls = pageCards
        .map((item: any) => item.cards.image_url)
        .filter((url: string) => url);

      if (imageUrls.length > 0) {
        const mergedImageBuffer = await mergeCardImages(imageUrls);
        attachment = new AttachmentBuilder(mergedImageBuffer, { name: 'inventory_cards.png' });
      }
    } catch (error) {
      console.error('Error merging images:', error);
    }

    const embed = new EmbedBuilder()
      .setColor(0xff69b4)
      .setTitle('📦 Your K-pop Card Collection')
      .setDescription(cardList)
      .setTimestamp();

    if (attachment) {
      embed.setImage('attachment://inventory_cards.png');
    }

    // Create pagination buttons
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`inv_prev_${userId}_${rarityFilter || 'all'}_${groupFilter || 'all'}`)
          .setLabel('← Previous')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(newPage === 1),
        new ButtonBuilder()
          .setCustomId(`inv_page`)
          .setLabel(`${newPage} / ${totalPages}`)
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(`inv_next_${userId}_${rarityFilter || 'all'}_${groupFilter || 'all'}`)
          .setLabel('Next →')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(newPage === totalPages)
      );

    if (attachment) {
      await interaction.editReply({ embeds: [embed], files: [attachment], components: [row] });
    } else {
      await interaction.editReply({ embeds: [embed], components: [row] });
    }
  } catch (error) {
    console.error('Error handling inventory button:', error);
    await interaction.followUp({ content: '<:DSwhiteno:1416237223979782306> An error occurred!', ephemeral: true });
  }
}

async function handleGiftButton(interaction: any) {
  const { supabase } = await import('./database/supabase.js');
  const { EmbedBuilder } = await import('discord.js');

  try {
    const action = interaction.customId.split('_')[1]; // 'confirm' or 'cancel'

    if (action === 'cancel') {
      await interaction.update({ content: '<:DSwhiteno:1416237223979782306> Gift cancelled!', components: [] });
      return;
    }

    if (action === 'confirm') {
      await interaction.deferUpdate();

      const senderUserId = interaction.customId.split('_')[2];
      const receiverUserId = interaction.customId.split('_')[3];

      // Only allow sender to confirm
      if (interaction.user.id !== senderUserId) {
        await interaction.followUp({ content: '<:DSwhiteno:1416237223979782306> Only the sender can confirm this gift!', ephemeral: true });
        return;
      }

      // Extract card codes from the embed description
      const embed = interaction.message.embeds[0];
      const description = embed.description;
      const lines = description.split('\n').slice(1); // Skip the "Send to..." line
      
      for (const line of lines) {
        const match = line.match(/`([^`]+)`/);
        if (match) {
          const cardcode = match[1].toUpperCase();

          // Find the card
          const { data: card } = await supabase
            .from('cards')
            .select('*')
            .eq('cardcode', cardcode)
            .single();

          if (!card) continue;

          // Check sender has the card
          const { data: senderInventory } = await supabase
            .from('inventory')
            .select('*')
            .eq('user_id', senderUserId)
            .eq('card_id', card.card_id)
            .single();

          if (!senderInventory || senderInventory.quantity < 1) continue;

          // Update sender inventory
          const newSenderQuantity = senderInventory.quantity - 1;
          if (newSenderQuantity > 0) {
            await supabase
              .from('inventory')
              .update({ quantity: newSenderQuantity })
              .eq('id', senderInventory.id);
          } else {
            await supabase
              .from('inventory')
              .delete()
              .eq('id', senderInventory.id);
          }

          // Update receiver inventory
          const { data: receiverInventory } = await supabase
            .from('inventory')
            .select('*')
            .eq('user_id', receiverUserId)
            .eq('card_id', card.card_id)
            .single();

          if (receiverInventory) {
            await supabase
              .from('inventory')
              .update({ quantity: receiverInventory.quantity + 1 })
              .eq('id', receiverInventory.id);
          } else {
            await supabase
              .from('inventory')
              .insert({
                user_id: receiverUserId,
                card_id: card.card_id,
                quantity: 1
              });
          }
        }
      }

      const resultEmbed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('<:DSwhitecheck:1416237178694139934> Gift Sent!')
        .setDescription('🎁 Your gift has been delivered!')
        .setTimestamp();

      await interaction.editReply({ embeds: [resultEmbed], components: [] });
    }
  } catch (error) {
    console.error('Error handling gift button:', error);
    await interaction.followUp({ content: '<:DSwhiteno:1416237223979782306> An error occurred!', ephemeral: true });
  }
}

async function handleStaffGiftButton(interaction: any) {
  const { supabase } = await import('./database/supabase.js');
  const { EmbedBuilder, PermissionFlagsBits } = await import('discord.js');

  try {
    const action = interaction.customId.split('_')[1]; // 'confirm' or 'cancel'

    if (action === 'cancel') {
      await interaction.update({ content: '<:DSwhiteno:1416237223979782306> Staff gift cancelled!', components: [] });
      return;
    }

    if (action === 'confirm') {
      await interaction.deferUpdate();

      // Check if sender is admin
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.followUp({ content: '<:DSwhiteno:1416237223979782306> This command is staff only!', ephemeral: true });
        return;
      }

      const receiverUserId = interaction.customId.split('_')[3];

      // Extract card codes from the embed description
      const embed = interaction.message.embeds[0];
      const description = embed.description;
      const lines = description.split('\n').slice(1); // Skip the "Send to..." line
      
      for (const line of lines) {
        const match = line.match(/`([^`]+)`/);
        if (match) {
          const cardcode = match[1].toUpperCase();

          // Find the card
          const { data: card } = await supabase
            .from('cards')
            .select('*')
            .eq('cardcode', cardcode)
            .single();

          if (!card) continue;

          // Update receiver inventory
          const { data: receiverInventory } = await supabase
            .from('inventory')
            .select('*')
            .eq('user_id', receiverUserId)
            .eq('card_id', card.card_id)
            .single();

          if (receiverInventory) {
            await supabase
              .from('inventory')
              .update({ quantity: receiverInventory.quantity + 1 })
              .eq('id', receiverInventory.id);
          } else {
            await supabase
              .from('inventory')
              .insert({
                user_id: receiverUserId,
                card_id: card.card_id,
                quantity: 1
              });
          }
        }
      }

      const resultEmbed = new EmbedBuilder()
        .setColor(0xff00ff)
        .setTitle('<:DSwhitecheck:1416237178694139934> Staff Gift Sent!')
        .setDescription('🎁 Your staff gift has been delivered!')
        .setTimestamp();

      await interaction.editReply({ embeds: [resultEmbed], components: [] });
    }
  } catch (error) {
    console.error('Error handling staff gift button:', error);
    await interaction.followUp({ content: '<:DSwhiteno:1416237223979782306> An error occurred!', ephemeral: true });
  }
}

async function handleCollectButton(interaction: any) {
  const { supabase } = await import('./database/supabase.js');
  const { getRarityEmoji } = await import('./utils/cards.js');
  const { mergeCardImages } = await import('./utils/imageUtils.js');
  const { EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');

  try {
    const action = interaction.customId.split('_')[1]; // 'next' or 'prev'
    const userId = interaction.customId.split('_')[2];
    const idolFilter = interaction.customId.split('_')[3] === 'all' ? null : interaction.customId.split('_')[3];
    const groupFilter = interaction.customId.split('_')[4] === 'all' ? null : interaction.customId.split('_')[4];
    const eraFilter = interaction.customId.split('_')[5] === 'all' ? null : interaction.customId.split('_')[5];
    const rarityFilter = interaction.customId.split('_')[6] === 'all' ? null : parseInt(interaction.customId.split('_')[6]);

    await interaction.deferUpdate();

    // Get all cards based on filters
    let query = supabase.from('cards').select('*');
    
    if (idolFilter) {
      query = query.ilike('name', `%${idolFilter}%`);
    }
    if (groupFilter) {
      query = query.ilike('group', `%${groupFilter}%`);
    }
    if (eraFilter) {
      query = query.ilike('era', `%${eraFilter}%`);
    }
    if (rarityFilter) {
      query = query.eq('rarity', rarityFilter);
    }

    const { data: allCards } = await query;

    if (!allCards || allCards.length === 0) {
      await interaction.editReply({ content: '<:DSwhiteno:1416237223979782306> No cards match your filters!' });
      return;
    }

    // Get user's inventory
    const { data: userInventory } = await supabase
      .from('inventory')
      .select('card_id')
      .eq('user_id', userId);

    const userCardIds = new Set(userInventory?.map(item => item.card_id) || []);

    const totalPages = Math.ceil(allCards.length / 5);
    const currentPageText = interaction.message.embeds[0]?.footer?.text || 'Page 1 / 1';
    const currentPage = parseInt(currentPageText.split(' ')[1]);
    let newPage = currentPage;

    if (action === 'next') {
      newPage = Math.min(currentPage + 1, totalPages);
    } else if (action === 'prev') {
      newPage = Math.max(currentPage - 1, 1);
    }

    const startIndex = (newPage - 1) * 5;
    const endIndex = startIndex + 5;
    const pageCards = allCards.slice(startIndex, endIndex);

    const cardList = pageCards
      .map((card: any) => {
        const hasCard = userCardIds.has(card.card_id);
        const checkMark = hasCard ? '<:DSwhitecheck:1416237178694139934>' : '<:DSwhiteno:1416237223979782306>';
        const rarityEmoji = getRarityEmoji(card.rarity);
        const eraText = card.era ? ` • ${card.era}` : '';
        return `${checkMark} **${card.name}** (${card.group}) ${rarityEmoji}${eraText} • \`${card.cardcode}\``;
      })
      .join('\n');

    let attachment = null;
    try {
      const imageUrls = pageCards
        .filter((card: any) => card.image_url)
        .map((card: any) => card.image_url);

      if (imageUrls.length > 0) {
        const mergedImageBuffer = await mergeCardImages(imageUrls);
        attachment = new AttachmentBuilder(mergedImageBuffer, { name: 'collect_cards.png' });
      }
    } catch (error) {
      console.error('Error merging images:', error);
    }

    const filterText = [
      idolFilter && `Idol: ${idolFilter}`,
      groupFilter && `Group: ${groupFilter}`,
      eraFilter && `Era: ${eraFilter}`,
      rarityFilter && `Rarity: ${rarityFilter}★`
    ].filter(Boolean).join(' • ') || 'No filters';

    const embed = new EmbedBuilder()
      .setColor(0x87ceeb)
      .setTitle('<:1_flower:1436124715797315687> Card Collection')
      .setDescription(cardList || 'No cards on this page')
      .addFields(
        { name: 'Filters', value: filterText, inline: false },
        { name: 'Progress', value: `${userCardIds.size} cards collected`, inline: true },
        { name: 'Total Available', value: `${allCards.length} cards`, inline: true }
      )
      .setFooter({ text: `Page ${newPage} / ${totalPages}` })
      .setTimestamp();

    if (attachment) {
      embed.setImage('attachment://collect_cards.png');
    }

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`collect_prev_${userId}_${idolFilter || 'all'}_${groupFilter || 'all'}_${eraFilter || 'all'}_${rarityFilter || 'all'}`)
          .setLabel('← Previous')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(newPage === 1),
        new ButtonBuilder()
          .setCustomId(`collect_page`)
          .setLabel(`${newPage} / ${totalPages}`)
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(`collect_next_${userId}_${idolFilter || 'all'}_${groupFilter || 'all'}_${eraFilter || 'all'}_${rarityFilter || 'all'}`)
          .setLabel('Next →')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(newPage === totalPages)
      );

    if (attachment) {
      await interaction.editReply({ embeds: [embed], files: [attachment], components: [row] });
    } else {
      await interaction.editReply({ embeds: [embed], components: [row] });
    }
  } catch (error) {
    console.error('Error handling collect button:', error);
    await interaction.followUp({ content: '<:DSwhiteno:1416237223979782306> An error occurred!', ephemeral: true });
  }
}

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
      console.log('<:DSwhitecheck:1416237178694139934> Commands reloaded and registered!');
      return true;
    } catch (error) {
      console.error('<:DSwhiteno:1416237223979782306> Error registering reloaded commands:', error);
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
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        ready: isReady,
        bot: isReady ? client.user?.tag : 'starting up',
        servers: client.guilds.cache.size,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  });

  server.listen(Number(PORT), '0.0.0.0', () => {
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
    console.error('<:DSwhiteno:1416237223979782306> Missing required environment variables!');
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
    console.error('<:DSwhiteno:1416237223979782306> Failed to login:', error);
    process.exit(1);
  }
}

main().catch(console.error);
