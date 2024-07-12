import { ChatCompletionMessageParam } from "openai/resources/chat";
import { BaseAgent } from "../base/base";

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
`;

export class CodebaseAgent extends BaseAgent {
  name = "Developer";

  getInitialMessages(userInput: string) {
    return [
      {
        role: "system",
        content: `Codebase Agent. You use the tools to read and write code, to help the developer implement features faster. Call final answer once you have finished implementing what is requested. As an agent you will receive multiple rounds of input until you call final answer. You are not able to request feedback from the user, so proceed with your plans and the developer will contact you afterwards if they need more help. After modifying files, you will read them to ensure they look correct before calling final answer. You always check your modifications for syntax errors or bugs. You always make the smallest modifications required to files, rather than outputting the entire file. You think step by step about the blocks of code you're modifying. You may use the execCommand tool to navigate the filesystem and to create new folders if needed.
        `,
      },
      { role: "user", content: systemReminder },
      { role: "user", content: userInput },
    ] as ChatCompletionMessageParam[];
  }
}

export const Developer = new CodebaseAgent();
