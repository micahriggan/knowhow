import { EventEmitter } from "events";
import * as fs from "fs";
import * as pty from "node-pty";
import { wait } from "./utils";
import { Vimmer } from "./agents/vim/vim";
import { sendVimInput, closeVim } from "./agents/tools/vim";
import { Patcher } from "./agents/patcher/patcher";

async function test() {
  const randomDivsor = Math.floor(Math.random() * 20);
  const maxNumber = Math.floor(Math.random() * 1000);
  await Vimmer.call(
    `modify test.js so that it only logs numbers divisible by ${randomDivsor} and do change the loop to go to ${maxNumber}`
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
