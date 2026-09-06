# Configuration

Copy `config.example.json` to:

```text
~/.config/zotero-paper-import/config.json
```

The importer also accepts `--config /path/to/config.json`, and the environment variable `ZOTERO_PAPER_IMPORT_CONFIG` may point to a different file.

## Fields

- `basePath`: absolute path configured in Zotero as the Linked Attachment Base Directory.
- `destinationRoot`: directory below `basePath` where downloaded papers and supplements should be organized.
- `collection.key`: optional Zotero collection key. It is the most precise selector.
- `collection.name`: exact existing collection name, used when no key is supplied or the key cannot be found.
- `includeSupportingInformation`: persistent explicit choice for SI downloads. Use `true` or `false`; omit it to ask once per definite batch.
- `zoteroApi`: local Zotero API endpoint. The standard endpoint is `http://127.0.0.1:23119/api`.

Both `basePath` and `destinationRoot` must be absolute, and `destinationRoot` must be inside `basePath`. The import helper accepts `~` in configuration values and expands it to the current user's home directory.

Configuration may contain local paths and private collection identifiers. Keep it outside the skill directory and never commit it.

For multiple computers, each client may use a different absolute `basePath`, provided the relative layout below it is identical and Zotero's Linked Attachment Base Directory is configured independently on each client.
