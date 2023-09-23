#!/usr/bin/env node
import { generate, embed, upload } from "./index";
import { init } from "./config";

const command = process.argv[2];

switch (command) {
  case "init":
    init();
    break;
  case "generate":
    generate();
    break;
  case "embed":
    embed();
    break;
  case "upload":
    upload();
    break;
  default:
    console.log(
      "Unknown command. Please use one of the following: init, generate, embed"
    );
    break;
}
