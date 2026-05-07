[![NPM version][npm-version-image]][npm-url] [![NPM downloads][npm-downloads-image]][npm-url] [![build][build-image]][build-url] [![MIT License][license-image]][license-url] 

# dicomweb-mcp-server

A [Model Context Protocol (MCP)][mcp-url] server that exposes a DICOMweb-compliant DICOM archive to AI assistants. It lets any MCP-capable client search studies, series and instances, inspect metadata, read Structured Reports, and render image frames — all through natural language.

## Requirements

- Node.js 20 or later
- A running DICOMweb server supporting QIDO-RS and WADO-RS (e.g. [orthanc][orthanc-url])

The following endpoints must be supported by the DICOMweb server:

| Endpoint | Service | Used by |
|---|---|---|
| `GET /studies` | QIDO-RS | Search studies |
| `GET /studies/{study}/series` | QIDO-RS | Search series |
| `GET /studies/{study}/series/{series}/instances` | QIDO-RS | Search instances, search structured reports |
| `GET /studies/{study}/series/{series}/instances/{instance}/metadata` | WADO-RS | Get instance metadata, get structured report text |
| `GET /studies/{study}/series/{series}/instances/{instance}/frames/{frame}/rendered` | WADO-RS | Render instance frame |

## Installation

### Using npx (recommended — no local install needed)

```bash
npx dicomweb-mcp-server
```

