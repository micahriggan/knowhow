import { Message } from "../../clients/types";
import { BaseAgent } from "../base/base";
import { BASE_PROMPT } from "../base/prompt";

const example = `
Index: ./src/agents/base/base.ts
===================================================================
--- ./src/agents/base/base.ts
+++ ./src/agents/base/base.ts
@@ -186,9 +186,14 @@
     startIndex: number,
     endIndex: number
   ) {
     const toCompress = messages.slice(startIndex, endIndex);
-    const toCompressPrompt = \`Summarize what this agent was tasked with, what has been tried so far, and what we're about to do next. This summary will become the agent's only memory of the past, all other messages will be dropped: \n\n\${JSON.stringify(
+    const toCompressPrompt = \`Summarize:
+    1. Initial Request - what this agent was tasked with.
+    2. Progress - what has been tried so far,
+    3. Next Steps - what we're about to do next to continue the user's original request.
+
+      This summary will become the agent's only memory of the past, all other messages will be dropped: \n\n\${JSON.stringify(
       toCompress
     )}\`;

     const model = this.getModel();
@@ -202,9 +207,12 @@
         },
       ],
     });

+    const systemMesasges = toCompress.filter((m) => m.role === "system");
+
     const newMessages = [
+      ...systemMesasges,
       ...response.choices.map((c) => c.message),
       ...messages.slice(endIndex),
   ];

`;

const systemReminder = `# Patch Tool Rules:
Here's an example of a correctly formatted patch:
${example}

Be sure to preserve sytanx, delete the correct lines of code, and insert new lines of code in the correct locations.

The user's patch tool needs CORRECT patches that apply cleanly against the current contents of the file!
Think carefully and make sure you include and mark all lines that need to be removed or changed as \`-\` lines.
Make sure you mark all new or modified lines with \`+\`.
Don't leave out any lines or the diff patch won't apply correctly.

Indentation matters in the diffs!

Start a new hunk for each section of the file that needs changes.

Only output hunks that specify changes with \`+\` or \`-\` lines.
Skip any hunks that are entirely unchanging \` \` lines.

Output hunks in whatever order makes the most sense.
Hunks don't need to be in any particular order.

Hunks should have a context of 3 lines before and after the change, which match exactly from the source.

When editing a function, method, loop, etc use a hunk to replace the *entire* code block.
Delete the entire existing version with \`-\` lines and then add a new, updated version with \`+\` lines.
This will help you generate correct code and correct diffs.

To move code within a file, use 2 hunks: 1 to delete it from its current location, 1 to insert it in the new location.

You should attempt to apply one hunk at a time, as an error in one hunk can cause the entire patch to fail to apply.
`;

export class PatchingAgent extends BaseAgent {
  name = "Patcher";
  description = `This agent is prepared to work on the codebase by leveraging patches`;

  constructor() {
    super();
    this.disableTool("sendVimInput");
    this.disableTool("openFileInVim");

    this.setModelPreferences([
      { model: "claude-3-5-sonnet-20240620", provider: "anthropic" },
      {
        model: "gpt-4-turbo-preview",
        provider: "openai",
      },
    ]);
  }

  async getInitialMessages(userInput: string) {
    return [
      {
        role: "system",
        content: `${BASE_PROMPT}

        Specialization: Patcher Agent, ${this.description}
        IF you fail twice to patch a file, you may switch using writeFileChunk to rewrite the whole file.
        `,
      },
      { role: "user", content: systemReminder },
      { role: "user", content: userInput },
    ] as Message[];
  }
}

export const Patcher = new PatchingAgent();
