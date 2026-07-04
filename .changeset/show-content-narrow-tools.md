---
"@nextclaw/kernel": patch
"@nextclaw/core": patch
"@nextclaw/ui": patch
---

Split the model-facing `show_content` display tool into `show_file`, `show_url`, and `show_panel_app` so required display parameters are explicit JSON Schema properties instead of nested description-only payload fields.
