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
* Python 3.10+ and Poetry (only if you run the legacy Python implementation directly)

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

This project uses a folder to store the data fetched from the different providers, set the env variable `SMM_STORE_DATA_AT`
to point to the desired location. Use absolute paths.

```bash
export SMM_STORE_DATA_AT=/path/to/data/folder
```

Ensure the folder exists and use a different folder than the cloned repository to avoid any accidental deletion or data
changes. For example:

## Create the configuration file

The configuration file is the central point to configure the project and give it default values, it uses JSON format.
In the folder pointed to store the data, create a configuration file named `smm_config.json` with the following content:

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
IANA timezone used by your team. CLI commands use this timezone for date-only filters and time grouping. A table with the
full configuration options is available at [Configuration options](./features/configuration.md).

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
pick a provider and start fetching data. Proceed to [your first analysis with GitHub](./your-first-analysis-with-github.md).

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
  prs            Pull request operations
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
