import glob from "glob";
import { Plugin } from "./types";
import { VimPlugin } from "./vim";
import { LanguagePlugin } from "./language";
import { EmbeddingPlugin } from "./embedding";
import { GitHubPlugin } from "./github";
import { AsanaPlugin } from "./asana";
import { LinearPlugin } from "./linear";
import { JiraPlugin } from "./jira";
import { NotionPlugin } from "./notion";

class PluginService {
  plugins = {
    embeddings: new EmbeddingPlugin(),
    vim: new VimPlugin(),
    language: new LanguagePlugin(),
    github: new GitHubPlugin(),
    asana: new AsanaPlugin(),
    linear: new LinearPlugin(),
    jira: new JiraPlugin(),
    notion: new NotionPlugin(),
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
