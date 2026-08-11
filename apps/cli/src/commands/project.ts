import * as fs from 'fs';
import * as path from 'path';
import inquirer, { type DistinctQuestion } from 'inquirer';
import {
  Configuration,
  GitCloneService,
  resolveStoreDataAt,
  saveUserSettings,
  type ISmmConfigFile,
  type ISmmProjectConfig,
} from '@smmachine/core';
import { Logger } from '@smmachine/utils';
import type { Screen } from '../screen';
import type { SmmCommand } from './smm-command';

const CONFIG_FILE_NAME = 'smm_config.json';
const VALID_LOG_LEVELS = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'];

type ProjectCoreAnswers = {
  git_provider: string;
  github_repository: string;
  git_repository_location: string;
  main_branch: string;
  github_token: string;
  gitlab_token: string;
  gitlab_url: string;
};

type ProjectIntegrationAnswers = {
  configure_jira: boolean;
  jira_url: string;
  jira_email: string;
  jira_token: string;
  jira_project: string;
  configure_sonarqube: boolean;
  sonar_url: string;
  sonar_token: string;
  sonar_project: string;
};

type ProjectMiscAnswers = {
  log_level: string;
  timezone: string;
  store_logs: boolean;
};

/**
 * Resolves the SMM data directory.
 *
 * Uses the environment variable when set, otherwise the default data directory
 * saved in the user settings file. When neither is available it prompts the
 * user for a directory, sets the environment variable for the rest of the
 * process, and remembers that a new default should be persisted.
 */
async function resolveStoreDataDir(
  screen: Screen
): Promise<{ dataDir: string; prompted: boolean }> {
  const configured = resolveStoreDataAt(process.env);
  if (configured) {
    return { dataDir: configured, prompted: false };
  }

  screen.printLine(
    '\nSMM_STORE_DATA_AT is not set and no default data directory is saved. SMM stores data and smm_config.json in a data directory.'
  );

  const questions: DistinctQuestion<{ store_data_at: string }>[] = [
    {
      type: 'input',
      name: 'store_data_at',
      message: 'Data directory for SMM:',
      default: path.resolve(process.cwd(), 'smm-data'),
      validate: (input: string): boolean | string =>
        input.trim().length > 0 ? true : 'Data directory cannot be empty.',
    },
  ];

  const { store_data_at } = await inquirer.prompt(questions);

  const dataDir = path.resolve(store_data_at.trim());
  process.env.SMM_STORE_DATA_AT = dataDir;
  return { dataDir, prompted: true };
}

/**
 * Loads the current smm_config.json when present. Invalid JSON and non-object
 * config files raise descriptive errors.
 */
function loadConfigFile(dataDir: string): {
  config: ISmmConfigFile;
  projects: ISmmProjectConfig[];
} {
  const configPath = path.join(dataDir, CONFIG_FILE_NAME);
  if (!fs.existsSync(configPath)) {
    return { config: {}, projects: [] };
  }

  const raw = fs.readFileSync(configPath, 'utf-8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`smm_config.json at ${configPath} is not valid JSON.`);
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`smm_config.json at ${configPath} must be a JSON object.`);
  }

  const config = parsed as ISmmConfigFile;
  return { config, projects: Array.isArray(config.projects) ? config.projects : [] };
}

/**
 * Asks which project the user wants to configure. Returns the matching existing
 * project (undefined for a brand new project) and its index in the projects
 * array (-1 when creating a new project).
 */
async function selectTargetProject(
  projects: ISmmProjectConfig[]
): Promise<{ existing: ISmmProjectConfig | undefined; existingIndex: number }> {
  if (projects.length === 0) {
    return { existing: undefined, existingIndex: -1 };
  }

  const choices = [
    'Create a new project',
    ...projects.map((project) => `Update ${project.github_repository || '(unnamed)'}`),
  ];

  const questions: DistinctQuestion<{ action: string }>[] = [
    {
      type: 'select',
      name: 'action',
      message: 'A configuration file was found. What would you like to do?',
      choices,
    },
  ];

  const { action } = await inquirer.prompt(questions);

  if (action === 'Create a new project') {
    return { existing: undefined, existingIndex: -1 };
  }

  const repository = action.replace(/^Update /, '');
  const existingIndex = projects.findIndex((project) => project.github_repository === repository);
  return { existing: existingIndex >= 0 ? projects[existingIndex] : undefined, existingIndex };
}

