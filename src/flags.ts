export class FlagsService {
  flags = {};
  log = false;

  constructor(flags: Array<string> = [], log = false) {
    this.register(flags);
    this.log = log;
  }

  register(flags: Array<string>) {
    flags.forEach((flag) => {
      this.flags[flag] = false;
    });
  }

  flip(flag: string) {
    this.flags[flag] = !this.flags[flag];
    if (this.log) {
      const status = this.flags[flag] ? "enabled" : "disabled";
      const message = `${flag} is now ${status}`;
      console.log(message);
    }
  }

  enableLogging() {
    this.log = true;
  }

  disableLogging() {
    this.log = false;
  }

  enabled(flag: string) {
    return this.flags[flag];
  }
}

export const Flags = new FlagsService();