The server reads its configuration from a `.env` file located in the **same directory as the script** (see [Configuration](#configuration) below).

### Global install

```bash
npm install -g dicomweb-mcp-server
dicomweb-mcp-server
```

## Configuration

Create a `.env` file with the connection details for your DICOMweb server. Place the file next to wherever the server is executed from (or in the working directory you configure in your MCP client).

```dotenv
# Required
DICOMWEB_HOST=https://your-dicomweb-server/dicomweb

# Optional — authentication
DICOMWEB_AUTH=basic        # basic | bearer
DICOMWEB_USER=username     # required when DICOMWEB_AUTH=basic
DICOMWEB_PASS=password     # required when DICOMWEB_AUTH=basic
DICOMWEB_TOKEN=your-token  # required when DICOMWEB_AUTH=bearer

# Optional — request timeout (milliseconds)
DICOMWEB_TIMEOUT=30000
```

| Variable | Required | Description |
|---|---|---|
| `DICOMWEB_HOST` | Yes | Base URL of the DICOMweb server (used for both QIDO-RS and WADO-RS requests) |
| `DICOMWEB_AUTH` | No | Authentication type: `basic` or `bearer` |
| `DICOMWEB_USER` | Conditional | Username — required when `DICOMWEB_AUTH=basic` |
| `DICOMWEB_PASS` | Conditional | Password — required when `DICOMWEB_AUTH=basic` |
| `DICOMWEB_TOKEN` | Conditional | Bearer token — required when `DICOMWEB_AUTH=bearer` |
| `DICOMWEB_TIMEOUT` | No | Fetch timeout in milliseconds. Omit to disable. |

## MCP Client Setup

### Claude Desktop

Add the server to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "dicomweb": {
      "command": "npx",
      "args": ["-y", "dicomweb-mcp-server"],
      "env": {
        "DICOMWEB_HOST": "https://your-dicomweb-server/dicomweb"
      }
    }
  }
}
```

You can supply all environment variables directly in the `env` block instead of using a `.env` file.

### VS Code (GitHub Copilot Agent Mode)

Add to your VS Code `settings.json` or workspace `.vscode/mcp.json`:

```json
{
  "servers": {
    "dicomweb": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "dicomweb-mcp-server"],
      "env": {
        "DICOMWEB_HOST": "https://your-dicomweb-server/dicomweb"
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project root, or to the global `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "dicomweb": {
      "command": "npx",
      "args": ["-y", "dicomweb-mcp-server"],
      "env": {
        "DICOMWEB_HOST": "https://your-dicomweb-server/dicomweb"
      }
    }
  }
}
```

## Available Tools

### `find-studies`

Searches DICOM studies on the configured DICOMweb server. Results are sorted by study date, newest first.

| Parameter | Type | Description |
|---|---|---|
| `query` | string | Space-separated `key=value` filter string (see [Query Syntax](#query-syntax)). Pass `""` to return all studies. |

**Example prompts**
- *"Find all CT studies for patient John Doe"*
- *"Search for studies from January 2024"*

---

### `find-series`

Searches DICOM series within a single study. Results are sorted by series date, newest first.

| Parameter | Type | Description |
|---|---|---|
| `studyInstanceUid` | string | Study Instance UID — obtain from `find-studies` |
| `query` | string | Space-separated `key=value` filter string. Pass `""` to return all series. |

---

### `find-instances`

Searches DICOM instances within a single series. Results are sorted by Instance Number ascending.

| Parameter | Type | Description |
|---|---|---|
| `studyInstanceUid` | string | Study Instance UID — obtain from `find-studies` |
| `seriesInstanceUid` | string | Series Instance UID — obtain from `find-series` |
| `query` | string | Space-separated `key=value` filter string. Pass `""` to return all instances. |

---

### `find-structured-reports`

Finds all Structured Report (SR) instances in a study by looking for SR-modality series and filtering by known SR SOP Class UIDs.

| Parameter | Type | Description |
|---|---|---|
| `studyInstanceUid` | string | Study Instance UID — obtain from `find-studies` |

---

### `get-structured-report-text`

Retrieves a Structured Report instance and converts it to human-readable text.

| Parameter | Type | Description |
|---|---|---|
| `studyInstanceUid` | string | Study Instance UID |
| `seriesInstanceUid` | string | Series Instance UID |
| `sopInstanceUid` | string | SOP Instance UID — obtain from `find-structured-reports` |

---

### `get-instance-metadata`

Retrieves and formats all DICOM attributes of a single instance as human-readable text. Does not retrieve pixel data.

| Parameter | Type | Description |
|---|---|---|
| `studyInstanceUid` | string | Study Instance UID |
| `seriesInstanceUid` | string | Series Instance UID |
| `sopInstanceUid` | string | SOP Instance UID — obtain from `find-instances` |

---

### `render-instance-frame`

Renders a specific frame from a DICOM instance and returns it as an inline image (JPEG or PNG).

| Parameter | Type | Description |
|---|---|---|
| `studyInstanceUid` | string | Study Instance UID |
| `seriesInstanceUid` | string | Series Instance UID |
| `sopInstanceUid` | string | SOP Instance UID — obtain from `find-instances` |
| `frame` | integer | 1-based frame index (use `1` for single-frame instances) |
| `outputFormat` | enum | `image/jpeg` or `image/png` |

**Example prompt**
- *"Show me the first frame of SOP instance 1.2.3.4.5 as a JPEG"*

---

## Query Syntax

The `query` parameter accepted by the search tools is a space-separated list of `key=value` pairs.

**Key formats**

| Format | Example |
|---|---|
| DICOM keyword name | `PatientName=DOE*` |
| 8-digit hex tag | `00100020=12345` |

**Special keys**

| Key | Description |
|---|---|
| `limit=N` | Maximum number of results to return |
| `offset=N` | Skip the first N results (for pagination) |
| `fuzzymatching=true` | Enable fuzzy (phonetic) name matching |
| `includefield=all` | Request all available DICOM attributes |

**Examples**

```
PatientName=DOE*
StudyDate=20240101-20241231 ModalitiesInStudy=CT
00100020=ABC123 limit=10
fuzzymatching=true PatientName=Smith
```

Wildcard `*` is supported in string values where the DICOMweb server allows it.

## Typical Workflow

A natural conversational sequence with the MCP server looks like this:

1. **Search studies** — `find-studies` with a patient name or date range.
2. **Browse series** — `find-series` with the Study Instance UID returned in step 1.
3. **List instances** — `find-instances` with Study and Series UIDs from steps 1–2.
4. **Inspect or render** — `get-instance-metadata` for DICOM attributes, or `render-instance-frame` to view pixel data.
5. **Read reports** — `find-structured-reports` then `get-structured-report-text` for SR documents.

## License

dicomweb-mcp-server is released under the MIT License.


[npm-url]: https://npmjs.org/package/dicomweb-mcp-server
[npm-version-image]: https://img.shields.io/npm/v/dicomweb-mcp-server.svg?style=flat
[npm-downloads-image]: http://img.shields.io/npm/dm/dicomweb-mcp-server.svg?style=flat

[build-url]: https://github.com/PantelisGeorgiadis/dicomweb-mcp-server/actions/workflows/build.yml
[build-image]: https://github.com/PantelisGeorgiadis/dicomweb-mcp-server/actions/workflows/build.yml/badge.svg?branch=master

[license-image]: https://img.shields.io/badge/license-MIT-blue.svg?style=flat
[license-url]: LICENSE.txt

[mcp-url]: https://modelcontextprotocol.io
[orthanc-url]: https://www.orthanc-server.com/
