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

This project uses a folder to store the data fetched from the different providers. Set the env variable `SMM_STORE_DATA_AT`
to point to the desired location. Use absolute paths.

```bash
export SMM_STORE_DATA_AT=/path/to/data/folder
```

Ensure the folder exists and use a different folder than the cloned repository to avoid any accidental deletion or data
changes.

The env variable is optional if you have run `smm project configure` before: the wizard saves the data directory as
the default in the user settings file (`$XDG_CONFIG_HOME/smm/config.json`, falling back to
`~/.config/smm/config.json`), so later commands reuse it without requiring `SMM_STORE_DATA_AT`.

## Create the configuration file

The configuration file is the central point to configure the project and give it default values, it uses JSON format.
The easiest way to create it is the interactive wizard. Run the following command:

```bash
smm project configure
```

The wizard asks for the git provider, repository, branch, tokens, and optional integrations, then generates
`smm_config.json` for you. If `SMM_STORE_DATA_AT` is not set and no default data directory is saved yet, the wizard
asks for the data directory, creates it, and saves it as the default so you do not need to export `SMM_STORE_DATA_AT`
again.

Alternatively, in the folder pointed to store the data, create a configuration file named `smm_config.json` with the
following content:

```json
{
  "projects": [
    {
      "git_provider": "github",
      "github_token": "your_github_token",
      "github_repository": "marabesi/json-tool",
      "git_repository_location": "/your/local/repo",
      "timezone": "Europe/Madrid"
    }
  ]
}
```

This configuration is the central point to configure the project and give it default values. Replace `your_github_token` with
the token you generated, `/your/local/repo` with the path where you cloned the repository, and `Europe/Madrid` with the
IANA timezone used by your team. CLI commands use this timezone for date-only filters and time grouping.

For **GitLab**, set `git_provider` to `gitlab` and provide `gitlab_token` instead. See the [GitLab provider guide](./gitlab.md)
for full setup instructions:

```json
{
  "projects": [
    {
      "git_provider": "gitlab",
      "gitlab_token": "glpat-your-gitlab-token",
      "github_repository": "your-group/your-project",
      "git_repository_location": "/your/local/repo",
      "timezone": "Europe/Madrid"
    }
  ]
}
```

A table with the full configuration options is available at [Configuration options](./features/configuration.md).

### Checkpoint store data

Let's now check the env variables for data storage, run the following command:

```bash
env
```

You should see an output something like the following:

```plaintext
SMM_STORE_DATA_AT=/path/to/data/folder
```

With this, you are ready to start using Software Metrics Machine and fetch data from your repository with a local
setup.

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
