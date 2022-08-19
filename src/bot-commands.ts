import { createAudioResource, joinVoiceChannel } from "@discordjs/voice";
import {
  Client,
  InternalDiscordGatewayAdapterCreator,
  Message,
} from "discord.js";
import got from "got/dist/source";
import { commandPrefix } from "./configs";
import { BotClient, MusicPlayer } from "./singletons";
import { parseMessageCommands } from "./util";
import { getYoutubeAudioURL } from "./youtube-downloader";

interface iInfoForVoiceChannel {
  guildId: string;
  voiceChannelId: string;
  adapterCreator: InternalDiscordGatewayAdapterCreator;
}

export async function getVoiceChannelInfoFromMessage(
  message: Message<boolean>,
  client: Client
): Promise<{ info: iInfoForVoiceChannel | null; error: Error | null }> {
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

export async function handlePlayCommand(
  message: Message<boolean>
): Promise<Error | null> {
  // Get audio URL
  const { info: commandInfo, error: parseMessageError } = parseMessageCommands(
    message.content
  );

  const URLPositionalArgumentIdx = 0;

  if (parseMessageError !== null) return parseMessageError;

  if (commandInfo.arguments.length < URLPositionalArgumentIdx + 1)
    return Error("unable to find URL for video");

  const youtubeURL = commandInfo.arguments[URLPositionalArgumentIdx];

  const { audioURL, error: getAudioURLError } = await getYoutubeAudioURL(
    youtubeURL
  );
  if (getAudioURLError) return getAudioURLError;

  const audioStream = got.stream(audioURL);

  // Connect to voice chat
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

  // Join voice channel and play music
  const player = MusicPlayer.player;

  const connection = joinVoiceChannel({
    channelId: voiceChannelInfo.voiceChannelId,
    guildId: voiceChannelInfo.guildId,
    adapterCreator: voiceChannelInfo.adapterCreator,
  });

  const subscription = connection.subscribe(player); // Connects voice channel with player

  player.play(createAudioResource(audioStream));

  // TEMP: STOP PLAYING MUSIC, NO PAUSE OR STOP YET
  await new Promise((resolve) => setTimeout(resolve, 10000));
  player.stop();
  connection.disconnect();
  connection.destroy();
  subscription?.unsubscribe();

  return null;
}

export async function handleHelpCommand(
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

  console.log(helpStr);

  try {
    await message.channel.send(helpStr);
  } catch {
    return Error("unable to send help information");
  }

  return null;
}

// Register command here
export const commandNameAndHandlerDict: iCmdNameAndInfoObj = {
  play: {
    description:
      "Plays youtube URL separated by a space. Example: !play (youtube_url)",
    handler: handlePlayCommand,
  },
  help: {
    description: "Shows list of commands and what they do",
    handler: handleHelpCommand,
  },
};
