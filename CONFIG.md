
Here is an overview of examples from various `knowhow.json` configuration files found, illustrating the configuration capabilities that Knowhow supports:

---

## General Configuration Template

```json
{
  "promptsDir": ".knowhow/prompts",
  "plugins": [
    "embeddings",
    "language",
    "vim",
    "github",
    "asana",
    "jira",
    "linear",
    "download",
    "figma"
  ],
  "sources": [
    {
      "input": "src/**/*.mdx",
      "output": ".knowhow/docs/",
      "prompt": "BasicCodeDocumenter"
    }
  ],
  "embedSources": [
    {
      "input": ".knowhow/docs/**/*.mdx",
      "output": ".knowhow/embeddings",
      "chunkSize": 2000
    }
  ],
  "assistants": [
    {
      "name": "Codebase Helper",
      "description": "Helps you code",
      "instructions": "Codebase helper, use files and tools to help us code",
      "model": "gpt-4-1106-preview",
      "tools": [
        {
          "type": "code_interpreter"
        }
      ],
      "files": [
        ".knowhow/docs/**/*.mdx"
      ]
    }
  ]
}
```
This configuration enables a comprehensive development environment setup, integrating various tools like language servers, code versioning, and project management APIs. It supports the documentation process through automated prompts and embeds information generation for enhanced team collaboration.

## knowhow generate: meeting transcripts
```json
  "sources": [
    {
      "input": "./meetings/**/*.mov",
      "output": "./meetings/ai-notes/",
      "prompt": "MeetingNotes"
    },
    {
      "input": "./meetings/TaskRelatedCall/transcript.txt",
      "output": "./meetings/tasks/RewardsTasks.txt",
      "prompt": "AsanaTasks"
    },
    {
      "input": "./meetings/EngineeringCall/transcript.txt",
      "output": "./meetings/tasks/SchemaChanges.txt",
      "prompt": "Schema"
    }
  ],
```


Use the source block alongside `knowhow generate` to process a pipeline of files, applying prompts to generate documentation or other artifacts. This example demonstrates the configuration for processing meeting recordings, and then running prompts on the resulting transcripts.

I've been using `CMD+SHIFT+5` to record meetings and then using the `sources` block to process the recordings into notes and tasks.

## knowhow embed: documentation embeddings
```json
  "embedSources": [
    {
      "input": "./documentation/docusaurus/docs/dev-docs/**/*.md",
      "output": ".knowhow/embeddings/strapi-docs.json",
      "chunkSize": 2000
    }
  ]
```

## knowhow embed: codebase embeddings
```json

  "embedSources": [
    {
      "input": "./packages/p2p/src/**/*.ts",
      "output": ".knowhow/embeddings/p2p.json",
      "chunkSize": 2000
    },
    {
      "input": "./packages/openai_proxy/src/**/*.ts",
      "output": ".knowhow/embeddings/openai_proxy.json",
      "chunkSize": 2000
    },
    {
      "input": "./packages/contracts/src/**/*.sol",
      "output": ".knowhow/embeddings/contracts.json",
      "chunkSize": 2000
    }
  ],
```
You can use `knowhow embed` to generate json embeddings from a set of files. If you want to run a prompt on the input, before embedding, you set an optional `prompt` field to match the filename of the prompt stored in your `.knowhow/prompts` directory.

## knowhow embed: asana tasks
```
  "embedSources": [
    {
      "input": "https://app.asana.com/0/111111111111111/list",
      "output": ".knowhow/embeddings/asana.json",
      "s3Bucket": "mybucket",
      "kind": "asana",
      "chunkSize": 2000
    }
  ],
```
Any plugin that implements the embedding function, can generate embeddings if you set the `kind` field to the plugin name. The `s3Bucket` field is optional, and if set, the embeddings will be uploaded to the specified S3 bucket via `knowhow upload`.



## Plugins
```json
{
  "plugins": [
    "embeddings",
    "language",
    "vim",
    "github",
    "asana",
    "jira",
    "linear",
    "download",
    "figma",
    "notion"
  ],
}
```
Plugins are used to resolve urls or other references to data that the AI can use. For example, the `asana` plugin can be used to resolve tasks and projects from Asana, and the `figma` plugin can be used to resolve design files from Figma.

The language plugin allows you to define hotkeys that resolve to larger blocks of texts or files, or urls. For example, you can define a language entry `#asana` that resolves to a link to your current asana task, so that you can easily load that without pasting the link each time.


## knowhow chat:
After generating embeddings, you can use `knowhow chat` to speak with a base agent, that does not have any tools, but does have plugins.

You can use `agent` once you're in a chat to start talking to a Developer agent, that has a prompt and tools designed to help develop software.
You can use `agents` to see a list of configured agents you can speak with.
If you need multi-line input you can use `multi` to open a multi-line editor.

There are many commands you can call from a chat session, try TAB to see a list of available options.


### knowhow chat: custom agents
```json
  "assistants": [
    {
      "name": "linter",
      "description": "Clean up your code",
      "instructions": "Read the files that are loaded via vim plugin and provide debugging and linter suggestions"
    }
  ]
```
You can configure new agents via the config above. This would create a new option when you use `agents` in a chat session.

## Lint Commands

```json
{
  "lintCommands": {
    "js": "eslint",
    "ts": "tslint $1 && tsc -p tsconfig.json"
  }
}
```
lintCommands are automatically run after an agent successfully patches a file, if the file extension matches. So you can configure the AI to receive feedback from tsc and the linter after modifying a TypeScript file. $1 will be replaced with the filepath that was patched.



## Language Plugin

Configured in `.knowhow/language.json`

Knowhow has a language file, which allows you to define additional context that is included when you use certain phrases in your messages. For instance, you could load a Pull Request when you say "My PR", or load a file from the codebase when you reference it. Languages have "terms" which then load various sources into context. Sources currently can be files, text, or github links.

## Example Language Definition
    {
      "knowhow config": {
        "sources": [
          {
            "kind": "file",
            "data": [
              ".knowhow/knowhow.json"
            ]
          }
        ]
      },
      "My PR": {
        "sources": [
          {
            "kind": "github",
            "data": [
              "https://github.com/tyvm-ai/knowhow/pulls/1"
            ]
          }
        ]
      }
    }
