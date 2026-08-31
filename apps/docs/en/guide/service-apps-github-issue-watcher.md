# GitHub Issue Watcher

GitHub Issue Watcher is a Service App that keeps a small, local view of one repository's Issues. It is a useful example because the same App combines a Panel, saved data, approved network access, an optional GitHub token, and Actions that an Agent or CLI can use.

## What it does

Enter a repository such as `Peiiii/nextclaw`, then select **Sync Issues**. The App downloads the repository's recent Issues from GitHub and saves the result in its own data area. You can switch between open, closed, and all saved Issues without making another request.

For a public repository, no token is required. For a private repository or higher GitHub API limits, configure the optional `github-token` secret slot before syncing. The App reads that secret only for the request and never puts it into the Panel, Issue list, Action output, or logs.

## Install and use

1. Install **GitHub Issue Watcher** from Apps or its `.napp` package.
2. Open the App and enter an `owner/repository` name.
3. Review the request to connect to `api.github.com`, then sync.
4. Filter the saved Issues in the Panel and open an Issue in GitHub when needed.

The App requests only `api.github.com`; it cannot use the token to contact another domain through this App.

## Use it with an Agent or CLI

Grant `issues_sync` to an Agent when you want the Agent to refresh a repository and work with the saved result. For example: “Sync `Peiiii/nextclaw`, then list the three oldest open bugs.” The Agent uses the same Action and sees the same Action validation as the Panel.

```bash
nextclaw app invoke nextclaw.github-issue-watcher issues_sync \
  --input '{"repository":"Peiiii/nextclaw"}' --json
nextclaw app invoke nextclaw.github-issue-watcher issues_list \
  --input '{"state":"open"}' --json
```

The second command reads the App's saved snapshot. It does not need to contact GitHub again.

## If sync fails

- Check that the repository value has the `owner/repository` form.
- For private repositories, bind and verify `github-token` in the App's secret settings.
- Confirm that the host can reach `api.github.com`.
- Open the App's verification records to see the redacted operation facts and error code.

See [Troubleshoot Service Apps](/en/guide/service-apps-troubleshooting) for general recovery steps.
