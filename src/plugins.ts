import glob from "glob";
import { readFile } from "./utils";

interface Plugin {
  call(): Promise<string>;
}

class PluginService {
  plugins = {
    vim: new VimPlugin(),
  } as Record<string, Plugin>;

  registerPlugin(name, plugin: Plugin) {
    this.plugins[name] = plugin;
  }

  async callMany(plugins: string[]) {
    const calls = plugins.map((p) => this.plugins[p].call());
    return (await Promise.all(calls)).join("\n");
  }
}

class VimPlugin implements Plugin {
  async getVimFiles() {
    const vimFiles = await glob.sync("./**/*.swp", { dot: true });
    return vimFiles;
  }

  async getSourcePath(vimPath: string) {
    const pathParts = vimPath.split("/");
    const fileName = pathParts[pathParts.length - 1];
    const cleanedFileName = fileName.slice(1, fileName.length - 4);
    const sourcePath = pathParts.slice(0, pathParts.length - 1).join("/");
    return sourcePath + "/" + cleanedFileName;
  }

  async getFileContents(swapFile: string) {
    const filePath = await this.getSourcePath(swapFile);
    return { filePath, content: await readFile(filePath, "utf8") };
  }

  async call() {
    const vimFiles = await this.getVimFiles();
    const fileContents = await Promise.all(
      vimFiles.map((f) => this.getFileContents(f))
    );
    return (
      "VIM PLUGIN: The following files are open in vim: " +
      JSON.stringify(fileContents)
    );
  }
}

export const Plugins = new PluginService();
