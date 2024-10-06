import { Clients } from "src/clients";
import { Plugins } from "src/plugins/plugins";
import { Agents } from "src/services/AgentService";
import { Tools } from "src/services/Tools";
import { getConfig } from "../config";
import { KnowhowModule } from "./types";

export class ModulesService {
  async loadModulesFromConfig() {
    const config = await getConfig();

    const modules = config.modules || [];

    for (const modulePath of modules) {
      const importedModule = require(modulePath) as KnowhowModule;
      await importedModule.init({ config, cwd: process.cwd() });

      for (const agent of importedModule.agents) {
        Agents.registerAgent(agent);
      }

      for (const tool of importedModule.tools) {
        Tools.addTool(tool.definition);
        Tools.setFunction(tool.definition.function.name, tool.handler);
      }

      for (const plugin of importedModule.plugins) {
        Plugins.registerPlugin(plugin.name, plugin.plugin);
      }

      for (const client of importedModule.clients) {
        Clients.registerClient(client.provider, client.client);
        Clients.registerModels(client.provider, client.models);
      }
    }
  }
}
