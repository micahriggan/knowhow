class FlagsService {
  constructor(flags = [], log = false) {
    this.flags = {};
    this.log = log;
    this.register(flags);
  }


 register(flags) {
    flags.forEach(flag => {
      this.flags[flag] = false;
    });
  }

  flip(flag) {
    this.flags[flag] = !this.flags[flag];
    if (this.log) {
      console.log(`${flag} is now ${this.flags[flag] ? 'enabled' : 'disabled'}`);
    }
  }

  enableLogging() {
    this.log = true;
  }

  hasFlag(flag) { return flag in this.flags; }

}

const Flags = new FlagsService();
module.exports = { FlagsService, Flags };
