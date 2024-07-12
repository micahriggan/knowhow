import * as crypto from "crypto";
import { Hashes } from "./types";
import { readFile, writeFile } from "./utils";
import { convertToText } from "./conversion";

export async function getHashes() {
  const hashes = JSON.parse(await readFile(".knowhow/.hashes.json", "utf8"));
  return hashes as Hashes;
}

export async function saveHashes(hashes: any) {
  await writeFile(".knowhow/.hashes.json", JSON.stringify(hashes, null, 2));
}

export async function md5Hash(str: string) {
  return crypto.createHash("md5").update(str).digest("hex");
}

export async function checkNoFilesChanged(
  files: string[],
  promptHash: string,
  hashes: any
) {
  for (const file of files) {
    // get the hash of the file
    const fileContent = await convertToText(file);
    const fileHash = crypto.createHash("md5").update(fileContent).digest("hex");

    if (!hashes[file]) {
      return false;
    }

    if (
      hashes[file].promptHash === promptHash &&
      hashes[file].fileHash === fileHash
    ) {
      continue;
    }

    return false;
  }

  return true;
}