async function askCoreQuestions(
  existing: ISmmProjectConfig | undefined
): Promise<ProjectCoreAnswers> {
  const questions: DistinctQuestion<ProjectCoreAnswers>[] = [
    {
      type: 'select',
      name: 'git_provider',
      message: 'Git provider:',
      choices: ['github', 'gitlab'],
      default: existing?.git_provider ?? 'github',
    },
    {
      type: 'input',
      name: 'github_repository',
      message: 'Repository (owner/repo):',
      default: existing?.github_repository ?? '',
      validate: (input: string): boolean | string =>
        input.includes('/') ? true : 'Repository must be in owner/repo format.',
    },
    {
      type: 'input',
      name: 'git_repository_location',
      message: 'Path to the local git repository (optional, for code metrics):',
      default: existing?.git_repository_location ?? '',
    },
    {
      type: 'input',
      name: 'main_branch',
      message: 'Main branch:',
      default: existing?.main_branch ?? 'main',
    },
    {
      type: 'password',
      name: 'github_token',
      message: 'GitHub personal access token (optional, leave empty to keep existing):',
      when: (answers) => answers.git_provider === 'github',
    },
    {
      type: 'password',
      name: 'gitlab_token',
      message: 'GitLab personal access token (optional, leave empty to keep existing):',
      when: (answers) => answers.git_provider === 'gitlab',
    },
    {
      type: 'input',
      name: 'gitlab_url',
      message: 'GitLab instance URL (defaults to https://gitlab.com):',
      default: existing?.gitlab_url ?? 'https://gitlab.com',
      when: (answers) => answers.git_provider === 'gitlab',
    },
  ];

  return inquirer.prompt(questions);
}

async function askIntegrationQuestions(
  existing: ISmmProjectConfig | undefined
): Promise<ProjectIntegrationAnswers> {
  const hasJira = Boolean(
    existing?.jira_url || existing?.jira_email || existing?.jira_token || existing?.jira_project
  );
  const hasSonarqube = Boolean(
    existing?.sonar_url || existing?.sonar_token || existing?.sonar_project
  );

  const questions: DistinctQuestion<ProjectIntegrationAnswers>[] = [
    {
      type: 'confirm',
      name: 'configure_jira',
      message: 'Configure Jira integration?',
      default: hasJira,
    },
    {
      type: 'input',
      name: 'jira_url',
      message: 'Jira URL (e.g. https://your-org.atlassian.net):',
      default: existing?.jira_url ?? '',
      when: (answers) => answers.configure_jira,
    },
    {
      type: 'input',
      name: 'jira_email',
      message: 'Jira email:',
      default: existing?.jira_email ?? '',
      when: (answers) => answers.configure_jira,
    },
    {
      type: 'password',
      name: 'jira_token',
      message: 'Jira API token (optional, leave empty to keep existing):',
      when: (answers) => answers.configure_jira,
    },
    {
      type: 'input',
      name: 'jira_project',
      message: 'Jira project key (e.g. KAN):',
      default: existing?.jira_project ?? '',
      when: (answers) => answers.configure_jira,
    },
    {
      type: 'confirm',
      name: 'configure_sonarqube',
      message: 'Configure SonarQube integration?',
      default: hasSonarqube,
    },
    {
      type: 'input',
      name: 'sonar_url',
      message: 'SonarQube URL (e.g. https://sonarcloud.io):',
      default: existing?.sonar_url ?? '',
      when: (answers) => answers.configure_sonarqube,
    },
    {
      type: 'password',
      name: 'sonar_token',
      message: 'SonarQube token (optional, leave empty to keep existing):',
      when: (answers) => answers.configure_sonarqube,
    },
    {
      type: 'input',
      name: 'sonar_project',
      message: 'SonarQube project key:',
      default: existing?.sonar_project ?? '',
      when: (answers) => answers.configure_sonarqube,
    },
  ];

  return inquirer.prompt(questions);
}

async function askMiscQuestions(
  existing: ISmmProjectConfig | undefined
): Promise<ProjectMiscAnswers> {
  const questions: DistinctQuestion<ProjectMiscAnswers>[] = [
    {
      type: 'select',
      name: 'log_level',
      message: 'Log level:',
      choices: VALID_LOG_LEVELS,
      default: existing?.log_level ?? 'INFO',
    },
    {
      type: 'input',
      name: 'timezone',
      message: 'Timezone (IANA, e.g. Europe/Madrid):',
      default: existing?.timezone ?? systemTimezone(),
    },
    {
      type: 'confirm',
      name: 'store_logs',
      message: 'Store logs on disk?',
      default: existing?.store_logs ?? false,
    },
  ];

  return inquirer.prompt(questions);
}

function systemTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Builds the project configuration from wizard answers.
 *
 * Optional fields only overwrite existing values when the user provided a
 * non-empty answer. This allows updating a project without wiping tokens that
 * were left blank.
 */
function buildProjectConfig(
  core: ProjectCoreAnswers,
  integrations: ProjectIntegrationAnswers,
  misc: ProjectMiscAnswers,
  existing: ISmmProjectConfig | undefined
): ISmmProjectConfig {
  const project: ISmmProjectConfig = {
    ...(existing ?? {}),
    git_provider: core.git_provider,
    github_repository: core.github_repository,
    main_branch: core.main_branch,
    log_level: misc.log_level,
    timezone: misc.timezone,
    store_logs: misc.store_logs,
  };

  const location = core.git_repository_location.trim();
  if (location) {
    project.git_repository_location = location;
  }

  if (core.git_provider === 'github') {
    const githubToken = core.github_token.trim();
    if (githubToken) {
      project.github_token = githubToken;
    }
  } else {
    const gitlabToken = core.gitlab_token.trim();
    if (gitlabToken) {
      project.gitlab_token = gitlabToken;
    }
    const gitlabUrl = core.gitlab_url.trim();
    if (gitlabUrl) {
      project.gitlab_url = gitlabUrl;
    }
  }

  if (integrations.configure_jira) {
    const jiraUrl = integrations.jira_url.trim();
    if (jiraUrl) {
      project.jira_url = jiraUrl;
    }
    const jiraEmail = integrations.jira_email.trim();
    if (jiraEmail) {
      project.jira_email = jiraEmail;
    }
    const jiraToken = integrations.jira_token.trim();
    if (jiraToken) {
      project.jira_token = jiraToken;
    }
    const jiraProject = integrations.jira_project.trim();
    if (jiraProject) {
      project.jira_project = jiraProject;
    }
  }

  if (integrations.configure_sonarqube) {
    const sonarUrl = integrations.sonar_url.trim();
    if (sonarUrl) {
      project.sonar_url = sonarUrl;
    }
    const sonarToken = integrations.sonar_token.trim();
    if (sonarToken) {
      project.sonar_token = sonarToken;
    }
    const sonarProject = integrations.sonar_project.trim();
    if (sonarProject) {
      project.sonar_project = sonarProject;
    }
  }

  return project;
}

function writeConfigFile(dataDir: string, config: ISmmConfigFile): string {
  const configPath = path.join(dataDir, CONFIG_FILE_NAME);
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf-8');
  return configPath;
}

/**
 * Derives the local clone path for a repository when the user did not provide one.
 *
 * The repository is cloned under `{dataDir}/repos/{owner}_{repo}` to keep it next to
 * the SMM data directory without clobbering any user-provided path.
 */
function deriveClonePath(dataDir: string, githubRepository: string): string {
  const repoSlug = githubRepository.replace('/', '_');
  return path.join(dataDir, 'repos', repoSlug);
}

/**
 * Builds a Configuration from the wizard core answers so the clone service can derive
 * the provider URL and token before the project is persisted.
 */
function buildCloneConfiguration(core: ProjectCoreAnswers, dataDir: string): Configuration {
  return new Configuration({
    storeData: dataDir,
    gitProvider: core.git_provider,
    githubRepository: core.github_repository,
    githubToken: core.github_token ? core.github_token.trim() : undefined,
    gitlabToken: core.gitlab_token ? core.gitlab_token.trim() : undefined,
    gitlabUrl: core.gitlab_url ? core.gitlab_url.trim() : undefined,
  });
}

/**
 * When the user left `git_repository_location` empty, clones the repository using the
 * provider and repository gathered during the wizard and returns the resulting path.
 *
 * When the user provided a path, it is returned unchanged and no clone is performed.
 */
async function cloneRepositoryIfNeeded(
  core: ProjectCoreAnswers,
  existing: ISmmProjectConfig | undefined,
  dataDir: string,
  screen: Screen
): Promise<string | undefined> {
  const providedLocation = core.git_repository_location.trim();
  if (providedLocation) {
    return providedLocation;
  }

  if (existing?.git_repository_location) {
    return existing.git_repository_location;
  }

  const targetPath = deriveClonePath(dataDir, core.github_repository);
  const logger = new Logger('ProjectConfigure', 'INFO');
  const cloneConfiguration = buildCloneConfiguration(core, dataDir);
  const cloneService = new GitCloneService(cloneConfiguration, logger);

  screen.printLine('');
  screen.printLine(
    `No repository path provided. Cloning ${core.github_repository} into ${targetPath}...`
  );

  const result = await cloneService.cloneInto(targetPath);

  if (result.cloned) {
    screen.printLine(`Repository cloned to: ${result.repositoryPath}`);
  } else {
    screen.printLine(`Repository already cloned at: ${result.repositoryPath}`);
  }

  return result.repositoryPath;
}

