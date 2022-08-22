import {
  Client,
  InternalDiscordGatewayAdapterCreator,
  Message,
  MessageFlags,
} from "discord.js";
import { commandPrefix } from "./configs";
import { BotClient } from "./singletons/discord-client";
import { JukeBox } from "./singletons/jukebox";
import { YoutubeClient } from "./singletons/youtube-api-client";
import { parseMessageCommands } from "./util";

interface iInfoForVoiceChannelConnection {
  guildId: string;
  voiceChannelId: string;
  adapterCreator: InternalDiscordGatewayAdapterCreator;
}

async function getVoiceChannelInfoFromMessage(
  message: Message<boolean>,
  client: Client
): Promise<{
  info: iInfoForVoiceChannelConnection | null;
  error: Error | null;
}> {
  if (message.guildId === null)
    return { info: null, error: Error("unable to find guild id") };
  const guild = client.guilds.cache.get(message.guildId);
  if (typeof guild === "undefined")
    return { info: null, error: Error("unable to find guild") };
  const senderMember = await guild.members.fetch(message.author);
  const vcID = senderMember.voice.channelId;
  if (vcID === null)
    return { info: null, error: Error("user is not in a voice channel") };

  return {
    info: {
      guildId: message.guildId,
      voiceChannelId: vcID,
      adapterCreator: guild.voiceAdapterCreator,
    },
    error: null,
  };
}

type CmdHandlerFunction = {
  (message: Message<boolean>): Promise<Error | null>;
};

interface iCmdNameAndInfoObj {
  [key: string]: {
    description: string;
    handler: CmdHandlerFunction;
  };
}

async function handlePlayCommand(
  message: Message<boolean>
): Promise<Error | null> {
  // Get youtube URL
  const { info: commandInfo, error: parseMessageError } = parseMessageCommands(
    message.content
  );

  const URLPositionalArgumentIdx = 0;

  if (parseMessageError !== null) return parseMessageError;

  // Try to unpause if no argument
  if (commandInfo.arguments.length === 0) {
    JukeBox.unpause(message);
    message.channel.send("**Lanjut yook**");
    return null;
  }

  if (commandInfo.arguments.length < URLPositionalArgumentIdx + 1)
    return Error("unable to find URL for video");

  const youtubeURL = commandInfo.arguments[URLPositionalArgumentIdx];

  // Get URL title
  const youtubeClient = YoutubeClient.getClient();

  const { title, error: getTitleError } = await youtubeClient.getTitleFromURL(
    youtubeURL
  );
  if (getTitleError !== null) {
    return Error("unable to get video title");
  }

  // Connect to voice chat if not yet
  const client = BotClient.client;

  // Parse message to get necessary info for voice channel
  const { info: voiceChannelInfo, error: voiceChannelInfoError } =
    await getVoiceChannelInfoFromMessage(message, client);

  if (voiceChannelInfoError !== null) {
    return voiceChannelInfoError;
  }

  if (voiceChannelInfo === null) {
    return Error("unable to get necessary message data to play music");
  }

  // Set voice channel connection
  const addConnectionError = JukeBox.addVoiceChannelConnection(
    voiceChannelInfo.voiceChannelId,
    voiceChannelInfo.guildId,
    voiceChannelInfo.adapterCreator,
    message
  );

  if (addConnectionError !== null) {
    return Error("unable to connect to voice channel");
  }

  JukeBox.playGeneric(
    {
      title,
      youtubeURL,
    },
    message
  );

  return null;
}

async function handleAddNextCommand(
  message: Message<boolean>
): Promise<Error | null> {
  // Get youtube URL
  const { info: commandInfo, error: parseMessageError } = parseMessageCommands(
    message.content
  );

  const URLPositionalArgumentIdx = 0;

  if (parseMessageError !== null) return parseMessageError;

  if (commandInfo.arguments.length < URLPositionalArgumentIdx + 1)
    return Error("unable to find URL for video");

  const youtubeURL = commandInfo.arguments[URLPositionalArgumentIdx];

  // Get youtube URL title
  const youtubeClient = YoutubeClient.getClient();

  const { title, error: getTitleError } = await youtubeClient.getTitleFromURL(
    youtubeURL
  );
  if (getTitleError) {
    return Error("unable to get video title");
  }

  JukeBox.addToNext({ title, youtubeURL }, message);
  message.channel.send(
    `**Sudah masuk ya request lagunya buat habis ini**: ${title}`
  );
  return null;
}

async function handlePauseCommand(
  message: Message<boolean>
): Promise<Error | null> {
  JukeBox.pause(message);
  message.channel.send("**Bentar, rehat dulu**");
  return null;
}

async function handleNextCommand(
  message: Message<boolean>
): Promise<Error | null> {
  JukeBox.publicPlayNext(message);
  return null;
}

async function handleStatusCommand(
  message: Message<boolean>
): Promise<Error | null> {
  const { nowPlaying, trackQueue } = JukeBox.getStatus(message);

  // Prepare string to send
  const strToSend = `**Status Panggung Diamond**

Lagu yang lagi main: ${nowPlaying?.title || "Lagi istirahat"}

Antrian lagu:

${
  trackQueue.length > 0
    ? trackQueue
        .map((cTrackInfo, index) => `${index + 1}.\t${cTrackInfo.title}`)
        .join("\n")
    : "**Antrian kosong**"
}`;

  message.channel.send({
    content: strToSend,
    flags: MessageFlags.SuppressEmbeds,
  });

  return null;
}

async function handleHelpCommand(
  message: Message<boolean>
): Promise<Error | null> {
  // Generate string to be sent
  const commandListAndDescriptionStrArr: Array<string> = [];

  const cmdKeys = Object.keys(commandNameAndHandlerDict);

  cmdKeys.sort().forEach((cKey) => {
    const cmdInfoStr = `${cKey} - ${commandNameAndHandlerDict[cKey].description}`;
    commandListAndDescriptionStrArr.push(cmdInfoStr);
  });

  // Finalize help string
  const helpStr = `**List of commands for Panggung Diamond**
Commands must be prefixed by "${commandPrefix}" character

${commandListAndDescriptionStrArr.join("\n")}`;

  try {
    await message.channel.send(helpStr);
  } catch {
    return Error("unable to send help information");
  }

  return null;
}

async function handleKickCommand(
  message: Message<boolean>
): Promise<Error | null> {
  JukeBox.completelyStop();

  message.channel.send("Makasih om tante, silahkan dinikmati makanannya...");

  return null;
}

// Register command here
export const commandNameAndHandlerDict: iCmdNameAndInfoObj = {
  play: {
    description:
      "Plays youtube URL separated by a space. Example: !play (youtube_url)",
    handler: handlePlayCommand,
  },
  addNext: {
    description: "Adds youtube URL to the next line in queue",
    handler: handleAddNextCommand,
  },
  pause: {
    description: "Pauses currently playing track",
    handler: handlePauseCommand,
  },

  next: {
    description: "Skips current track and plays the next track",
    handler: handleNextCommand,
  },

  status: {
    description: "Gets current track information",
    handler: handleStatusCommand,
  },
  help: {
    description: "Shows list of commands and what they do",
    handler: handleHelpCommand,
  },
  kick: {
    description: "Remove bot from channel and stop player",
    handler: handleKickCommand,
  },
};
