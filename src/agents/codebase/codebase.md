# Agent Goals
This agent should receive a user request, collect relevant files that should be read, and then research the request in context of the files, and then output a plan, of which files need to be modified.

The agent should also plan to test it's changes. The testing phase can be accomplished through writing automated tests, executing terminal commands to verify things worked etc.

# Simple Example Usage
Codebase Agent: Write a plugin that takes in a user prompt, and then determines a good thing to google would be for that prompt, and then execute the google search returning the top 5 results.

The agent should analzye the folder structure via RAG, perhaps multiple shots to find the plugins hiearchy.

Once the examples are found the agent should contstruct a development plan for how the plugin should wbe written. Then the agent should use some tools to read/write the files.

Search Files - Does a RAG search to try and find relevant files to the AI's goal.

Read File - Opens a file and provides the full file as context to the LLM. If the file is too long, then it will be truncated at some point.

Scan File - Opens a file, and reads from line A to line B, returning the contents to the LLM, also tells the LLM how many lines there are

Write File - Writes the full contents of a file

Patch File - The LLM outputs a patchfile which can be applied. This reduces output tokens

Exec Command - The LLM should be able to call the cli to test it's changes, perhaps by running npm test (filename), to verify the tests it wrote pass


# Implementation
Implement the tools using the fs node module and the patch file tool should use the diff node module to apply the patches. Some configuration may be used to help the Agent know how to test it's work. For instance the agent could read the package.json for the test commands, or we could specify how changes can be tested in the knowhow config, since many projects have different testing patterns.
