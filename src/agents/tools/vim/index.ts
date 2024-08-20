import { ProcessSnapshotter } from "../../../utils/terminal";
import { EventEmitter } from "events";
import * as fs from "fs";
import * as pty from "node-pty";
import { wait } from "../../../utils";

let ptyProcess: pty.IPty;
let snapshotter: ProcessSnapshotter;
const stdout = process.stdout;
const shell = process.env.SHELL || "bash";

export async function useVim() {
  if (!ptyProcess) {
    ptyProcess = pty.spawn(shell, [], {
      name: "xterm-color",
      cols: 100,
      rows: 100,
      cwd: process.cwd(),
      encoding: "utf8",
      env: process.env,
    });

    ptyProcess.onData((data) => {
      // stdout.write(data);
    });

    ptyProcess.write("vim -n\n");
  }

  // delete on start
  if (fs.existsSync("terminal.txt")) {
    fs.unlinkSync("terminal.txt");
  }

  if (!snapshotter) {
    snapshotter = new ProcessSnapshotter(ptyProcess, 250);

    snapshotter.onSnapshot((snapshot) => {
      fs.appendFileSync("terminal.txt", JSON.stringify(snapshot) + "\n");
    });
  }

  return "vim process started. you can use sendVimInput tool to open and modify files now";
}

export async function sendVimInput(keys: string[], delay = 2500) {
  if (!ptyProcess) {
    await useVim();
  }

  const ESCAPE = "\x1B";
  const keymap = {
    "<ESC>": ESCAPE,
    "<Esc>": ESCAPE,
    "<ESCAPE>": ESCAPE,
    "<ENTER>": "\n",
    "<enter>": "\n",
    "<Enter>": "\n",
  };

  const remapped = keys.map((key) => {
    for (const [from, to] of Object.entries(keymap)) {
      key = key.replaceAll(from, to);
    }

    // we are executing a command
    if (key.startsWith(":")) {
      // easiest way to ensure we're in normal mode
      key = ESCAPE + key;

      if (!key.endsWith("\n")) {
        // make sure we actually send the command
        key = key + "\n";
      }
    }

    return key;
  });

  console.log("sending keys", remapped);
  const { update, collect } = snapshotter.collectFutureSnapshots();
  await snapshotter.sendManyKeys(remapped, delay);
  const snapshots = collect();

  // await closeVim();

  return `
  VIM Terminal outputs:
  Please inspect this to determine if VIM is in the correct state.

  ${JSON.stringify(snapshots, null, 2)}
  `;
}

export async function closeVim() {
  ptyProcess.kill();
  ptyProcess = undefined;
  snapshotter = undefined;
  return "vim process closed";
}
