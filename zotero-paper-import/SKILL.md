---
name: zotero-paper-import
description: Verify academic-paper metadata, lawfully retrieve main text and available Supporting Information, store files in a user-configured local library, and create or merge Zotero records with portable linked-file attachments. Use when the user asks to add, import, download, archive, or batch-organize definite papers in Zotero（加入 Zotero、论文入库、下载正文和 SI、加入文库）. Do not activate for explanation-only reading requests unless library import is also requested.
---

# Zotero Paper Import

Turn a definite paper identifier or list into verified local files and usable Zotero entries. Do not stop after finding a URL or downloading an unbound PDF.

## Configuration

Before importing, read [references/configuration.md](references/configuration.md). Use the first available configuration source:

1. a path explicitly supplied by the user;
2. `ZOTERO_PAPER_IMPORT_CONFIG`;
3. `~/.config/zotero-paper-import/config.json`.

If none exists, help the user create one from `config.example.json`. Require an absolute linked-attachment base path and an existing Zotero collection key or exact name. Do not guess personal paths, hosts, usernames, or collection identifiers.

Treat `includeSupportingInformation: true` or `false` in the user's configuration as their persistent explicit SI choice. If the field is absent and the user has not specified a choice, ask once for the whole definite batch before downloading anything.

## Workflow

1. Resolve every requested paper using a DOI, arXiv ID, PMID, exact title, or official landing page. Prefer final publication metadata while retaining preprint identifiers in Zotero's `extra` field.
2. Check Zotero and the configured local library before downloading. Deduplicate by DOI first, then stable identifier, normalized title, linked path, and file hash. Never delete duplicates automatically.
3. Retrieve content only through lawful open-access, publisher API, or user-authorized institutional routes. If a dedicated literature-downloader skill is available, use it with the already-established SI choice. Never bypass paywalls, DRM, authentication, or identity-bearing verification.
4. Verify each file before import: expected format signature, non-trivial size, readable page count when tooling permits, source URL, and SHA-256. Reject login or error HTML saved with a PDF extension.
5. Store files below `destinationRoot`, using one stable identifier directory per paper and separate `PDFs/` and `SupportingInformation/` directories. Never overwrite a possibly annotated file; use a versioned filename or stop on a real conflict.
6. Build a manifest using [references/manifest-schema.md](references/manifest-schema.md). Validate it with:

   ```bash
   node scripts/import_to_zotero.mjs --validate-only --manifest /path/to/manifest.json
   ```

7. With Zotero Desktop open, run the importer without `--validate-only`. Create or reuse one parent item, ensure collection membership, and use only `linked_file` attachments. Never write directly to `zotero.sqlite`.
8. Verify the resulting parent and attachment paths. Attachment-management plugins may rename files after import; re-read Zotero rather than assuming the original filename remains current.
9. Report the publication identity, main-text status, SI status, Zotero status, local directory, and only the actions still required from the user.

## Authorization and Synchronization

- The first use on each Zotero profile may display a local-API authorization dialog. Ask the user to select **Always Allow / 始终允许**. This is a one-time profile authorization.
- If the local API is disabled, ask the user to enable local application communication in Zotero and restart it.
- Zotero metadata synchronization and linked-file synchronization are separate. When users choose Syncthing, cloud storage, or another file synchronizer, verify that mechanism independently before claiming multi-device completion.
- Portable `attachments:` paths require each Zotero client to configure its own Linked Attachment Base Directory.

## Stop Conditions

Ask for input only when identity is genuinely ambiguous, the batch is not definite, lawful access requires an authenticated handoff, configuration is missing, or a file conflict risks losing annotations. Missing SI should be reported as `not_found`; it is not itself a reason to pause.
