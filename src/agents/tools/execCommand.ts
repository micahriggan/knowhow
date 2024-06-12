import { execAsync } from "../../utils";

// Tool to execute a command in the system's command line interface
export const execCommand = async (command: string): Promise<string> => {
  try {
    console.log("execCommand:", command);
    const { stdout, stderr } = await execAsync(command);
    let output = "";
    if (stderr) {
      output += stderr + "\n";
    }
    output += stdout;
    console.log(`$ ${command}:\n${output}`);
    return output;
  } catch (e) {
    const { stdout, stderr } = e;
    console.log({ msg: "catch statement", stderr, stdout });
    console.log("Error executing command:", JSON.stringify(e, null, 2));
    return e;
  }
};

