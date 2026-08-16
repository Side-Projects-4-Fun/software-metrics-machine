---
outline: deep
---

# Getting started

This guide takes you from an empty machine to a local dashboard with your first repository data. For a complete
walkthrough using a public repository, see [Your first analysis with GitHub](./your-first-analysis-with-github.md).

## The shortest path to a first result

Use this path when you want to evaluate SMM before configuring every integration:

```bash
npx @smmachine/launcher
smm project configure
smm project list
smm change-requests fetch --start-date 2025-01-01 --end-date 2025-01-31
smm dashboard serve
```

Then open `http://localhost:3000`. A small date range is intentional: it lets you validate credentials, repository
configuration, and the shape of the results before starting a larger collection job.

> [!TIP]
> Invite one developer and one tech lead to review the first dashboard together. Look for one delivery bottleneck,
> one quality signal, and one question the data cannot answer yet.

## How SMM works

The way this project works goes through three main steps:

1. Fetch data from providers such as GitHub, GitLab, Jira, and SonarQube.
2. Store the collected data in the configured local data directory.
3. Analyze the data through the CLI, dashboard, or REST API.

## Install SMM

### Environment requirements

* Node.js 25+
* Java, only if you plan to run source-code analysis with Code Maat

### Via npm

```bash
npx @smmachine/launcher
```

For a persistent global installation, use `npm i -g @smmachine/launcher` instead.

Once installed, you can run the `smm` command in your terminal:

```plaintext
smm
```

## Configure local storage

SMM stores fetched data and `smm_config.json` in a data directory. You do not have to set this up by hand: the
`smm project configure` wizard asks for a data directory, creates it, and saves it as the default in the user settings
file (`$XDG_CONFIG_HOME/smm/config.json`, falling back to `~/.config/smm/config.json`), so later commands reuse it
without any extra setup.

Use the `SMM_STORE_DATA_AT` environment variable only to temporarily override the saved default, for example to point at
a different data directory for a specific shell. See
[Data directory resolution](./features/configuration.md#data-directory-resolution) for the full resolution order.

> [!IMPORTANT]
> Use a different folder than the cloned repository to store the data, to avoid any accidental deletion or data changes.

## Configure a project

The configuration file is the central point to configure the project and give it default values. The easiest way to
create it is the interactive wizard:

```bash
smm project configure
```

The wizard asks for the git provider, repository, branch, tokens, and optional integrations, then generates
`smm_config.json` for you. It also sets up the data directory when none is available yet.

For **GitLab**, the wizard asks for the GitLab token and instance URL instead. See the [GitLab provider guide](./gitlab.md)
for full setup instructions.

The full list of configuration options, including the manual `smm_config.json` format for advanced setup, is available
at [Configuration](./features/configuration.md).

### Checkpoint configuration

Confirm the project was created by listing the configured projects:

```bash
smm project list
```

You should see the project you just configured. You are now ready to fetch data from the repository with a local setup.

## Continue from the first result

Pick a provider and continue with the workflow that fits your setup:

* [Your first analysis with GitHub](./your-first-analysis-with-github.md) — fetch change requests, pipelines, and code history.
* [Keeping your data up to date](./keeping-your-data-up-to-date.md) — plan repeatable refreshes.
* [GitLab provider setup](./gitlab.md) — connect a GitLab repository.
* [Features](./features.md) — understand the dashboard and CLI surfaces.

## Docker setup

> [!IMPORTANT]
> Using docker is optional, it requires extra knowledge of docker commands and docker installation.
>

This project provides a docker image to run the commands without the need to install the development environment locally. To build the
docker image, run the following command in the root of the cloned repository:

```bash
docker build -t smm-docker:latest .
```

Once the image is built, you can run the commands using docker.

### Checkpoint docker setup

To check the docker setup, run the following command:

```bash
docker run --rm -e SMM_STORE_DATA_AT="/data" -v $(pwd)/downloads:/data smm-docker smm
```

You should see an output something like the following:

```plaintext
Usage: smm [options] [command]

Software Metrics Machine - High-performing team metrics

Options:
  --version      output the version number
  -h, --help     display help for command
  --debug        Enable debug logging

Commands:
  change-requests  Change request operations
  pipelines      Pipeline/workflow operations
  code           Code analysis operations
  jira           Jira integration operations
  sonarqube      SonarQube integration operations
  dashboard      Dashboard operations
  tools          Utility tools
  health-check   Analyze local cache data quality
  help           Show help information
```

Now you are ready to go and start running the commands using docker, take the commands from the CLI documentation
and run them using docker as shown in the checkpoint above.
