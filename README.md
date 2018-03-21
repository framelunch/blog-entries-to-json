# Blog entries to json

## How to use

install to project`s local.

```bash
yarn add -D 'framelunch/blog-entries-to-json'
```

add scripts to `package.json` > `scripts`.

```json
"md": "blog-entries-to-json --overview-length 100 --entry-dir entries --summary-path src/static/parties.json --detail-path src/static/parties",
"dev:md": "npm run md -- -w -f",
```