async function configureProject(command: SmmCommand): Promise<void> {
  const screen = command.getScreen();

  try {
    screen.printLine('\nSMM project configuration wizard');
    screen.printLine('Answer the prompts below. Leave optional fields empty to skip them.');

    const { dataDir, prompted } = await resolveStoreDataDir(screen);
    const { config, projects } = loadConfigFile(dataDir);
    const { existing, existingIndex } = await selectTargetProject(projects);

    const core = await askCoreQuestions(existing);
    const integrations = await askIntegrationQuestions(existing);
    const misc = await askMiscQuestions(existing);

    const clonedPath = await cloneRepositoryIfNeeded(core, existing, dataDir, screen);
    if (clonedPath) {
      core.git_repository_location = clonedPath;
    }

    const project = buildProjectConfig(core, integrations, misc, existing);

    let nextProjects: ISmmProjectConfig[];
    if (existingIndex === -1) {
      nextProjects = [...projects, project];
    } else {
      nextProjects = [...projects];
      nextProjects[existingIndex] = project;
    }

    const configPath = writeConfigFile(dataDir, { ...config, projects: nextProjects });
    const settingsPath = saveUserSettings(process.env, { store_data_at: dataDir });

    screen.printLine('');
    screen.printLine(`Project "${project.github_repository}" configured.`);
    screen.printLine(`Configuration written to: ${configPath}`);

    if (prompted) {
      screen.printLine('');
      screen.printLine('Default data directory saved to user settings:');
      screen.printLine(`  ${settingsPath}`);
      screen.printLine('Set SMM_STORE_DATA_AT to override this default.');
    }

    screen.printLine('');
    screen.printLine('Run "smm --help" to see the available commands for this project.');
  } catch (error) {
    screen.printLine(
      `Error: ${error instanceof Error ? error.message : 'Failed to configure project'}`
    );
    process.exit(1);
  }
}

function listProjects(command: SmmCommand): void {
  const screen = command.getScreen();
  const configuredDataDir = resolveStoreDataAt(process.env);

  if (!configuredDataDir) {
    screen.printLine(
      'SMM_STORE_DATA_AT is not set. Run "smm project configure" to create a project configuration first.'
    );
    return;
  }

  let projects: ISmmProjectConfig[];
  try {
    ({ projects } = loadConfigFile(configuredDataDir));
  } catch (error) {
    screen.printLine(
      `Error: ${error instanceof Error ? error.message : 'Failed to list projects'}`
    );
    process.exit(1);
  }

  if (projects.length === 0) {
    screen.printLine(
      'No projects configured yet. Run "smm project configure" to add your first project.'
    );
    return;
  }

  screen.printLine('');
  screen.printLine('Configured projects:');
  for (let i = 0; i < projects.length; i += 1) {
    const project = projects[i];
    screen.printLine(
      `  ${i + 1}. ${project.github_repository || '(unnamed)'} (${project.git_provider || 'unknown'})`
    );
  }
}

type DeleteOptions = {
  provider?: string;
  repository?: string;
  yes?: boolean;
};

type DeleteSelectionAnswers = {
  selection: string;
};

type DeleteConfirmAnswers = {
  confirm: boolean;
};

/**
 * Builds the unique identity string for a project entry, in the form
 * `provider/repository` (e.g. `github/acme/widgets`). This is the key used to
 * disambiguate projects that share the same repository across providers.
 */
function projectIdentity(project: ISmmProjectConfig): string {
  const provider = project.git_provider || 'unknown';
  const repository = project.github_repository || '(unnamed)';
  return `${provider}/${repository}`;
}

/**
 * Prompts the user to select which project to delete from the configured list.
 * Choices are shown as `provider/repository` so two projects sharing the same
 * repository across different providers remain distinguishable.
 */
async function selectProjectToDelete(
  projects: ISmmProjectConfig[]
): Promise<{ existing: ISmmProjectConfig | undefined; existingIndex: number }> {
  if (projects.length === 0) {
    return { existing: undefined, existingIndex: -1 };
  }

  const choices = projects.map(projectIdentity);

  const questions: DistinctQuestion<DeleteSelectionAnswers>[] = [
    {
      type: 'select',
      name: 'selection',
      message: 'Which project would you like to delete?',
      choices,
    },
  ];

  const { selection } = await inquirer.prompt(questions);
  const existingIndex = projects.findIndex((project) => projectIdentity(project) === selection);
  return {
    existing: existingIndex >= 0 ? projects[existingIndex] : undefined,
    existingIndex,
  };
}

