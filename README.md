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

## 🔮 Roadmap: The Future of Dependency Management

We are building the **One Manager to Rule Them All**. While we started with Python, our vision is to provide this seamless experience for *every* language.

**Coming Soon:**
- **📦 Node.js Support**: Full support for `package.json` dependencies.
- **🦀 Rust Support**: Manage crates in `Cargo.toml`.
- **🐹 Go Support**: Handle modules in `go.mod`.

## ⌨ Usage

1. Open any `pyproject.toml` file.
2. Wait a moment for the extension to fetch metadata from PyPI.
3. Hover over dependencies to see details or click "Update".

---

---

## 📜 Changelog

### 0.1.1
- Added branding: official extension icon and screenshot in README.

### 0.1.0
- 🚀 Initial release of **Dependency Lens**.
- 🔍 PEP 621 and Poetry support.
- 🧠 Smart version updates and inline decorations.
- 👆 Rich hover details with PyPI integration.

---

**Enjoying the extension?**  
Please leave a review and star us on GitHub! ⭐

