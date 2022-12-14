import * as dotenv from "dotenv";
import { commandNameAndHandlerDict } from "./src/bot-commands";
import { BotClient } from "./src/singletons/discord-client";
import { NotACommandError, parseMessageCommands } from "./src/util";

// set up configs
dotenv.config({ path: __dirname + "/.env" });

console.log("Bot is starting...");

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
      `"${messageCmdInfo.command}" is not a valid command, type !help to get a full list of commands`
    );
    return;
  }

  // Handle commands
  const cmdInfo = commandNameAndHandlerDict[messageCmdInfo.command];

  const handlerError = await cmdInfo.handler(message);
  if (handlerError !== null) {
    message.channel.send(
      `**Error executing ${messageCmdInfo.command}**: ${handlerError.message}.\nType !help to get full list of commands`
    );
    return;
  }
});

client.login(process.env.DISCORD_CLIENT_TOKEN);
