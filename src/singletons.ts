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
  Message,
  MessagePayload,
  MessageOptions,
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
  private static readonly player: AudioPlayer = JukeBox.getAudioPlayer();
  private static trackQueue: Array<string> = []; // Array of youtube URL to play in order
  private static nowPlaying: string = ""; // Current youtube URL playing

  // Jukebox - channel connection
  private static voiceChannelConnection: iVoiceChannelConnectionInfo | null =
    null;
  private static IDLE_UNTIL_STOPPING_SECONDS = 2 * 60; // Set to 2 minute until stopping
  private static idleTimer: NodeJS.Timeout | null = null;
  private static lastMessage: // last message instance
  Message<boolean> | null = null;

  // Sending message regarding errors should be done in the inner most functions.

  // Initiate getAudioPlayer
  private static getAudioPlayer() {
    console.log("Getting audio player");
    const player = createAudioPlayer();

    if (typeof player === "undefined")
      throw "unable to initiate music player bot";

    player.on("debug", (message) => {
      console.log(`[AUDIO-PLAYER-INFO]: ${message}`);
    });

    player.on("error", (error) => {
      console.error("[AUDIO-PLAYER-ERROR] error:", error);
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
        return;
      }

      // Set timeout, if idle for a certain period of time:
      JukeBox.idleTimer = setTimeout(
        JukeBox.completelyStop,
        JukeBox.IDLE_UNTIL_STOPPING_SECONDS * 1000
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
    // Notify now playing
    JukeBox.sendMessageToLastChannel(`**Now Playing**: ${youtubeURL} 🎵`);

    JukeBox.nowPlaying = youtubeURL;

    try {
      const audioResource = ytdl(youtubeURL, { filter: "audioonly" });
      JukeBox.player.play(createAudioResource(audioResource));
    } catch (error) {
      JukeBox.sendMessageToLastChannel(
        `Error playing current track: ${youtubeURL}, skipping...`
      );
      JukeBox.playNext();
    }
  }

  // Play first in the queue, only for within-class use
  private static playNext() {
    if (this.trackQueue.length === 0) {
      JukeBox.sendMessageToLastChannel("end of queue reached");
      return;
    }

    const urlToPlay = JukeBox.trackQueue[0];
    JukeBox.trackQueue = JukeBox.trackQueue.slice(1); // Remove first entry

    JukeBox.playURL(urlToPlay);
  }

  // Message sender
  private static sendMessageToLastChannel(message: string) {
    if (JukeBox.lastMessage === null) return; // Can't send message

    JukeBox.lastMessage.channel
      .send(message)
      .catch((error) => {
        console.error("error sending message to channel:", error);
      })
      .then((messageSentOk) => {
        console.log({ messageSentOk });
      }); // Send message
  }

  // Add to queue
  private static addToQueue(youtubeURL: string) {
    JukeBox.trackQueue.push(youtubeURL);
  }

  // Public methods
  // Play generic play command
  static playGeneric(
    youtubeURL: string,
    messageChannelSenderFunc: Message<boolean>
  ) {
    JukeBox.lastMessage = messageChannelSenderFunc;

    // Add to queue
    JukeBox.addToQueue(youtubeURL);

    // If none are currently playing, play next.
    if (JukeBox.nowPlaying === "") {
      JukeBox.playNext();
      return;
    }
  }

  // Exposed methods to be used from outside world
  static publicPlayNext(messageChannelSenderFunc: Message<boolean>) {
    JukeBox.lastMessage = messageChannelSenderFunc; // TODO: could possibly use decorator pattern for exposed methods
    JukeBox.playNext();
  }

  static pause(messageChannelSenderFunc: Message<boolean>) {
    JukeBox.lastMessage = messageChannelSenderFunc;
    const canPause = JukeBox.player.pause();

    if (!canPause) {
      JukeBox.sendMessageToLastChannel("unable to pause");
    }
  }

  // Add new youtube URL at the front of queue
  static addToNext(
    youtubeURL: string,
    messageChannelSenderFunc: Message<boolean>
  ) {
    JukeBox.lastMessage = messageChannelSenderFunc;
    JukeBox.trackQueue = [youtubeURL, ...JukeBox.trackQueue];
  }

  // Gets currently playing URL and track queue
  static getStatus(messageChannelSenderFunc: Message<boolean>): {
    nowPlaying: string;
    trackQueue: Array<string>;
  } {
    JukeBox.lastMessage = messageChannelSenderFunc;

    return {
      nowPlaying: JukeBox.nowPlaying,
      trackQueue: JukeBox.trackQueue,
    };
  }

  // Add voice connection to channel (and subscription too)
  static addVoiceChannelConnection(
    newChannelId: string,
    newGuildId: string,
    newAdapterCreator: InternalDiscordGatewayAdapterCreator,
    messageChannelSenderFunc: Message<boolean>
  ): Error | null {
    JukeBox.lastMessage = messageChannelSenderFunc;

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
