## Annotations subcommand plan

- **goal**: Add `annotations` subcommand to fetch build annotations by slug or URL.
- **inputs**:
  - `org/pipeline/buildNumber`
  - `@https://buildkite.com/org/pipeline/builds/buildNumber` (leading `@` allowed)
- **api**: `GET https://api.buildkite.com/v2/organizations/{org}/pipelines/{pipeline}/builds/{number}/annotations`
- **output**: support `plain` and `json` (Alfred later)

### Iterative implementation plan
- **1. Wire command placeholder**
  - Update `src/index.ts` to add `annotations <build>` and use existing handler infra:
    - `.command('annotations').description('Show annotations for a build').argument('<build>')`
  - In the global `preAction` hook, when `commandName === 'annotations'`, attach the positional arg to options:
    - `cmd.mergedOptions.buildArg = cmd.args?.[0]`
  - Export the command from `src/commands/index.ts` as `ListAnnotations`.
  - Create `src/commands/ListAnnotations.ts` extending `BaseCommand`; initially parse and log, return 0.

- **2. Parser**
  - Add `src/utils/parseBuildRef.ts` exporting `parseBuildRef(input)` -> `{ org, pipeline, number }`.
  - Accept slug and URL; allow optional leading `@`.
  - Validate number as integer.
  - Slug regex: `^([^/]+)/([^/]+)/(\\d+)$`
  - URL regex: `^https?://buildkite.com/([^/]+)/([^/]+)/builds/(\\d+)$`

- **3. REST**
  - Add `BuildkiteRestClient.getBuildAnnotations(org, pipeline, number)`.
  - GET `/organizations/{org}/pipelines/{pipeline}/builds/{number}/annotations` using existing `get<T>()` so caching/rate limits apply (falls under `builds` cache bucket).

- **4. Types**
  - Add `Annotation` to `src/types/index.ts` with: `id`, `context`, `style`, `body_html`, `created_at`, `updated_at`.

- **5. Formatters**
  - Create `src/formatters/annotations/`:
    - `Formatter.ts` (interface + options with basic error flags).
    - `PlainTextFormatter.ts` (print context, style, created/updated, and raw `body_html`).
    - `JsonFormatter.ts` (stable JSON shape).
  - Update `src/formatters/FormatterFactory.ts`:
    - Add `ANNOTATION` to `FormatterType`.
    - Route via `getAnnotationFormatter(format)`.
  - Update `src/formatters/index.ts` to export `AnnotationFormatter` and `getAnnotationFormatter`.

- **6. Command implementation**
  - In `ListAnnotations.execute(options)`:
    - Ensure initialized via `await this.ensureInitialized()`.
    - Read `options.buildArg`; if absent, show usage error.
    - Parse via `parseBuildRef`.
    - Fetch via `this.restClient.getBuildAnnotations(org, pipeline, number)`.
    - Render with `FormatterFactory.getFormatter(FormatterType.ANNOTATION, options.format)`.
    - Handle empty results and error cases; return 0/1.

- **7. Validation**
  - `npm run build`
  - `npm run start -- annotations gusto/zenpayroll/1287418`
  - `npm run start -- annotations @https://buildkite.com/gusto/zenpayroll/builds/1287418`
  - `npm run start -- annotations gusto/zenpayroll/1287418 --format json`

- **8. Docs**
  - Update `README.md`:
    - Add usage and examples for slug and URL.
    - Mention `@` URL prefix acceptance.
    - Note formats: `plain`, `json`.

- **9. Follow-ups (optional)**
  - Alfred formatter for annotations.
  - Convert `body_html` to text for terminals.
  - Unit tests for `parseBuildRef`.

### Assumptions
- Use REST for annotations; no GraphQL changes.
- Caching uses existing REST cache bucket.
- Token management unchanged.

### Open question
- Positional `<build>` only, or also support a `--build` flag alias?