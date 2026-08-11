---
outline: deep
---

# Getting started

This section provides the required configuration to get started with Software Metrics Machine.

## The concepts behind Software Metrics Machine

The way this project works goes through three main steps:

1. Fetch data from the providers (git, github, gitlab, etc)
2. Store the data in a structured way (json files)
3. Analyze and visualize the data

## Installing

### Environment requirements

* Node.js 25+
* Java (for running source code analysis)

### Via npm

```bash
npx @smmachine/launcher

or

npm i -g @smmachine/launcher
```

Once installed, you can run the `smm` command in your terminal:

```plaintext
smm
```

## Define where to store the data

SMM stores fetched data and `smm_config.json` in a data directory. You do not have to set this up by hand: the
`smm project configure` wizard asks for a data directory, creates it, and saves it as the default in the user settings
file (`$XDG_CONFIG_HOME/smm/config.json`, falling back to `~/.config/smm/config.json`), so later commands reuse it
without any extra setup.

Use the `SMM_STORE_DATA_AT` environment variable only to temporarily override the saved default, for example to point at
a different data directory for a specific shell. See
[Data directory resolution](./features/configuration.md#data-directory-resolution) for the full resolution order.

> [!IMPORTANT]
> Use a different folder than the cloned repository to store the data, to avoid any accidental deletion or data changes.

## Create the project

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

You should see the project you just configured. With this, you are ready to start using Software Metrics Machine and
fetch data from your repository with a local setup.

## Ready to go

You are now ready to start using Software Metrics Machine and fetch data from your repository. The next step is to
pick a provider and start fetching data:

- [Your first analysis with GitHub](./your-first-analysis-with-github.md)
- [GitLab provider setup](./gitlab.md)

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
