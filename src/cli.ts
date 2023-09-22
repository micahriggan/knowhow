import { init, generate, embed } from "./index";

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
  default:
    console.log(
      "Unknown command. Please use one of the following: init, generate, embed"
    );
    break;
}
