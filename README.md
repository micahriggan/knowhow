# Knowhow - Knowledge Generation Tool
This documentation was mostly generated by the knowhow tool. I have taken a few editor privelages - micah

## Overview

Knowhow is a tool designed to increase the ease of allowing an AI to interact with a folder structure, with the goal of generating embeddings, documentation, or answering questions about the contents of the folders via RAG. This allows us to create codebase chat features, and eventually agents which can operate on the folders themselves.

## Key Features

* Automated Documentation: Generates markdown files for each source file in the codebase.
* Change Detection: Utilizes MD5 hashes to detect changes in source files and prompts, ensuring documentation is up-to-date.
* Embedding Creation: Transforms documentation into embeddings for advanced search and retrieval capabilities.
* Chat Feature: Supports querying the knowledgebase through a chat interface, with context-aware responses.
* Language Configuration: Allows defining terms that map to specific folders, files, or data sources, enriching the chat context.
* Plugins: Supports chat plugins for vim, embedding search, github, and language expansion

## Getting Started

1. Initialization: Run `knowhow init` to create the necessary folder structure and configuration files.
2. Embedding: Execute `knowhow embed` to create embeddings from the generated documentation.
3. Chat: Run `knowhow chat` to start a chat session with additional context provided by the plugins
4. Generation: Use `knowhow generate` to process source files and produce new files. Can output to one or many files

## Configuration

Knowhow is highly configurable, allowing you to specify source patterns, output directories, and custom prompts for documentation generation. Here's an example configuration snippet:

[See more Config examples here](./CONFIG.md)

    {
      "promptsDir": ".knowhow/prompts",
      "plugins": ["embeddings", "language", "vim", "github"],
      "sources": [
        {
          "input": "src/**/*.mdx",
          "output": ".knowhow/docs/",
          "prompt": "BasicCodeDocumenter"
        },
        {
          "input": ".knowhow/docs/**/*.mdx",
          "output": ".knowhow/docs/README.mdx",
          "prompt": "BasicProjectDocumenter"
        }
      ],
      "embedSources": [
        {
          "input": ".knowhow/docs/**/*.mdx",
          "output": ".knowhow/embeddings",
          "prompt": "BasicEmbeddingExplainer",
          "chunkSize": 500
        }
      ]
    }


# Plugins
Plugins can be used to load additional context into a chat, or create embeddings from an external data source. Here's some plugins we have built so far:
- [asana.mdx](./autodoc/plugins/asana.mdx)
- [downloader](./autodoc/plugins/downloader) - (subdirectory)
- [embedding.mdx](./autodoc/plugins/embedding.mdx)
- [figma.mdx](./autodoc/plugins/figma.mdx)
- [github.mdx](./autodoc/plugins/github.mdx)
- [jira.mdx](./autodoc/plugins/jira.mdx)
- [language.mdx](./autodoc/plugins/language.mdx)
- [linear.mdx](./autodoc/plugins/linear.mdx)
- [notion.mdx](./autodoc/plugins/notion.mdx)
- [plugins.mdx](./autodoc/plugins/plugins.mdx)
- [types.mdx](./autodoc/plugins/types.mdx)
- [vim.mdx](./autodoc/plugins/vim.mdx)

# Tools
Tools can be used by agents to do complex interations with other systems, or the local system. Here's some tools we have built so far:
- [Asana Tool Directory](./autodoc/tools/asana)
- [askHuman Tool](./autodoc/tools/askHuman.mdx)
- [callPlugin Tool](./autodoc/tools/callPlugin.mdx)
- [embeddingSearch Tool](./autodoc/tools/embeddingSearch.mdx)
- [execCommand Tool](./autodoc/tools/execCommand.mdx)
- [fileSearch Tool](./autodoc/tools/fileSearch.mdx)
- [finalAnswer Tool](./autodoc/tools/finalAnswer.mdx)
- [GitHub Tool Directory](./autodoc/tools/github)
- [lintFile Tool](./autodoc/tools/lintFile.mdx)
- [patch Tool](./autodoc/tools/patch.mdx)
- [readBlocks Tool](./autodoc/tools/readBlocks.mdx)
- [readFile Tool](./autodoc/tools/readFile.mdx)
- [textSearch Tool](./autodoc/tools/textSearch.mdx)
- [visionTool Tool](./autodoc/tools/visionTool.mdx)
- [writeFile Tool](./autodoc/tools/writeFile.mdx)



# CLI Commands
This command line tool accepts the following inputs (commands):

1. `init`: Initializes the tool. Creates config in `.knowhow`
3. `embed`: Creates embeddings from the configured `embedSources`.
7. `chat`: Starts a chat session.
2. `generate`: Processes the `sources` from config to make AI generated files
4. `upload`: Uploads embeddings to s3 if configured.
5. `download`: Downloads embeddings from s3 if configured.
6. `upload:openai`: beta: upload an assistant to openai alongside files

# Chat
Activated via: `knowhow chat`

This command line tool allows users to provide various inputs to interact with an AI assistant.

The available commands include:
   - `agent`: Toggle the use of a specific agent.
   - `agents`: List and select from available agents.
   - `debug`: Toggle debug mode.
   - `multi`: Enable or disable multi-line input.
   - `search`: Search for embeddings.
   - `clear`: Clear the chat history.
   - `exit`: Exit the tool.

## Agents
Activated via: `agent` or `agents` within a knowhow chat session

Agents are able to use tools to accomplish goals. Out of the box knowhow includes:
- Developer Agent
- Researcher Agent
