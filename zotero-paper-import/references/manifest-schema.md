# Import Manifest

The manifest contains paper metadata and files for one Zotero parent item. Local defaults may come from the configuration file.

```json
{
  "item": {
    "itemType": "conferencePaper",
    "title": "Exact paper title",
    "creators": [
      {
        "creatorType": "author",
        "firstName": "Given",
        "lastName": "Family"
      }
    ],
    "date": "2026",
    "conferenceName": "Conference name",
    "proceedingsTitle": "Proceedings title",
    "DOI": "10.xxxx/xxxxx",
    "url": "https://official.example/paper",
    "language": "en",
    "extra": "arXiv: 2601.00001",
    "tags": [
      {"tag": "world model"}
    ]
  },
  "attachments": [
    {
      "title": "Full Text PDF",
      "path": "/absolute/path/to/Papers/Research/2601.00001/PDFs/Author_2026_Title.pdf",
      "contentType": "application/pdf"
    },
    {
      "title": "Supporting Information",
      "path": "/absolute/path/to/Papers/Research/2601.00001/SupportingInformation/Author_2026_Title_SI.pdf",
      "contentType": "application/pdf"
    }
  ]
}
```

The manifest may override `basePath`, `collection`, or `zoteroApi` from the configuration file when a one-off import requires different values.

Requirements:

- `item.itemType`, `item.title`, and at least one attachment are required.
- A base path and collection must be available after configuration and manifest values are merged.
- Attachment paths may be absolute paths below `basePath` or portable Zotero paths beginning with `attachments:`.
- Give multiple SI files distinct attachment titles.
- Do not include credentials, cookies, API secrets, or authentication tokens.

Commands:

```bash
node scripts/import_to_zotero.mjs --validate-only --manifest /path/to/manifest.json
node scripts/import_to_zotero.mjs --manifest /path/to/manifest.json
node scripts/import_to_zotero.mjs --config /path/to/config.json --manifest /path/to/manifest.json
```

`--validate-only` checks merged configuration, path containment, PDF signatures, sizes, and SHA-256 without contacting or changing Zotero.
