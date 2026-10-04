# Security

Self-hosted Bibo is a single-owner workspace protected by its configured email and a strong password. Sessions are HMAC-signed, expire after one day, use HttpOnly/Secure/SameSite cookies, and become invalid when the password changes. Login attempts are limited. Serve the deployment over HTTPS. Do not use this mode as a public registration service.

Model, search and owner credentials belong in Cloudflare Worker Secrets. Never expose them as `VITE_` variables, commit them, or include them in screenshots, issues or logs. Model/search providers receive the content needed for their calls.

Linux commands execute in Cloudflare Sandbox. Temporary OS state is separate from persistent R2 files. An agent can read and change mounted files and access the network; sandbox isolation does not make every agent action harmless. Keep backups of important files and mount only the directories needed for your work.

Report vulnerabilities using [GitHub private vulnerability reporting](https://github.com/Peiiii/bibo/security/advisories/new). Avoid public issues containing exploitable details or credentials. Maintainers do not promise a response-time SLA for this early release.
