import { execAsync } from "../../utils";

// Tool to execute a command in the system's command line interface
export const execCommand = async (command: string): Promise<string> => {
  let output = "";
  console.log("execCommand:", command);
  const { stdout, stderr } = await execAsync(command).catch((e) => e);
  if (stderr) {
    output += stderr + "\n";
  }
  output += stdout;
  console.log(`$ ${command}:\n${output}`);

  const fullOutput = output.split("\n");

  const maxLines = 1000;
  const maxCharacters = 40000;
  const shouldTrim = fullOutput.length > maxLines;
  const trimmedOutput = shouldTrim ? fullOutput.slice(0, maxLines) : fullOutput;

  const trimmedMessage = shouldTrim
    ? ` (${fullOutput.length - maxLines} results trimmed)`
    : "";

  return trimmedOutput.join("\n").slice(0, maxCharacters) + trimmedMessage;
};
