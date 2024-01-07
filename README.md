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

1. Initialization: Run knowhow init to create the necessary folder structure and configuration files.
2. Generation: Use knowhow generate to process source files and produce documentation.
3. Embedding: Execute knowhow embed to create embeddings from the generated documentation.
4. Chat: Run knowhow chat to start a chat session with additional context provided by the plugins

## Configuration

Knowhow is highly configurable, allowing you to specify source patterns, output directories, and custom prompts for documentation generation. Here's an example configuration snippet:

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

## Language Plugin

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

### VIM Plugin

The VIM Plugin is an integral part of the Knowhow tool, designed to enhance the user experience by integrating with the VIM text editor. This plugin provides the functionality to detect and interact with files that are currently open in VIM, offering a seamless workflow for developers who prefer using VIM for their coding tasks.

#### Key Features

* File Detection: The plugin can identify all files that are currently being edited in VIM by looking for swap files (.swp) within the project directory.
* Content Retrieval: It can read the contents of the files that are open in VIM, allowing for real-time interaction and updates within the Knowhow tool.
* Error Handling: The plugin includes error handling for cases where the file does not exist or is too large to process, ensuring stability and reliability.

#### Usage

To use the VIM Plugin, simply ensure that it is included in the plugins array of your Knowhow configuration. The plugin will automatically detect any VIM swap files and provide the content of the associated files.

#### Example Output

When the VIM Plugin is called, it will output a message detailing the files that are currently open in VIM. Here's an example of what the output might look like:

    Reading file ./README.md
    Reading file ./src/plugins/github.ts
    Reading file ./src/plugins/vim.ts



## Contributing

Contributions to Knowhow are welcome! Whether it's adding new features, improving the chat interface, or refining the language configurations, your input can help make Knowhow an even more robust tool.

