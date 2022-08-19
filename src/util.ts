interface iMessageCommandInfo {
  command: string;
  arguments: Array<string>;
}

export const NotACommandError = new Error("not a command");

export function parseMessageCommands(messageStr: string): {
  info: iMessageCommandInfo;
  error: Error | null;
} {
  const cmdArgs: Array<string> = [];
  const info: iMessageCommandInfo = {
    command: "",
    arguments: cmdArgs,
  };

  // Check whether it's a command
  if (messageStr.length === 0 || messageStr[0] !== "!")
    return { info, error: NotACommandError };

  messageStr = messageStr.slice(1); // Trim initial "!" character

  // Split message
  const splitMessages = messageStr.split(" ");
  if (splitMessages.length === 0)
    return { info, error: Error("empty command") };

  // Get command
  info.command = splitMessages[0];

  // Get arguments if any
  if (splitMessages.length > 1) {
    info.arguments = splitMessages.slice(1);
  }

  return { info, error: null };
}
