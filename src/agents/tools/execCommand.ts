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

  return output;
};
