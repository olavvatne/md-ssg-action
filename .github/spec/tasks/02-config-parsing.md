# Task 02 — Config Parsing & Validation

## Goal

Implement `src/config.js` — read, parse, validate, and normalize `.md-ssg.yml` from the vault root.

## Scope

### `src/config.js`

**Export**: `parseConfig(vaultRoot: string, deps?): Promise<Config>`

`deps` defaults to `{ github: await import("@actions/github") }`. Tests inject a mock `github` object to control `context.repo.repo`.

**Config type**:
```ts
interface Config {
  include: string[];      // glob patterns
  tag: string;            // tag name without '#'
  title: string;          // site title
  basePath: string;       // URL prefix, e.g. "/repo-name"
}
```

**Behavior**:
1. Read `path.join(vaultRoot, ".md-ssg.yml")` as UTF-8.
2. Parse with `js-yaml`.
3. Validate per rules below.
4. Apply defaults: `tag` → `"publish"`, `title` → `deps.github.context.repo.repo`, `base-path` → `"/" + deps.github.context.repo.repo`.
5. Return normalized `Config` object.
6. Throw descriptive error on any validation failure.

### Validation Rules

- File must exist and be valid YAML.
- `include` must be present, must be an array, must have at least one entry.
- `include` entries must be strings.
- `tag` if present must be a non-empty string containing only word characters (`[a-zA-Z0-9_-]`).
- `base-path` if present must start with `/` and not end with `/` (unless it is exactly `/`).
- Unknown keys are silently ignored.

### Error Messages

| Condition | Error message |
|---|---|
| File not found | `"Missing .md-ssg.yml in vault root: <path>"` |
| Invalid YAML | `"Invalid YAML in .md-ssg.yml: <parse error>"` |
| `include` missing or empty | `".md-ssg.yml: 'include' must be a non-empty array of glob patterns"` |
| `tag` invalid format | `".md-ssg.yml: 'tag' must contain only word characters"` |
| `base-path` invalid format | `".md-ssg.yml: 'base-path' must start with '/'"` |

### Edge Cases

- Empty file → YAML parses as `null` → fail with missing `include` error.
- `include: "single-pattern"` (string, not array) → **reject**. Require array syntax.

## Tests — `src/config.test.js`

| Test case | Input | Expected |
|---|---|---|
| Valid minimal config | `include: ["**"]` | Returns config with defaults |
| Valid full config | All fields set | Returns config with provided values |
| Missing `include` | `tag: "publish"` | Throws with descriptive message |
| Empty `include` array | `include: []` | Throws |
| `include` not array | `include: "**"` | Throws |
| Invalid `tag` chars | `tag: "pub lish"` | Throws |
| Invalid `base-path` | `base-path: "no-slash"` | Throws |
| `base-path` trailing slash | `base-path: "/repo/"` | Throws |
| `base-path` exactly `/` | `base-path: "/"` | Allowed |
| Empty file | `""` | Throws with missing include error |
| Missing file | Non-existent path | Throws with file not found |
| Unknown keys | Extra keys present | Silently ignored, config valid |

## Acceptance Criteria

- [ ] `parseConfig` reads and parses `.md-ssg.yml` correctly
- [ ] All validation rules enforced with descriptive errors
- [ ] Defaults applied when optional fields omitted
- [ ] All unit tests pass

## Spec References

- §2 (Config File)
- §4.1 (config.js module spec)
