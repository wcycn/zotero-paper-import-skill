# Zotero Paper Import Skill

A reusable Codex skill for turning a definite paper list into verified local files and linked Zotero records.

它将文献身份核对、合法全文与 Supporting Information（SI）获取、本地文件整理、Zotero 去重入库和多设备链接附件管理串成一个可重复工作流。

## Why

Zotero's metadata sync is excellent, but large PDF libraries can quickly exceed hosted-storage quotas. Linked attachments solve the storage problem, yet leave several manual steps: finding the correct publication, downloading the article and supplements, naming files consistently, preventing duplicates, and attaching them to the right Zotero item.

This skill coordinates those steps while keeping PDFs in a user-controlled directory.

## Features

- Resolves papers by DOI, arXiv ID, PMID, exact title, or official URL.
- Prefers final publication metadata while retaining preprint identifiers.
- Retrieves only lawful open-access, publisher-authorized, or institution-authorized copies.
- Supports a persistent user choice for downloading SI.
- Verifies PDF signatures, file size, path containment, and SHA-256.
- Deduplicates Zotero parents by DOI and normalized title.
- Creates portable Zotero `linked_file` attachments instead of stored attachments.
- Keeps local configuration and collection identifiers outside the repository.
- Works with optional file synchronizers such as Syncthing and attachment managers such as Attanger.
- Includes a dependency-free Node.js importer and offline smoke tests.

## Scope

The deterministic helper performs validation and Zotero local-API import. Metadata discovery and lawful retrieval are orchestrated by the agent using the tools available in its environment.

This project is not a Zotero extension, a paywall bypasser, or a cloud-storage provider.

## Requirements

- Zotero Desktop with local API access enabled.
- A Codex or compatible agent that can load `SKILL.md`.
- Node.js 18 or newer for the import helper.
- A local directory configured in Zotero as the **Linked Attachment Base Directory**.
- Optional: Syncthing, Nextcloud, Dropbox, or another file synchronizer for PDFs.
- Optional: Attanger or a similar Zotero extension for post-import renaming.

## Repository Layout

```text
.
├── README.md
├── LICENSE
├── package.json
├── tests
│   └── importer.test.mjs
└── zotero-paper-import
    ├── SKILL.md
    ├── config.example.json
    ├── agents
    │   └── openai.yaml
    ├── references
    │   ├── configuration.md
    │   └── manifest-schema.md
    └── scripts
        └── import_to_zotero.mjs
```

## Installation

Clone the repository:

```bash
git clone https://github.com/wcycn/zotero-paper-import-skill.git
cd zotero-paper-import-skill
```

Install it for the current Codex user:

```bash
mkdir -p ~/.codex/skills
cp -a zotero-paper-import ~/.codex/skills/
```

For an agent that discovers shared skills from `~/.agents/skills`:

```bash
mkdir -p ~/.agents/skills
cp -a zotero-paper-import ~/.agents/skills/
```

Restart the agent or open a new task if the skill does not appear immediately.

## Configuration

Create a private configuration:

```bash
mkdir -p ~/.config/zotero-paper-import
cp zotero-paper-import/config.example.json ~/.config/zotero-paper-import/config.json
```

Edit the copied file:

```json
{
  "basePath": "/absolute/path/to/Papers",
  "destinationRoot": "/absolute/path/to/Papers/Research",
  "collection": {
    "name": "Research Papers"
  },
  "includeSupportingInformation": true,
  "zoteroApi": "http://127.0.0.1:23119/api"
}
```

The Zotero collection must already exist. A collection key may be supplied for precise selection, but the exact collection name is sufficient.

Do not commit the private configuration. It can contain local paths and collection identifiers.

## Usage

Invoke the skill explicitly:

```text
Use $zotero-paper-import to add DOI 10.xxxx/xxxxx to Zotero.
```

Batch import a definite list:

```text
Use $zotero-paper-import to verify and import these five papers.
Use my saved preference for Supporting Information.
```

The first local-API request on a Zotero profile may display an authorization dialog. Select **Always Allow** to avoid per-paper prompts.

## Import Helper

The agent creates a per-paper manifest and validates it before import:

```bash
node zotero-paper-import/scripts/import_to_zotero.mjs \
  --validate-only \
  --manifest /path/to/manifest.json
```

Import after validation:

```bash
node zotero-paper-import/scripts/import_to_zotero.mjs \
  --manifest /path/to/manifest.json
```

Use a non-default configuration:

```bash
node zotero-paper-import/scripts/import_to_zotero.mjs \
  --config /path/to/config.json \
  --manifest /path/to/manifest.json
```

The helper never writes directly to `zotero.sqlite`.

## Multiple Computers

Zotero synchronizes bibliographic metadata and built-in annotations. A separate file synchronizer can synchronize linked PDFs.

Each computer may use a different absolute base directory. Keep the relative directory layout identical and configure Zotero's Linked Attachment Base Directory separately on every device.

Avoid editing the same external PDF on two computers before file synchronization completes.

## Privacy and Safety

- No usernames, hostnames, IP addresses, collection keys, paper files, or access tokens are included in the repository.
- Local configuration, manifests, downloaded papers, and credentials are ignored by Git.
- The skill does not inspect browser cookies or saved passwords.
- It does not bypass paywalls, DRM, institutional authentication, CAPTCHA, or two-factor authentication.
- It does not overwrite potentially annotated files or delete duplicate Zotero entries automatically.

## Tests

```bash
npm test
```

The offline tests cover configuration merging, portable linked paths, SHA-256 generation, path-containment enforcement, and invalid-PDF rejection. They do not require Zotero or network access.

## License

MIT License. See [LICENSE](LICENSE).
