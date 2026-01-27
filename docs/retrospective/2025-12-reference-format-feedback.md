# Reference Format Feedback

**Date:** 2025-12
**Context:** User attempted to use GitHub-style reference format
**Type:** UX friction

## What Happened

User tried to reference a build using the GitHub-flavored format:

```
$ npx bktide build acme/example-pipeline#29627
{
  "error": true,
  "errorType": "api",
  "message": "Invalid build reference format: acme/example-pipeline#29627. Expected org/pipeline/number or @https://buildkite.com/org/pipeline/builds/number"
}
```

## The Issue

Users familiar with GitHub's reference format (`org/repo#number`) naturally tried the same pattern with Buildkite builds. The CLI rejected this format even though the intent was clear.

## Recommendation

Be flexible with reference formats. Support GitHub-flavored references like `org/pipeline#number` as an alternative to `org/pipeline/number`.

This improves UX for users who:
- Copy references from chat/docs that use the `#` format
- Are accustomed to GitHub's conventions
- Want less typing (shorter format)

## Related

- The hash format was implemented in PR #3 (feature/hash-format-build-ref)
- See `src/utils/parseBuildkiteReference.ts` for reference parsing
