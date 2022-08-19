import { AudioPlayer, createAudioPlayer } from "@discordjs/voice";
import { Client, GatewayIntentBits } from "discord.js";

// Client singleton
export class BotClient {
  static readonly client: Client = BotClient.getDiscordClient();

  private static getDiscordClient() {
    console.log("Calling get discord client");
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

// Music player singleton
export class MusicPlayer {
  static readonly player: AudioPlayer = MusicPlayer.getAudioPlayer();

  private static getAudioPlayer() {
    console.log("Getting audio player");
    const player = createAudioPlayer();

    if (typeof player === "undefined")
      throw "unable to initiate music player bot";
    return player;
  }
}
