import {
  AudioPlayer,
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  PlayerSubscription,
  VoiceConnection,
  VoiceConnectionStatus,
} from "@discordjs/voice";
import {
  Client,
  GatewayIntentBits,
  InternalDiscordGatewayAdapterCreator,
} from "discord.js";
import ytdl from "ytdl-core";

// Client singleton
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

interface iVoiceChannelConnectionInfo {
  connection: VoiceConnection;
  subscription: PlayerSubscription;
  guildId: string;
  channelId: string;
}

// Music player singleton
export class JukeBox {
  // Player properties
  static readonly player: AudioPlayer = JukeBox.getAudioPlayer();
  private static trackQueue: Array<string> = []; // Array of youtube URL to play in order
  private static nowPlaying: string; // Current youtube URL playing

  // Jukebox - voice channel connection
  private static voiceChannelConnection: iVoiceChannelConnectionInfo | null =
    null;
  private static IDLE_UNTIL_STOPPING_SECONDS = 2 * 60; // Set to 2 minute until stopping
  private static idleTimer: NodeJS.Timeout | null = null;

  // Initiate getAudioPlayer
  private static getAudioPlayer() {
    console.log("Getting audio player");
    const player = createAudioPlayer();

    if (typeof player === "undefined")
      throw "unable to initiate music player bot";

    player.on("error", (error) => {
      console.error("player error:", error);
    });

    player.addListener(AudioPlayerStatus.Playing, () => {
      // Clear idle timer if starting to play
      if (JukeBox.idleTimer === null) return;

      clearTimeout(JukeBox.idleTimer);
    });

    // On Idle behaviour
    player.addListener(AudioPlayerStatus.Idle, () => {
      // Automatically play next if there's a track in the queue
      if (JukeBox.trackQueue.length !== 0) {
        JukeBox.playNext();
      }

      // Set timeout, if idle for a certain period of time:
      JukeBox.idleTimer = setTimeout(
        JukeBox.completelyStop,
        JukeBox.IDLE_UNTIL_STOPPING_SECONDS
      );
    });

    return player;
  }

  private static completelyStop() {
    // 1. Stop player
    JukeBox.player.stop();

    // 2. Connection disconnect and destroy
    if (JukeBox.voiceChannelConnection === null) return;

    JukeBox.voiceChannelConnection.connection.disconnect();
    JukeBox.voiceChannelConnection.connection.destroy();

    // 3. Subscription unsubscribe
    JukeBox.voiceChannelConnection.subscription.unsubscribe();

    // 4. Set voiceChannelConnection to null
    JukeBox.voiceChannelConnection = null;
  }

  // Play youtube URL
  private static playURL(youtubeURL: string) {
    const audioResource = ytdl(youtubeURL, { filter: "audioonly" });

    JukeBox.player.play(createAudioResource(audioResource));
  }

  // Play first in the queue
  static playNext(): Error | null {
    if (this.trackQueue.length === 0) return Error("no song in queue");

    const urlToPlay = JukeBox.trackQueue[0];
    JukeBox.trackQueue = JukeBox.trackQueue.slice(1); // Remove first entry

    JukeBox.playURL(urlToPlay);
    JukeBox.nowPlaying = urlToPlay;

    return null;
  }

  // Add to queue
  static addToQueue(youtubeURL: string) {
    JukeBox.trackQueue.push(youtubeURL);
  }

  // Add new youtube URL at the front of queue
  static addToNext(youtubeURL: string) {
    JukeBox.trackQueue = [youtubeURL, ...JukeBox.trackQueue];
  }

  // Gets currently playing URL and track queue
  static getStatus(): { nowPlaying: string; trackQueue: Array<string> } {
    return {
      nowPlaying: JukeBox.nowPlaying,
      trackQueue: JukeBox.trackQueue,
    };
  }

  // Add voice connection to channel (and subscription too)
  static addVoiceChannelConnection(
    newChannelId: string,
    newGuildId: string,
    newAdapterCreator: InternalDiscordGatewayAdapterCreator
  ): Error | null {
    if (JukeBox.voiceChannelConnection !== null) {
      const { channelId: currentChannelId, guildId: currentGuildId } =
        JukeBox.voiceChannelConnection;
      if (newChannelId === currentChannelId && newGuildId === currentGuildId)
        return null; // No problems here

      // If different, return error
      return Error("Already has a current voice channel connection");
    }

    // Handle creation of new voice channel connection
    const connection = joinVoiceChannel({
      channelId: newChannelId,
      guildId: newGuildId,
      adapterCreator: newAdapterCreator,
    });

    // Add handler for disconnected case
    connection.addListener(
      VoiceConnectionStatus.Disconnected,
      JukeBox.completelyStop
    );

    connection.on("error", (error) => {
      console.error("voice connection error:", error);
    });

    const subscription = connection.subscribe(JukeBox.player);
    if (typeof subscription === "undefined")
      return Error(
        "unable to get subscription when connecting to voice channel"
      );

    const voiceChannelConnectionInfo: iVoiceChannelConnectionInfo = {
      connection,
      subscription,
      guildId: newGuildId,
      channelId: newChannelId,
    };

    JukeBox.voiceChannelConnection = voiceChannelConnectionInfo;
    return null;
  }
}
