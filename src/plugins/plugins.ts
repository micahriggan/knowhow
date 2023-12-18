import glob from "glob";
import { Plugin } from "./types";
import { VimPlugin } from "./vim";
import { LanguagePlugin } from "./language";
import { EmbeddingPlugin } from "./embedding";
import { GitHubPlugin } from "./github";
import { AsanaPlugin } from "./asana";

class PluginService {
  plugins = {
    embeddings: new EmbeddingPlugin(),
    vim: new VimPlugin(),
    language: new LanguagePlugin(),
    github: new GitHubPlugin(),
    asana: new AsanaPlugin(),
  } as Record<string, Plugin>;

  registerPlugin(name, plugin: Plugin) {
    this.plugins[name] = plugin;
  }

  async callMany(plugins: string[], user_input?: string) {
    const calls = plugins.map((p) => this.plugins[p].call(user_input));
    return (await Promise.all(calls)).join("\n\n");
  }
}

export const Plugins = new PluginService();
