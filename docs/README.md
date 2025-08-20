# Documentation

This directory contains all documentation for the bktide CLI, organized by audience and purpose.

## Layout Overview

The documentation is organized into four main sections based on who needs the information:

### 📖 [User Documentation](user/)
**For end users** - People who want to use the bktide CLI

- **Getting Started**: Authentication, shell completions, caching
- **Alfred Integration**: Overview, installation, troubleshooting
- **Troubleshooting**: Common issues and solutions

**When to add here**: User guides, installation instructions, feature explanations, troubleshooting

### 👨‍💻 [Developer Documentation](developer/)
**For contributors** - People who want to develop or modify the CLI

- **Development Guide**: Setup, coding standards, architecture
- **Testing**: Strategy, patterns, test coverage
- **Contributing**: Guidelines for contributing changes
- **Planning**: **Active or Planned** design decisions and planning documents
- **Progress**: **Active** implementation progress records

**When to add here**: Code architecture, development setup, testing strategies, contribution guidelines

### 📚 [Reference Documentation](reference/)
**For everyone** - Reference materials, changelogs, process docs

- **Changelogs**: What changed and when
- **Release Process**: How releases work
- **Commands**: Complete command reference (TODO)
- **Configuration**: All options and settings (TODO)

**When to add here**: Changelogs, process documentation, complete reference materials, configuration guides

### 📦 [Archive](archive/)
**Historical context** - Old planning docs, migrations, progress tracking

- **Planning**: Historical design decisions and planning documents
- **Progress**: Historical implementation progress records
- **Migrations**: API and architecture migration guides

**When to add here**: Completed work, historical context, migration guides for completed changes

## Document Classification Guide

### User Documentation (`docs/user/`)
- ✅ Installation guides
- ✅ Feature explanations
- ✅ Troubleshooting guides
- ✅ Usage examples
- ✅ Configuration for end users
- ❌ Internal architecture details
- ❌ Development setup

### Developer Documentation (`docs/developer/`)
- ✅ Development environment setup
- ✅ Code architecture and patterns
- ✅ Testing strategies and procedures
- ✅ Contribution guidelines
- ✅ Internal API documentation
- ❌ End-user feature guides
- ❌ Installation instructions for users

### Reference Documentation (`docs/reference/`)
- ✅ Complete command reference
- ✅ All configuration options
- ✅ Changelogs and release notes
- ✅ Process documentation
- ✅ API reference (for developers)
- ❌ Step-by-step tutorials
- ❌ Troubleshooting guides

### Archive (`docs/archive/`)
- ✅ Completed planning documents
- ✅ Historical progress records
- ✅ Migration guides for completed changes
- ✅ Old versions of current docs
- ❌ Active development guides
- ❌ Current user documentation

## Quick Decision Tree

**Is this for end users?**
- Yes → `docs/user/`
- No → Continue

**Is this for developers/contributors?**
- Yes → `docs/developer/`
- No → Continue

**Is this reference material or process documentation?**
- Yes → `docs/reference/`
- No → Continue

**Is this historical or completed work?**
- Yes → `docs/archive/`
- No → Reconsider the audience

## Navigation

Each section has its own README with detailed navigation:
- [User Documentation](user/)
- [Developer Documentation](developer/)
- [Reference Documentation](reference/)
- [Archive](archive/)

## Contributing to Documentation

When adding new documentation:

1. **Choose the right section** using the classification guide above
2. **Follow naming conventions**:
   - Use kebab-case for filenames
   - Use descriptive names that indicate the content
   - Include the audience in the name if helpful (e.g., `user-troubleshooting.md`)
3. **Update the section README** to include your new document
4. **Cross-reference appropriately** between sections when needed

## Missing Documentation

The following key documentation still needs to be created:

### Reference Documentation
- `docs/reference/commands.md` - Complete command reference
- `docs/reference/configuration.md` - All configuration options
- `docs/reference/api.md` - Internal API documentation


### Developer Documentation
- `docs/developer/architecture.md` - High-level architecture overview
