import { Client, GatewayIntentBits } from "discord.js";

// Discord bot client singleton
export class BotClient {
  static readonly client: Client = BotClient.getDiscordClient();

  private static getDiscordClient() {
    console.log("Getting discord client");
    return new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
      ],
    });
  }
}
