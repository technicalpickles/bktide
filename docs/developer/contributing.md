# Contributing to bktide

Thank you for your interest in contributing to bktide! This guide will help you get started with development and understand our contribution process.

## Development Setup

### Prerequisites

- **Node.js 18+** - Required for development
- **npm** - For package management
- **Git** - For version control
- **Buildkite API Token** - For testing (with GraphQL scope)

### Getting Started

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/yourusername/bktide.git
   cd bktide
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the project:**
   ```bash
   npm run build
   ```

4. **Set up authentication:**
   ```bash
   # Store your Buildkite API token for testing
   bin/bktide token --store
   ```

5. **Run a test command:**
   ```bash
   bin/bktide viewer --debug
   ```

### Development Workflow

#### Running the CLI During Development

```bash
# Use the local binary for testing
bin/bktide <command> [options]

# Run with TypeScript source maps for better debugging
npm run dev:sourcemap -- <command> [options]

# Run compiled version with source maps
npm run dev:compiled -- <command> [options]
```

#### Building and Testing

```bash
# Build TypeScript to JavaScript
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate test coverage
npm run test:coverage

# Run linting
npm run lint
```

## Project Structure

```
src/
├── commands/           # Command implementations
├── formatters/         # Output formatting (plain, JSON, Alfred)
├── services/          # API clients and core services
├── types/             # TypeScript type definitions
├── ui/                # User interface components (tables, progress, etc.)
├── utils/             # Utility functions
└── graphql/           # GraphQL queries and generated types
```

## Development Guidelines

### Code Style

- **TypeScript**: Use strict TypeScript with proper typing
- **ES Modules**: Always use `import`/`export`, never `require()`
- **Formatting**: Use Prettier (runs automatically on commit)
- **Linting**: Follow ESLint rules (check with `npm run lint`)

### Architecture Patterns

#### Commands
All commands extend `BaseCommand` and follow this pattern:

```typescript
export class MyCommand extends BaseCommand {
  static requiresToken = true; // or false

  async execute(options: MyCommandOptions): Promise<number> {
    try {
      await this.ensureInitialized();
      
      // Command logic here
      const data = await this.fetchData(options);
      
      // Format and output
      const formatter = this.getFormatter(FormatterType.MY_TYPE, options);
      const output = formatter.format(data);
      logger.console(output);
      
      return 0; // Success
    } catch (error) {
      this.handleError(error, options.debug);
      return 1; // Error
    }
  }
}
```

#### Formatters
Create formatters for each output type (plain, JSON, Alfred):

```typescript
export class PlainTextFormatter extends BaseFormatter {
  formatEntities(entities: MyEntity[]): string {
    // Implementation
  }
  
  formatError(action: string, error: any): string {
    // Error formatting
  }
}
```

#### API Integration
- **Prefer GraphQL** over REST when possible
- **Use caching** for performance
- **Handle errors gracefully** with user-friendly messages

### UI Guidelines

#### Icons and Symbols
Use the centralized icon system:

```typescript
import { getStateIcon, getAnnotationIcon } from '../ui/theme.js';

// ✅ Good
const icon = getStateIcon('PASSED');

// ❌ Bad - don't hardcode
const icon = '✅';
```

#### Tips and Hints
Use the standardized tip formatting:

```typescript
import { formatTips, TipStyle } from '../ui/theme.js';

const tips = ['Use --org <name> to filter results'];
if (tips.length > 0) {
  lines.push('');
  lines.push(formatTips(tips, TipStyle.GROUPED));
}
```

#### Error Handling
Provide helpful, actionable error messages:

```typescript
// ✅ Good - specific and actionable
throw new Error('Build 123 not found in org/pipeline. Check the build number and your access permissions.');

// ❌ Bad - generic
throw new Error('Not found');
```

## Testing

### Testing Strategy
We use a hybrid testing approach:

1. **Pattern-based mocks** - Generate realistic test data from real API patterns
2. **Unit tests** - Test individual functions and classes
3. **Integration tests** - Test command workflows
4. **Manual testing** - Follow the [testing checklist](testing-checklist.md)

### Writing Tests

