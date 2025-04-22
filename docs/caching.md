# Caching

This CLI implements disk-based caching to improve performance, particularly for repeated queries. Cached data is stored in the `~/.bktide/cache/` directory.

## Default Cache TTL Values

- Viewer data: 1 hour
- Organization data: 1 hour
- Pipeline data: 1 minute
- Build data: 30 seconds
- Other queries: 30 seconds

## Cache Control Options

You can control caching behavior with these options:

```bash
# Disable caching for a command
npm run dev -- viewer --no-cache

# Clear the cache before executing a command
npm run dev -- viewer --clear-cache

# Set a custom TTL (time-to-live) in milliseconds
npm run dev -- viewer --cache-ttl 60000  # 1 minute TTL
```

## API Caching

The caching system works for both GraphQL and REST API calls:

- **GraphQL**: Caches responses for GraphQL queries like `GET_VIEWER` and `GET_ORGANIZATIONS`
- **REST API**: Caches responses for REST endpoints like `/organizations/:org/builds`

This is particularly useful for the `builds` command, which can be used for filtering without hitting the API repeatedly:

```bash
# First call fetches from API
npm run dev -- builds --org your-org --count 50

# Subsequent filtering uses cached data
npm run dev -- builds --org your-org --count 50 --pipeline specific-pipeline
npm run dev -- builds --org your-org --count 50 --branch main
```

## Automatic Cache Invalidation

- The cache is automatically invalidated when your API token changes
- Mutation operations (like triggering a build) will invalidate the relevant cache types
- Each cache entry has a TTL after which it will expire and be refreshed

## Cache Implementation

The caching system uses `node-persist` for persistent storage between CLI invocations. This provides:

- Disk-based storage that persists between CLI runs
- Automatic TTL management
- Token-aware cache invalidation
- Type-based cache management (viewer, organizations, etc.) 