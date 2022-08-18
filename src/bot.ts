import { Client, GatewayIntentBits } from "discord.js";

const token =
  "MTAwOTYwNzUyODQxOTY5MjYxNQ.GeIt8A.cZhzK2IhjhNEhjSRzp-fBvEp1zy7Nc3GAzgNuA"; // add your token here

console.log("Bot is starting...");

// Get client ready
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Listener
client.once("ready", async () => {
  if (!client.user || !client.application) {
    return;
  }

  console.log(`${client.user.username} is online`);
});

// Message listener
client.on("messageCreate", async (message) => {
  if (message.content.length === 0 || message.content[0] !== "!") return; // Don't do anything if not a command

  // Handle commands here
  console.log({ message });
  console.log("Command invoked:", message.content.slice(1));
});

client.login(token);
