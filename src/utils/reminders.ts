
import { Client, TextChannel, EmbedBuilder } from 'discord.js';

interface Reminder {
  userId: string;
  channelId: string;
  commandName: string;
  expiresAt: number;
}

const activeReminders = new Map<string, NodeJS.Timeout>();

export function scheduleReminder(
  client: Client,
  userId: string,
  channelId: string,
  commandName: string,
  cooldownMs: number
) {
  const reminderId = `${userId}-${commandName}`;
  
  // Cancel existing reminder if any
  if (activeReminders.has(reminderId)) {
    clearTimeout(activeReminders.get(reminderId)!);
  }

  // Schedule new reminder
  const timeout = setTimeout(async () => {
    try {
      const channel = await client.channels.fetch(channelId) as TextChannel;
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('⏰ Cooldown Ready!')
        .setDescription(`<@${userId}> Your **/${commandName}** command is ready to use again!`)
        .setTimestamp();

      await channel.send({ embeds: [embed] });
      activeReminders.delete(reminderId);
    } catch (error) {
      console.error('Error sending reminder:', error);
    }
  }, cooldownMs);

  activeReminders.set(reminderId, timeout);
}

export function cancelReminder(userId: string, commandName: string) {
  const reminderId = `${userId}-${commandName}`;
  if (activeReminders.has(reminderId)) {
    clearTimeout(activeReminders.get(reminderId)!);
    activeReminders.delete(reminderId);
  }
}
