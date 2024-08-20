#!/usr/bin/env node
import { generate, embed, upload, uploadOpenAi, chat } from "./index";
import { init } from "./config";
import { download, purge } from ".";

const command = process.argv[2];

async function main() {
  switch (command) {
    case "init":
      await init();
      break;
    case "generate":
      await generate();
      break;
    case "embed":
      await embed();
      break;
    case "embed:purge":
      await purge(process.argv[3]);
      break;
    case "upload":
      await upload();
      break;
    case "download":
      await download();
      break;
    case "upload:openai":
      await uploadOpenAi();
      break;
    case "chat":
      await chat();
      break;
    default:
      console.log(
        "Unknown command. Please use one of the following: init, generate, embed"
      );
      break;
  }
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .then(() => {
      process.exit(0);
    });
}
