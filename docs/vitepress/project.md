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

### Cloning the repository automatically

When you leave the local repository path empty, the wizard clones the repository for you using the Git provider and
`owner/repo` value you just entered. You do not need to type a clone URL — SMM constructs it from the provider:

- GitHub: `https://github.com/{owner}/{repo}.git`
- GitLab: `{gitlab_url}/{owner}/{repo}.git` (defaults to `https://gitlab.com`)

When a provider token is available, it is embedded in the clone URL so private repositories clone successfully. Tokens
are never printed.

The repository is cloned under `{data-directory}/repos/{owner}_{repo}`, and that path is saved as
`git_repository_location` in `smm_config.json`. If the target path already holds a git repository, the clone is skipped
and the existing path is reused.

```bash
smm project configure
# ...
# Path to the local git repository (optional, for code metrics):
# (leave empty and press Enter)
# No repository path provided. Cloning acme/widgets into /data/smm/repos/acme_widgets...
# Repository cloned to: /data/smm/repos/acme_widgets
```

If the clone fails (for example, the repository is private and no token was provided, or the repository does not exist),
the wizard reports the error and exits without writing a `git_repository_location`.

Supported providers for cloning are extensible in the codebase. To add a new provider, register its base URL and token
resolver in the `GIT_CLONE_PROVIDERS` list — no other clone code needs to change.

## List configured projects

```bash
smm project list
```

Lists the projects in `smm_config.json` with their provider. When no data directory is available or no projects are
configured yet, it prints a hint to run `smm project configure` first.

## Delete a project

```bash
smm project delete [--provider <github|gitlab>] [--repository owner/repo] [--yes]
```

Removes a project entry from `smm_config.json`. Non-interactive mode requires both `--provider` and `--repository`
together, so two projects sharing the same `owner/repo` across different providers cannot collide. A confirmation
prompt is shown before the entry is removed unless `--yes` is passed.

```bash
smm project delete --provider github --repository acme/widgets --yes
```

When `--provider` and `--repository` are omitted, the command lists the configured projects as `provider/repository`
choices and asks which one to delete:

```bash
smm project delete
# ? Which project would you like to delete? github/acme/widgets
# ? Delete project "github/acme/widgets"? This cannot be undone. (y/N) y
# Project "github/acme/widgets" deleted.
# Cached data under the project data directory was left untouched. Remove it manually if you no longer need it.
```

Passing only one of `--provider` or `--repository` exits with an error asking for the missing flag. Only the
configuration entry is removed. Cached data under the project data directory (for example the SQLite database or
cloned repository under `{provider}_{owner}_{repo}`) is left untouched — remove it manually if you no longer need it.
When the data directory is not available or no projects are configured, the command prints a hint to run
`smm project configure` first. When no project matches the given provider and repository, the command exits with an
error.

## Dashboard project selection

Switching the active project from the dashboard is done in the project drawer, not through this command. Selecting a
project stores the repository name in the `smm_active_project` browser cookie and reloads the page. See
[Configuration](./features/configuration.md#selecting-a-project) for details.
