import { NotACommandError, parseMessageCommands } from "./util";
import { commandNameAndHandlerDict } from "./bot-commands";
import { BotClient, MusicPlayer } from "./singletons";
import { generateDependencyReport } from "@discordjs/voice";

const token =
  "MTAwOTYwNzUyODQxOTY5MjYxNQ.GeIt8A.cZhzK2IhjhNEhjSRzp-fBvEp1zy7Nc3GAzgNuA"; // add your token here

console.log("Bot is starting...");

// Player singleton initiation
const player = MusicPlayer.player;
console.log(generateDependencyReport());

player.on("error", (error) => {
  console.error("player error:", error);
});

// player.on("stateChange", (oldState, newState) => {
//   console.log("State changed:", { oldState, newState });
// });

player.on("debug", (message) => {
  console.log("Player debug:", message);
});

// Get client ready
const client = BotClient.client;

client.on("error", (error) => {
  console.error("client error:", error);
});

// Client handlers
client.once("ready", async () => {
  if (!client.user || !client.application) {
    return;
  }

  console.log(`${client.user.username} is online`);
});

// Message listener
client.on("messageCreate", async (message) => {
  // Grab commands
  const { info: messageCmdInfo, error: messageCmdParseError } =
    parseMessageCommands(message.content);

  // Don't do anything if not a command
  if (messageCmdParseError === NotACommandError) {
    return;
  }

  // If other errors, notify user
  if (messageCmdParseError !== null) {
    message.channel.send(messageCmdParseError.message);
    return;
  }

  // Check whether command is supported
  if (!(messageCmdInfo.command in commandNameAndHandlerDict)) {
    message.channel.send(
      `${messageCmdInfo.command} is not a valid command, type !help to get a full list of commands`
    );
    return;
  }

  // Handle commands
  const cmdInfo = commandNameAndHandlerDict[messageCmdInfo.command];

  const handlerError = await cmdInfo.handler(message);
  if (handlerError !== null) {
    message.channel.send(
      `error executing ${messageCmdInfo.command}: ${handlerError.message}. type !help to get full list of commands`
    );
    return;
  }
});

client.login(token);
