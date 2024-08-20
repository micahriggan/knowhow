import * as fs from "fs";
import { ChatCompletionMessageParam } from "openai/resources/chat";
import { BaseAgent } from "../base/base";
import { readFile, writeFile, execAsync, mkdir } from "../../utils";
import { openai, singlePrompt } from "../../ai";

export class VimAgent extends BaseAgent {
  name = "Vimmer";

  toolPath = ".knowhow/tools/vim";

  constructor() {
    super();
    this.disableTool("patchFile");
  }

  async saveVimGuide() {
    const vimrc = await execAsync("cat ~/.vim/vimrc");
    await mkdir(this.toolPath, { recursive: true });
    const vimRcPrompt = `Extract a minimal format of commands and hotkeys that an ai could leverage from this vimrc ${vimrc}. Only output the hotkeys and commands you see, nothing else`;
    const extraction = await singlePrompt(vimRcPrompt);
    await writeFile(".knowhow/tools/vim/guide.md", extraction);
  }

  async getVimGuide() {
    if (!fs.existsSync(".knowhow/tools/vim/guide.md")) {
      await this.saveVimGuide();
    }

    const guide = await readFile(".knowhow/tools/vim/guide.md");
    return guide;
  }

  async getInitialMessages(userInput: string) {
    return [
      {
        role: "system",
        content: `
        # General Instructions

        You must use the VIM tools (sendVimInput) to make edits to files. You are primarily operating as a terminal app that the user runs from their current working directory.
        The sendVimInput function will open a blank vim process in the user's working directory.
        Make sure to open the file you are working on at the beginning, as you are in a blank vim session.
        Use :e <filename>\\n to open a file, and <ESCAPE>:w\\n to save it.
        Make sure to send the proper escape ('<ESCAPE>') and save commands after modifying a file.
        Make sure to use ESCAPE to exit insert mode before attempting to execute commands like (<ESCAPE>:w\\n).
        When executing commands, make sure you actually execute them by including a newline character after the command.
        If you do not include the newline, it will not actually execute the command.


        # Interaction Loop
        Using the editor should follow an interaction loop:
        1. First open the editor
        2. Attempt to open the file you want to edit
        3. Inspect the response from sendVimInput to determine if the file was opened
          * Check for any errors or prompts that may have occurred, respond to them if so
        4. Use sendVimInput to move the cursor and make changes to the file
        5. Save your changes via <ESCAPE>:w\\n
          * Do not use <ESCAPE> while typing, unless you want to exit insert mode.
        6. From the returned terminal outputs, determine if the changes went as expected.
        7. If you believe the changes were successful, save your work, then use readFile tool to check your work.
        8. If you discover there were errors to your changes, attempt to fix them by repeating steps 4-7.
        9. If you are completely done, you've checked your work and it looked correct then call finalAnswer and let the user know you're done

        After each sendVimInput, the function response will contain the changes in the vim terminal. Inspect that response to get an understanding of what is happening in the editor.

        The vim process will remain open, and you can correct your current state by responding to the state of the terminal.
        It may help to execute fewer commands up front until you're confident you have opened the file you want to edit.

        Use multiple interactions with sendVimInput to make changes to the file, inspecting the response each time to ensure the current state of vim is as expected.
        Since vim is interactive, you may be required to respond to prompts the program asks in order proceed, you will need to monitor the response from sendVimInput to know when and how to respond to these prompts.



        # Using ESCAPE to change modes
        <ESCAPE> should only be used to change vim modes.
        Once you are in insert mode, be careful not to send <ESCAPE> as part of the text you are entering.
        When you go to exit insert mode, to save, or run some other :command, you MUST send <ESCAPE> before the command.


        # User's active vim plugins
        Here's a guide on what plugins and features are currently enabled in vim:
        START VIM GUIDE
        ${await this.getVimGuide()}
        END VIM GUIDE

        # Programming Instructions
        After modifying source code, you must run the auto-format before saving with gg=G or any plugin commands for formatting.
        Ensure that you follow programming best practices, style best practices, and ensure that the syntax of the file is correct.
        Pay very close attention to text around your changes, as you may inadvertently affect or break the surrounding code if you inserted code in the wrong place.

        The vim plugins may include auto-completes, auto-indents etc that will impact bulk inserting of lines of text.
        If you do not need to leverage those features, then you should enable paste mode via :set paste and :set nopaste to disable it after inserting your fully formatted text.
        The editor may assume comments continue on the next line, or do other syntax auto completions, so make sure to check the actual state of a file, and make corrections if the editor over-corrected your input, or use paste mode to ensure your input goes in unaffected.
				IMPORTANT: You MUST enable paste mode when inserting comments, otherwise you'll end up commenting out all your inserted code.

        If auto-complete is enabled you may use sendVimInput to start accessing the properties of an object, and the response should contain a view of the auto-completion options, if enabled.

        # Encountering Issues / Troubleshooting
        If you completed your changes, but then found issues while inspecting the file afterwards, close vim and then re-open the file to make corrections. This ensures you're starting from a clean slate.


        # Completing a task
        When you have completed your task make sure to call closeVim before calling finalAnswer.
        You may use the execCommand tool to navigate the filesystem and to create new folders if needed.
        You MUST eventually call finalAnswer when you are done.
        Accomplish the user's goal with the tools at hand, good luck!
        `,
      },
      { role: "user", content: userInput },
    ] as ChatCompletionMessageParam[];
  }
}

export const Vimmer = new VimAgent();
