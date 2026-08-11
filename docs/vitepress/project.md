# Project management

The `smm project` command group manages the projects stored in `smm_config.json`. It is the interactive way to create
and update project configuration without editing JSON by hand.

## Configure a project

```bash
smm project configure
```

`smm project configure` runs an interactive wizard that walks through the Git provider, repository, local clone path,
branch, tokens, and optional Jira / SonarQube integrations, then writes `smm_config.json` for you.

### Data directory

If no data directory is available yet (neither `SMM_STORE_DATA_AT` nor a saved default), the wizard first asks for a data
directory, creates it, and saves it as the default in the user settings file (`$XDG_CONFIG_HOME/smm/config.json`,
falling back to `~/.config/smm/config.json`). Later commands reuse the saved default, so you no longer need to export
`SMM_STORE_DATA_AT` in every shell. See
[Data directory resolution](./features/configuration.md#data-directory-resolution) for the full resolution order.

### What the wizard asks

When a configuration file already exists, the wizard first asks whether to create a new project or update an existing
one. It then asks for:

- Git provider (`github` or `gitlab`)
- Repository in `owner/repo` format
- Path to the local git repository (optional, used for source-code metrics)
- Main branch (default: `main`)
- Provider token (GitHub or GitLab, depending on the provider). Leave it empty when updating to keep the existing value.
- GitLab instance URL (GitLab only, defaults to `https://gitlab.com`)
- Jira integration (optional): URL, email, API token, and project key
- SonarQube integration (optional): URL, token, and project key
- Log level (`DEBUG`, `INFO`, `WARN`, `ERROR`, `CRITICAL`; default `INFO`)
- Timezone as an IANA identifier (default: the system timezone)
- Whether to store logs on disk

Optional fields such as tokens are only written when you provide a value, so updating a project never wipes settings you
left untouched.

The wizard covers the core keys. Advanced keys such as `deployment_frequency_targets`, `dashboard_start_date`, and
`dashboard_end_date` can be added by editing `smm_config.json` directly. See the
[Configuration key reference](./features/configuration.md#key-reference) for the full schema.

## List configured projects

```bash
smm project list
```

Lists the projects in `smm_config.json` with their provider. When no data directory is available or no projects are
configured yet, it prints a hint to run `smm project configure` first.

## Dashboard project selection

Switching the active project from the dashboard is done in the project drawer, not through this command. Selecting a
project stores the repository name in the `smm_active_project` browser cookie and reloads the page. See
[Configuration](./features/configuration.md#selecting-a-project) for details.
