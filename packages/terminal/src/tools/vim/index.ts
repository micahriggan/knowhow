import { ProcessSnapshotter } from "../../terminal";
import { EventEmitter } from "events";
import * as fs from "fs";
import * as pty from "node-pty";
import { wait } from "../../wait";

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
      // Uncomment this to see the vim window
      // stdout.write(data);
    });

    ptyProcess.write("vim -n\n");
  }

  if (!snapshotter) {
    snapshotter = new ProcessSnapshotter(ptyProcess, 250);
  }

  await wait(3000);
  return "vim process started. you can use sendVimInput tool to open and modify files now. Make sure you've opened a file before sending other keys";
}

let GLOBAL_DELAY = 2500;

export async function openFileInVim(filename: string) {
  if (!ptyProcess) {
    await useVim();
  }

  const output = await sendVimInput([`<ESC>:e ${filename}\n`], 2500);
  GLOBAL_DELAY = 1000;
  return output;
}

export async function saveVimFile(filename: string) {
  if (!ptyProcess) {
    await useVim();
  }

  const output = await sendVimInput([`<ESC>:w! ${filename} \n`], 2500);
  GLOBAL_DELAY = 2500;
  return output + `\n Use readFile to check your work on ${filename}`;
}

export async function sendVimInput(
  keys: string | string[],
  delay = GLOBAL_DELAY
) {
  if (!ptyProcess) {
    await useVim();
  }

  if (typeof keys === "string") {
    keys = [keys];
  }

  keys.unshift(":set paste\n");

  const ESCAPE = "\x1B";
  const BACKSPACE = "\x08";
  const keymap = {
    "<ESC>": ESCAPE,
    "<Esc>": ESCAPE,
    "<ESCAPE>": ESCAPE,
    "<ENTER>": "\n",
    "<enter>": "\n",
    "<Enter>": "\n",
    "<CR>": "\n",
    "<BACKSPACE>": BACKSPACE,
    "<BACK>": BACKSPACE,
    "<BS>": BACKSPACE,
  };

  const startingKeys = [":", "/"];
  const shouldEscapeRegex = /^(?:\/(?!\/)|:)/;

  const remapped = keys.map((key) => {
    for (const [from, to] of Object.entries(keymap)) {
      key = key.replaceAll(from, to);
    }

    // we are executing a command
    for (const start of startingKeys) {
      if (shouldEscapeRegex.test(key)) {
        // easiest way to ensure we're in normal mode
        key = ESCAPE + key;

        if (!key.endsWith("\n")) {
          // make sure we actually send the command
          key = key + "\n";
        }
      }
    }

    return key;
  });

  console.log("sending keys", remapped);
  const { update, collect } = snapshotter.collectFutureSnapshots();
  await snapshotter.sendManyKeys(remapped, delay);
  const snapshots = await collect();

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
  return "vim process closed. Are you done? call finalAnswer if so";
}
