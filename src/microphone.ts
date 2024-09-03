import { exec } from "child_process";
import { getConfig, updateConfig } from "./config";
import * as record from "node-record-lpcm16";
import * as fs from "fs";
import { openai } from "./ai";
import { execAsync, ask } from "./utils";
import { Downloader } from "./plugins/downloader/downloader";

export async function listMicrophones() {
  const regex = /\n\s{8}(\w.*):\n\n/gm;

  const output = await execAsync(
    `system_profiler SPAudioDataType | grep "Input Source: " -B 7 -A 1`
  );

  const matches = output.stdout.match(regex);

  const options = matches.map((m) => m.trim().slice(0, -1));
  console.log({ options });

  return options;
}

// this isn't likely to work for everyone

export async function recordAudio() {
  const config = await getConfig();
  const filePath = "/tmp/knowhow.wav";
  const audioFile = fs.createWriteStream(filePath, { encoding: "binary" });

  const hasSox = await execAsync("which sox");

  if (!hasSox && !config.defaultMic) {
    console.error("Sox is required to record audio");
    console.log(`
For Mac OS
brew install sox

For most linux disto's
sudo apt-get install sox libsox-fmt-all
`);
    process.exit(1);
  }

  if (!config.defaultMic) {
    const options = await listMicrophones();
    const mic = await ask(`Select a microphone (${options.join()})  : `, options);
    config.defaultMic = mic;
    await updateConfig(config);
  }

  const recordCommand = config.micCommand
    ? config.micCommand.replace("$1", config.defaultMic)
    : `sox -t coreaudio "${config.defaultMic}" -r 16000 -c 1 /tmp/knowhow.wav`;

  const task = exec(recordCommand);

  return { stop: () => task.kill() };
}

export async function voiceToText() {
  const input = await ask(
    "Press Enter to Start Recording, or exit to quit...: "
  );

  if (input === "exit") {
    return "voice";
  }

  const recording = await recordAudio();
  console.log("Recording audio...");
  await ask("Press Enter to Stop...");
  recording.stop();
  console.log("Stopped recording");
  return Downloader.transcribeChunks(
    ["/tmp/knowhow.wav"],
    "/tmp/knowhow.txt",
    false
  );
}
