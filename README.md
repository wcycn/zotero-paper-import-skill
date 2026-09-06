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

### Install automatically with Codex

Copy the following prompt into Codex. It asks the agent to install the skill for the current user and verify the result instead of merely printing shell commands.

```text
请帮我自动安装下面这个 Codex Skill：

https://github.com/wcycn/zotero-paper-import-skill

具体要求：

1. 不要只提供安装命令，请直接完成安装和验证。
2. 先阅读仓库中的 README.md 和完整的 zotero-paper-import/SKILL.md。
3. 如果当前环境提供 $skill-installer，优先使用它；否则将仓库下载到临时目录后手动安装。
4. 将仓库内层的 zotero-paper-import 目录安装到当前用户的 Codex Skills 目录：
   - 优先使用 $CODEX_HOME/skills/zotero-paper-import；
   - 如果未设置 CODEX_HOME，使用 ~/.codex/skills/zotero-paper-import；
   - 注意不要错误地多嵌套一层仓库目录。
5. 如果已经存在旧版本，先检查差异并安全更新；不要删除或覆盖用户已有的私人配置，尤其是 ~/.config/zotero-paper-import/config.json。
6. 检查运行条件，包括 Git、Node.js 版本是否满足要求（Node.js 需要 18 或更高版本）。如需 sudo 或系统级安装，先征得我的允许。
7. 安装完成后必须执行验证：
   - 确认 SKILL.md、config.example.json 和导入脚本均已安装；
   - 检查 SKILL.md 的名称和 YAML frontmatter；
   - 在下载的仓库根目录运行 npm test；
   - 确认全部测试通过；
   - 确认安装目录中没有写入用户名、Token、IP 地址或其他私人配置。
8. 不要为了测试而向 Zotero 导入真实论文或修改现有文库。
9. 最后向我汇报实际安装路径、Git commit 或版本、Node.js 版本、测试结果、是否需要重新打开 Codex，以及一条调用示例。
10. 如果当前任务无法立即刷新 Skill 列表，请明确说明需要重新打开 Codex 或新建任务，不要把它误判为安装失败。

除非遇到权限、缺少必要软件或必须由我选择的配置，否则请自行完成整个过程。
```

After installation, open a new Codex task if the skill does not appear immediately.

### Install manually

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
