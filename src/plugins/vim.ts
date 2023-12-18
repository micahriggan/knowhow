import glob from "glob";
import { readFile, fileExists, fileStat } from "../utils";
import { Plugin } from "./types";

export class VimPlugin implements Plugin {
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
    const exists = await fileExists(filePath);
    if (!exists) {
      throw new Error(`File ${filePath} does not exist`);
    }

    const stat = await fileStat(filePath);
    if (stat.isDirectory()) {
      return { filePath, content: "DIRECTORY" };
    }
    if (stat.size > 32000) {
      console.error(`File ${filePath} is too large with size ${stat.size}`);
      return { filePath, content: "FILE TOO LARGE" };
    }

    console.log(`Reading file ${filePath}`);
    const content = await readFile(filePath, "utf8");
    return { filePath, content };
  }

  async call() {
    const vimFiles = await this.getVimFiles();
    const fileContents = await Promise.all(
      vimFiles.map((f) => this.getFileContents(f))
    );
    if (fileContents.length === 0) {
      return "VIM PLUGIN: No files open in vim";
    }
    return (
      "VIM PLUGIN: The following files are open in vim: " +
      JSON.stringify(fileContents)
    );
  }
}