```typescript
// Example test
describe('MyCommand', () => {
  it('should format output correctly', async () => {
    const command = new MyCommand();
    const result = await command.execute({ format: 'json' });
    
    expect(result).toBe(0);
    // Add assertions
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- MyCommand.test.ts

# Run with coverage
npm run test:coverage

# Extract patterns from real data (requires token)
npm run test:extract-patterns
```

## GraphQL Development

### Adding New Queries

1. **Add query to `src/graphql/queries.ts`:**
   ```typescript
   export const GET_MY_DATA = gql`
     query GetMyData($param: String!) {
       myData(param: $param) {
         id
         name
         bodyHtml  # Prefer HTML over text fields
       }
     }
   `;
   ```

2. **Generate types:**
   ```bash
   npm run codegen
   ```

3. **Use generated types:**
   ```typescript
   import { GetMyDataQuery } from '../graphql/generated/graphql.js';
   
   const data = await this.query<GetMyDataQuery>(GET_MY_DATA, variables);
   ```

## Documentation

### Writing Documentation
- **User docs** go in `docs/user/` - focus on how to use features
- **Developer docs** go in `docs/developer/` - focus on how to build/modify
- **Reference docs** go in `docs/reference/` - complete technical reference

### Documentation Standards
- Use clear, concise language
- Include code examples
- Add troubleshooting sections
- Update navigation in README files

## Submitting Changes

### Pull Request Process

1. **Create a feature branch:**
   ```bash
   git checkout -b feature/my-new-feature
   ```

2. **Make your changes:**
   - Follow coding standards
   - Add tests for new functionality
   - Update documentation

3. **Test thoroughly:**
   ```bash
   npm run build
   npm run lint
   npm test
   bin/bktide <test-your-changes>
   ```

4. **Commit with clear messages:**
   ```bash
   git commit -m "Add support for filtering builds by creator"
   ```

5. **Push and create pull request:**
   ```bash
   git push origin feature/my-new-feature
   ```

### Pull Request Guidelines

- **Clear title and description** - Explain what and why
- **Link to issues** - Reference any related issues
- **Include tests** - New features need test coverage
- **Update documentation** - Keep docs in sync with changes
- **Follow checklist** - Use the PR template checklist

### Code Review Process

- All changes require review before merging
- Address feedback promptly and respectfully  
- Maintain backwards compatibility when possible
- Consider impact on existing users

## Release Process

### Versioning
We use a hybrid CalVer+SemVer approach:
- `MAJOR.MINOR.PATCH`
- MAJOR.MINOR are manually curated
- PATCH is auto-generated from timestamp

### Automated Releases
- Releases happen automatically on merge to `main`
- Only material changes trigger releases
- Alfred workflow is packaged and published

### Manual Version Bumps
To bump MAJOR or MINOR versions:

1. **Update `package.json`:**
   ```json
   {
     "version": "2.0.0"
   }
   ```

2. **Commit and merge:**
   ```bash
   git commit -m "Bump major version to 2.0"
   ```

## Getting Help

### Development Questions
- Check existing [documentation](../README.md)
- Look at similar implementations in the codebase
- Ask questions in issues or discussions

### Debugging
- Use `--debug` flag for verbose output
- Check logs in `~/.local/state/bktide/logs/`
- Use TypeScript source maps: `npm run dev:sourcemap`

### Common Development Tasks

```bash
# Add a new command
# 1. Create src/commands/MyCommand.ts
# 2. Add to src/commands/index.ts
# 3. Wire up in src/index.ts
# 4. Add formatters in src/formatters/my-entity/
# 5. Add tests

# Add a new GraphQL query
# 1. Add to src/graphql/queries.ts
# 2. Run npm run codegen
# 3. Use generated types in your code

# Debug API issues
bin/bktide viewer --debug --no-cache

# Test Alfred workflow locally
npm run package
# Import pkg/bktide-workflow-*.alfredworkflow into Alfred
```

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow
- Maintain a welcoming environment

## Questions?

- **Issues**: For bugs and feature requests
- **Discussions**: For questions and general discussion
- **Documentation**: Check the [docs](../README.md) first

Thank you for contributing to bktide! 🚀
