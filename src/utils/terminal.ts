import { EventEmitter } from "events";
import * as fs from "fs";
import * as pty from "node-pty";
import { wait } from "./";
import { $Command } from "@aws-sdk/client-s3";

function parseTerminalStream(input) {
  // Regular expression to match ANSI escape codes
  const ansiEscapeCodePattern = /\u001b[[0-9;?]*[A-Za-z]/g;

  // Remove ANSI escape codes
  let cleanedString = input.replace(ansiEscapeCodePattern, "");

  // Remove excess whitespace, carriage returns, and newlines
  // cleanedString = cleanedString.replace(/\\r/g, "").replace(/\\n/g, " ").trim();

  // Remove any backslashes left from escape sequences
  // cleanedString = cleanedString.replace(/\\/g, "");

  // Optional: collapse multiple spaces into a single space
	 cleanedString = cleanedString.replace(/\s+/g, " ");

  return cleanedString;
}

export interface Snapshot {
  terminal_inputs: string[];
  terminal_outputs: string;
  timestamp: number;
}
export class ProcessSnapshotter {
  snapshotEvents = new EventEmitter();
  snapshots = new Array<Snapshot>();
  nextSnapshot: Promise<void> | undefined = undefined;
  snapshotInputs = new Array<string>();

  constructor(
    private ptyProcess: pty.IPty,
    public snapshotEveryMs = 500,
    public interactionDelay = 1000
  ) {
    this.wireup();
  }

  wireup() {
    this.ptyProcess.onData((data) => {
      const now = Date.now();

      const parsed = parseTerminalStream(data);

      if (!parsed) {
        return;
      }

      const newSnapshot: Snapshot = {
        terminal_outputs: parsed,
        timestamp: now,
        terminal_inputs: [...this.snapshotInputs],
      };

      const lastSnapshot = this.snapshots[this.snapshots.length - 1];
      const lastTimestamp = lastSnapshot?.timestamp || now;
      const elapsed = now - lastTimestamp;
      const remaining = Math.max(this.snapshotEveryMs - elapsed, 0);

      if (elapsed >= this.snapshotEveryMs || !lastSnapshot) {
        // console.log("Snapshotting");
        this.snapshots.push(newSnapshot);
        this.snapshotInputs = [];
      } else {
        lastSnapshot.terminal_outputs += parsed;
        lastSnapshot.terminal_inputs.push(...this.snapshotInputs);
      }

      this.scheduleSnapshot(remaining);
    });
  }

  getLastSnapshot() {
    return this.snapshots[this.snapshots.length - 1];
  }

  snapshotsSince(timestamp: number) {
    return this.snapshots.filter((s) => s.timestamp >= timestamp);
  }

  lastFewSnapshots(numSnapshots: number) {
    return this.snapshots.slice(numSnapshots * -1);
  }

  scheduleSnapshot(time: number) {
    if (!this.nextSnapshot) {
      // console.log("Scheduling snapshot in", time, "ms");
      this.nextSnapshot = wait(time)
        .then(() => {
          const lastSnapshot = this.getLastSnapshot();
          // console.log("Snapshot firing off!", lastSnapshot.timestamp);
          this.snapshotEvents.emit("snapshot", lastSnapshot);
        })
        .finally(() => {
          this.nextSnapshot = undefined;
        });
    }
    return this.nextSnapshot;
  }

  collectFutureSnapshots() {
    let lastSnapshot = this.getLastSnapshot();

    const update = () => {
      lastSnapshot = this.getLastSnapshot();
    };

    const collect = () => {
      const lastTimestamp = lastSnapshot?.timestamp || 0;
      const snapshots = this.snapshotsSince(lastTimestamp);
      update();
      return snapshots;
    };

    return {
      collect,
      update,
    };
  }

  onSnapshot(callback: (snapshot: Snapshot) => void) {
    this.snapshotEvents.on("snapshot", callback);
  }

  async sendKeys(input: string, delay = this.interactionDelay) {
    this.snapshotInputs.push(input);
    this.ptyProcess.write(input);
    await wait(delay);
  }

  async sendManyKeys(inputs: string[], delay = this.interactionDelay) {
    for (const key of inputs) {
      await this.sendKeys(key, delay);
    }
  }
}
