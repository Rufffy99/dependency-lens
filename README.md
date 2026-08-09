# 📦 PyProject Dependency Manager

**The ultimate dependency companion for modern Python development.**

Manage your `pyproject.toml` dependencies with zero friction. Get real-time updates, smart version suggestions, and validaton directly in your editor. No more switching to the browser to check PyPI.

> 🚀 **Supported Formats**: PEP 621 (Standard), Poetry, and Poetry Groups.

## ✨ Features

### 🔍 Real-Time Version Checks
Instantly see the status of your dependencies right next to your code.
- **🟢 Latest**: You're up to date!
- **🟡 Minor Update**: A new feature release is available.
- **🔴 Major Update**: A breaking change release is available.
- **⚠ Validation**: Detects typos and warns if a dependency version doesn't exist on PyPI.
<img width="634" height="795" alt="image" src="https://github.com/user-attachments/assets/92a7ec20-13f5-4e95-944b-064f0be61fa7" />

### 🧠 Smart Update Suggestions
We don't just tell you there's an update; we help you choose the *right* one.
- **Safety First**: If a Major update (e.g. `2.0.0`) is available, we also check for the **Latest Minor** (e.g. `1.9.0`) to keep you safe from breaking changes.
- **Inline Actions**: decorations are unobtrusively aligned to the right.

### 👆 Rich Hover Details
Hover over any dependency to get specific details without leaving VS Code:
- **Package Summary**: What does this package do?
- **Quick Links**: 🏠 Homepage | 📄 Docs | 📝 Changelog
- **One-Click Updates**: Update to the latest Stable, Minor, or Patch version directly from the hover menu.

### 🧹 Clean & Non-Destructive
Updates are applied intelligently, preserving your existing formatting and quotes.

## ⌨ Usage

1. Open any `pyproject.toml` file.
2. Wait a moment for the extension to fetch metadata from PyPI.
3. Hover over dependencies to see details or click "Update".

Use the **Dependency Lens** switch in the status bar, or run **Dependency Lens: Toggle Dependency Lens** from the Command Palette, to disable all parsing, decorations, hover details, and PyPI requests. Pending requests are cancelled, the setting persists across restarts, and it can also be changed with `dependencyLens.enabled`.

---

## 💬 Feedback & Feature Requests

Found a bug or have an idea for a new feature?

Please open an issue on GitHub:
- https://github.com/Rufffy99/dependency-lens/issues

---

## 📜 Changelog

### 0.1.3
**Performance and control improvements:**

- Added a persistent status-bar and Command Palette toggle for enabling or disabling Dependency Lens.
- Disabled mode now clears decorations, skips dependency parsing and hover work, and cancels pending PyPI requests.
- Added a shared, document-version-aware dependency cache to avoid parsing the same `pyproject.toml` repeatedly.
- Deduplicated concurrent PyPI requests, limited request concurrency, added timeouts, and normalized package names for more effective caching.
- Increased successful metadata cache duration and briefly caches failed lookups to avoid repeated network traffic.
- Prevented stale asynchronous results from updating a changed document or a different active editor.
- Reduced repeated version-processing work when finding the latest compatible release.
- Fixed the main `npm test` command so it runs the existing unit test suite successfully.

### 0.1.2
**Major improvements to version handling and display:**

- Fixed dependency parsing for extras in requirement strings (e.g. `fastapi[standard]==...`, `moto[s3]==...`).
- Fixed update replacement ranges to preserve extras and comparators correctly in one-click updates.
- Improved version extraction to read versions from comparators instead of extras fragments.
- **Added support for PEP 440 post-releases and dev-releases** (e.g. `1.0.0.post1`, `1.0.0.dev1`).
- **Added support for 4+ segment versions** used by projects like pandas-stubs (e.g. `3.0.3.260530` displays and updates correctly).
- **Improved version comparisons to consider build metadata** so updates are shown for 4-segment releases that differ only in the build part.
- **Preserved original PyPI version formats** in hover details and update buttons (e.g. `3.0.3.260530` instead of internal `3.0.3+260530`).
- Improved PyPI release filtering to avoid suggesting unstable/yanked artifacts as stable updates.

### 0.1.1
- Added branding: official extension icon and screenshot in README.

### 0.1.0
- PEP 621 and Poetry support.
- Smart version updates and inline decorations.
- Rich hover details with PyPI integration.

---

**Enjoying the extension?**  
Please leave a review and star us on GitHub! ⭐
