import { EventEmitter } from "events";
import * as fs from "fs";
import * as pty from "node-pty";
import { wait } from "./utils";
import { Vimmer } from "./agents/vim/vim";
import { sendVimInput, closeVim } from "./agents/tools/vim";

async function test() {
  await Vimmer.call(
    "Make a file called test.js that prints out all the odd numbers between 1 and 100. Run the script to verify it worked"
  );
  /*
   *const changes = await sendVimInput([":e apology.txt\n"], 2000);
   *console.log(changes);
   *await closeVim();
   */
}

if (require.main === module) {
  test();
}