async function confirmDeletion(identity: string): Promise<boolean> {
  const questions: DistinctQuestion<DeleteConfirmAnswers>[] = [
    {
      type: 'confirm',
      name: 'confirm',
      message: `Delete project "${identity}"? This cannot be undone.`,
      default: false,
    },
  ];

  const { confirm } = await inquirer.prompt(questions);
  return confirm;
}

/**
 * Deletes a project from smm_config.json. Non-interactive mode requires both
 * `--provider` and `--repository` so two projects sharing the same repository
 * across different providers cannot collide. Confirmation is required unless
 * `--yes` is passed. Only the configuration entry is removed; cached data under
 * the project data directory is left untouched.
 */
async function deleteProject(command: SmmCommand, options: DeleteOptions): Promise<void> {
  const screen = command.getScreen();
  const configuredDataDir = resolveStoreDataAt(process.env);

  if (!configuredDataDir) {
    screen.printLine(
      'SMM_STORE_DATA_AT is not set. Run "smm project configure" to create a project configuration first.'
    );
    return;
  }

  if (options.repository && !options.provider) {
    screen.printLine('--provider is required when --repository is provided.');
    process.exit(1);
  }

  if (options.provider && !options.repository) {
    screen.printLine('--repository is required when --provider is provided.');
    process.exit(1);
  }

  let config: ISmmConfigFile;
  let projects: ISmmProjectConfig[];
  try {
    ({ config, projects } = loadConfigFile(configuredDataDir));
  } catch (error) {
    screen.printLine(
      `Error: ${error instanceof Error ? error.message : 'Failed to delete project'}`
    );
    process.exit(1);
  }

  if (projects.length === 0) {
    screen.printLine(
      'No projects configured yet. Run "smm project configure" to add your first project.'
    );
    return;
  }

  let existingIndex: number;
  let existing: ISmmProjectConfig | undefined;

  if (options.provider && options.repository) {
    existingIndex = projects.findIndex(
      (project) =>
        (project.git_provider || 'unknown') === options.provider &&
        project.github_repository === options.repository
    );
    existing = existingIndex >= 0 ? projects[existingIndex] : undefined;

    if (!existing) {
      screen.printLine(`No project found for "${options.provider}/${options.repository}".`);
      process.exit(1);
    }
  } else {
    const selection = await selectProjectToDelete(projects);
    existing = selection.existing;
    existingIndex = selection.existingIndex;

    if (!existing || existingIndex === -1) {
      screen.printLine('No project selected. Deletion cancelled.');
      return;
    }
  }

  const identity = projectIdentity(existing);

  const confirmed = options.yes || (await confirmDeletion(identity));
  if (!confirmed) {
    screen.printLine('Deletion cancelled.');
    return;
  }

  const nextProjects = projects.filter((_, index) => index !== existingIndex);
  writeConfigFile(configuredDataDir, { ...config, projects: nextProjects });

  screen.printLine(`Project "${identity}" deleted.`);
  screen.printLine(
    'Cached data under the project data directory was left untouched. Remove it manually if you no longer need it.'
  );
}

/**
 * Project Command Group
 *
 * Provides commands to configure and manage projects without editing
 * smm_config.json by hand.
 *
 * Commands:
 *   smm project configure   Interactively create or update a project
 *   smm project list        List configured projects
 *   smm project delete      Delete a project from smm_config.json
 */
export function createProjectCommands(program: SmmCommand): void {
  const projectGroup = program.subcommand('project').description('Configure and manage projects');

  projectGroup
    .subcommand('configure')
    .description('Interactively create or update a project in smm_config.json')
    .action(async (_options: unknown, command: SmmCommand) => {
      await configureProject(command);
    });

  projectGroup
    .subcommand('list')
    .description('List configured projects from smm_config.json')
    .action(async (_options: unknown, command: SmmCommand) => {
      listProjects(command);
    });

  projectGroup
    .subcommand('delete')
    .description('Delete a project from smm_config.json')
    .option('--provider <name>', 'Git provider of the project to delete (github, gitlab)')
    .option('--repository <name>', 'Repository (owner/repo) of the project to delete')
    .option('--yes', 'Skip the confirmation prompt')
    .action(async (options: DeleteOptions, command: SmmCommand) => {
      await deleteProject(command, options);
    });
}
