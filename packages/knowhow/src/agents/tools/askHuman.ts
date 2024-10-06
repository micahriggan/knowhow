import Marked from "marked";
import { ask } from "../../utils";

export async function askHuman(question: string) {
  console.log("AI has asked: ");
  console.log(Marked.parse(question), "\n");
  return ask("response: ");
}
