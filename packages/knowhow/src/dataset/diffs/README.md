# Goal
The purpose of this folder is to collect examples of file modifications to fine tune GPT

The dataset should be a JSON reprensentation of a chat thread, where the user has requested some modification to a file, and then a before file and after file contents, which will be fed into the createPatchFile function of the diff tool

The function that generates this structure should be generic so that you can fine tune using examples generated from any selected files in the codebase

## Procedure for generating dataset
- use glob to list out files that would be in the embeddings
- for each file, get the commit hash via git log --pretty=oneline -- filepath
- for each file diff the current text against a git show commit:filepath, so that we can generate a diff of all the previous changes
- summarize the diff with GPT and have it construct a synthetic user message that would be requesting it to modify the file in those ways
