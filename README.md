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
