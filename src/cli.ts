#!/usr/bin/env node
import { generate, embed, upload } from "./index";
import { init } from "./config";
import { uploadOpenAi } from ".";

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
    case "upload":
      await upload();
      break;
    case "upload:openai":
      await uploadOpenAi();
      break;
    default:
      console.log(
        "Unknown command. Please use one of the following: init, generate, embed"
      );
      break;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .then(() => {
    process.exit(0);
  });
