import { Plugins } from "../../plugins/plugins";
export async function callPlugin(pluginName: string, userInput: string) {
  return Plugins.call(pluginName, userInput);
}
