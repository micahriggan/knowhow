# Goal
This project is meant to ingest a codebase and create a folder structure that contains AI generated documentation.
The documentation is generated via a list of sources. The output should be a markdown file per matching source file.
The knowhow generation is done with a root prompt that explains the format of what the AI should generate per file.
The tool should generate a hashes file that maps filepath to MD5 hash, for fast change detection
The hashes file should also contain the hash of the prompt used to generate the AI documentation

# Example
```
promptsDir = ".knowhow/prompts"
sources = [
   { input: "components/**/*.mdx", output: ".knowhow/docs/components/", prompt: "ComponentDocumenter" },
   { input: ".knowhow/docs/**/*.mdx", output: ".knowhow/README.mdx", prompt: "ProjectDocumenter" }
]
```

## Generated Folder Structure
This structure can be used to store the generated content. The tool should create this folder structure on init
* .knowhow
  * prompts
  * docs
  * .hashes

## Commands
* knowhow init
  * creates the folder structure, with a JSON file created at the root, knowhow.json
* knowhow generate
  * process each source
  * reads the configured prompt into memory
  * checks the hashes and processes file if the hashes aren't present or don't match
  * summarizes each file with the prompt, outputting either a single file, or a 1:1 mapping, depending on output configuration
* knowhow embed
  * creates an embedding from each file in .knowhow/docs, and stores all embeddings in in .knowhow/embedding.json

## Hashes Config Structure
{
  "some/filepath": {
    "fileHash": "abc123",
    "promptHash": "abc123"
  }
}

## Environment Variables
Make sure you've set the following env variables
* export OPENAI_KEY="sk-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"


# Phase 2
Now that I've experimented with the first version of knowhow, the primary usecase I had was boiling down many files into knowledge, and then creating embeddings from that knowledge.
From here, I'd like to overhaul this to support a chat feature, as well as defining a language configuration, so that you can define words that map to folders, files, or other datasources

The language definition should let you do things like defining files that get loaded in as context when you say a specific word like:

```
{ "terms": { "DCR": ["./services/models/DataChangeRequest"]  } }
```

Terms could load files, or pull requests, or any other type of data you'd want. When a message comes in, the terms will be detected, and then context will be added to the prompt.

Additionally I want to enable vim support by finding any filepath that includes .sw* and parsing out the original file name from there and adding those to the context of the chat

Terms can map to multiple types of data:
* raw text
* files / filepaths
* github data:
  * prs, commits, files, etc



Here's what I'm thinking for the flow, with an example message:

Me: What steps are required for building a DCR?
Ai:
    * Check Message for any defined terms, and expand the prompt with the context
    * AI can search global embeddings for context related to the message
    * AI can define a new term
      * file paths
      * definitions / alias
    * AI can summarize all the files surfaced by the request


This would require a few methods to bootstrap the project:
* Embedding creation - use the configured embeddings directory to create embeddings from the source files
  * needs to ignore certain files in .gitignore



This would require a few tools for the AI to call:
* Embedding Search - search a named embedding for some content
* Define new term - map a word to a list of datasources (folders, files, prs, etc)
* Summarize datasources - given a list of datasources, convert them to strings and then summarize

## Config Changes
* create language.json

