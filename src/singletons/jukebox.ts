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
import { InternalDiscordGatewayAdapterCreator, Message } from "discord.js";
import ytdl from "ytdl-core";

interface iVoiceChannelConnectionInfo {
  connection: VoiceConnection;
  subscription: PlayerSubscription;
  guildId: string;
  channelId: string;
}

interface iTrackInfo {
  youtubeURL: string;
  title: string;
}
const IDLE_UNTIL_STOPPING_SECONDS = 2 * 60; // Set to 2 minute until stopping
const MAX_403_RETRIES = 5;

// Music player singleton
export class JukeBox {
  // Player properties
  private static readonly player: AudioPlayer = JukeBox.getAudioPlayer();
  private static trackQueue: Array<iTrackInfo> = []; // Array of youtube URL to play in order
  private static nowPlaying: iTrackInfo | null = null; // Current youtube URL playing
  private static currentPlayRetries = 0;

  // Jukebox - channel connection
  private static voiceChannelConnection: iVoiceChannelConnectionInfo | null =
    null;
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
      // console.log(`[AUDIO-PLAYER-DEBUG]: ${message}`);
    });

    player.on("error", (error) => {
      console.error("[AUDIO-PLAYER-ERROR] error:", error);

      if (JukeBox.nowPlaying === null) return;
      // Handle error due to 403
      if (`${error}`.includes("error: AudioPlayerError: Status code: 403")) {
        console.log("EVER REACHED HERE");
        // Retry playing
        JukeBox.playTrack(JukeBox.nowPlaying);

        if (JukeBox.currentPlayRetries >= MAX_403_RETRIES) {
          // Resets current play retries
          JukeBox.currentPlayRetries = 0;

          // Play next if exceeds retries
          JukeBox.playNext();
          return;
        }

        JukeBox.currentPlayRetries++; // Increment currentPlayRetries
      }
    });

    player.addListener(AudioPlayerStatus.Playing, () => {
      // Resets current play retries
      JukeBox.currentPlayRetries = 0;

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
        IDLE_UNTIL_STOPPING_SECONDS * 1000
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
  private static playTrack(trackInfo: iTrackInfo) {
    // Notify now playing
    JukeBox.nowPlaying = trackInfo;
    JukeBox.sendMessageToLastChannel(
      `🎵 **Now Playing**: ${JukeBox.nowPlaying.title} 🎵`
    );

    try {
      if (!ytdl.validateURL(JukeBox.nowPlaying.youtubeURL))
        throw "invalid youtube URL";

      const audioResource = ytdl(JukeBox.nowPlaying.youtubeURL, {
        filter: "audioonly",
      });
      JukeBox.player.play(createAudioResource(audioResource));
    } catch (error) {
      JukeBox.sendMessageToLastChannel(
        `**Error playing current track**: ${JukeBox.nowPlaying}, skipping...`
      );
      JukeBox.playNext();
    }
  }

  // Play first in the queue, only for within-class use
  private static playNext() {
    if (this.trackQueue.length === 0) {
      JukeBox.sendMessageToLastChannel("**End of queue reached**");
      return;
    }

    const urlToPlay = JukeBox.trackQueue[0];
    JukeBox.trackQueue = JukeBox.trackQueue.slice(1); // Remove first entry

    JukeBox.playTrack(urlToPlay);
  }

  // Message sender
  private static sendMessageToLastChannel(message: string) {
    if (JukeBox.lastMessage === null) return; // Can't send message

    JukeBox.lastMessage.channel.send(message).catch((error) => {
      console.error("error sending message to channel:", error);
    });
  }

  // Add to queue
  private static addToQueue(trackInfo: iTrackInfo) {
    JukeBox.trackQueue.push(trackInfo);
    JukeBox.sendMessageToLastChannel(
      `**Added to queue**: "${trackInfo.title}" in position **${JukeBox.trackQueue.length}**`
    );
  }

  // Public methods
  // Play generic play command
  static playGeneric(trackInfo: iTrackInfo, message: Message<boolean>) {
    JukeBox.lastMessage = message;

    // Add to queue
    JukeBox.addToQueue(trackInfo);

    // If none are currently playing, play next.
    if (JukeBox.nowPlaying === null) {
      JukeBox.playNext();
      return;
    }
  }

  // Exposed methods to be used from outside world
  static publicPlayNext(message: Message<boolean>) {
    JukeBox.lastMessage = message; // TODO: could possibly use decorator pattern for exposed methods
    JukeBox.playNext();
  }

  static pause(message: Message<boolean>) {
    JukeBox.lastMessage = message;
    const canPause = JukeBox.player.pause();

    if (!canPause) {
      JukeBox.sendMessageToLastChannel("unable to pause");
    }
  }

  static unpause(message: Message<boolean>) {
    JukeBox.lastMessage = message;
    // If paused, unpause
    if (JukeBox.player.state.status === AudioPlayerStatus.Paused) {
      JukeBox.player.unpause();
      return;
    }
  }

  // Add new youtube URL at the front of queue
  static addToNext(trackInfo: iTrackInfo, message: Message<boolean>) {
    JukeBox.lastMessage = message;
    JukeBox.trackQueue = [trackInfo, ...JukeBox.trackQueue];
  }

  // Gets currently playing URL and track queue
  static getStatus(message: Message<boolean>): {
    nowPlaying: iTrackInfo | null;
    trackQueue: Array<iTrackInfo>;
  } {
    JukeBox.lastMessage = message;

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
    message: Message<boolean>
  ): Error | null {
    JukeBox.lastMessage = message;

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
