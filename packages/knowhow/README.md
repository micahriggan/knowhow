# Knowhow

Knowhow is a powerful tool for managing and utilizing project-specific knowledge and configurations.

## Features

- Global configuration storage
- Template management
- Plugin system
- Embedding generation
- Custom agents

## Global Configuration

Knowhow now supports a global configuration directory located at `~/.knowhow`. This directory stores global templates and configurations that can be shared across multiple projects.

### Global Config Structure

```
~/.knowhow/
├── knowhow.json
└── prompts/
    └── [template files]
```

- `knowhow.json`: Global configuration file
- `prompts/`: Directory containing global template files

### Initialization Process

When initializing a new Knowhow project:

1. The global config directory is created if it doesn't exist.
2. Global templates are checked first and copied to the local project.
3. If a template doesn't exist globally, it's created both globally and locally.

This ensures consistency across projects while allowing for project-specific customizations.

## Usage

[Add usage instructions here]

## Contributing

[Add contribution guidelines here]

## License

[Add license information here]