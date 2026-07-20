import { promptLogger } from './mcp-logger';
import type { McpPromptDefinition, McpPromptResult } from './mcp-types';

export const prompts: McpPromptDefinition[] = [
  {
    name: 'smm_sprint_health_review',
    description:
      'Review engineering health for the current sprint and highlight metrics that need attention.',
    arguments: [
      {
        name: 'project',
        description: 'Optional github_repository project name from smm_config.json.',
        required: false,
      },
      {
        name: 'startDate',
        description: 'Current window start date (YYYY-MM-DD).',
        required: false,
      },
      {
        name: 'endDate',
        description: 'Current window end date (YYYY-MM-DD).',
        required: false,
      },
    ],
  },
  {
    name: 'smm_compare_windows',
    description:
      'Compare engineering health between two time windows and summarise what improved or regressed.',
    arguments: [
      {
        name: 'project',
        description: 'Optional github_repository project name from smm_config.json.',
        required: false,
      },
      {
        name: 'startDate',
        description: 'Current window start date (YYYY-MM-DD).',
        required: true,
      },
      {
        name: 'endDate',
        description: 'Current window end date (YYYY-MM-DD).',
        required: true,
      },
      {
        name: 'compareStartDate',
        description: 'Previous window start date (YYYY-MM-DD).',
        required: true,
      },
      {
        name: 'compareEndDate',
        description: 'Previous window end date (YYYY-MM-DD).',
        required: true,
      },
    ],
  },
  {
    name: 'smm_dora_summary',
    description:
      'Summarise DORA metrics for a project, including deployment frequency and failure rate.',
    arguments: [
      {
        name: 'project',
        description: 'Optional github_repository project name from smm_config.json.',
        required: false,
      },
      {
        name: 'startDate',
        description: 'Optional window start date (YYYY-MM-DD).',
        required: false,
      },
      {
        name: 'endDate',
        description: 'Optional window end date (YYYY-MM-DD).',
        required: false,
      },
    ],
  },
  {
    name: 'smm_code_hotspots',
    description:
      'Identify code hotspots (high churn and high coupling files) and pair-programming gaps for a project.',
    arguments: [
      {
        name: 'project',
        description: 'Optional github_repository project name from smm_config.json.',
        required: false,
      },
      {
        name: 'startDate',
        description: 'Optional window start date (YYYY-MM-DD).',
        required: false,
      },
      {
        name: 'endDate',
        description: 'Optional window end date (YYYY-MM-DD).',
        required: false,
      },
    ],
  },
];

type PromptArgumentValues = Record<string, string | undefined>;

function getArg(values: PromptArgumentValues, name: string): string | undefined {
  const value = values[name];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function optional(value: string | undefined): string {
  return value ? value : '<not provided>';
}

export async function getPrompt(name: string, argumentsValue: unknown): Promise<McpPromptResult> {
  promptLogger.debug(`Building prompt ${name}`, { arguments: argumentsValue });

  const values: PromptArgumentValues =
    argumentsValue && typeof argumentsValue === 'object' && !Array.isArray(argumentsValue)
      ? (argumentsValue as PromptArgumentValues)
      : {};
  const project = getArg(values, 'project');
  const startDate = getArg(values, 'startDate');
  const endDate = getArg(values, 'endDate');
  const compareStartDate = getArg(values, 'compareStartDate');
  const compareEndDate = getArg(values, 'compareEndDate');

  const messages: McpPromptResult['messages'] = [];

  switch (name) {
    case 'smm_sprint_health_review':
      messages.push({
        role: 'user',
        content: {
          type: 'text',
          text: [
            'You are acting as a software engineering coach.',
            'Use the Software Metrics Machine MCP tools to evaluate the engineering health of the project.',
            '',
            `Project: ${optional(project)}`,
            `Current window: ${optional(startDate)} to ${optional(endDate)}`,
            '',
            'Steps:',
            '1. Call smm_get_engineering_health with the filters above.',
            '2. Highlight any metric whose recommendation level is "watch" or "critical".',
            '3. Suggest one concrete action for each degraded metric, grounded in the data returned.',
          ].join('\n'),
        },
      });
      break;

    case 'smm_compare_windows':
      messages.push({
        role: 'user',
        content: {
          type: 'text',
          text: [
            'You are acting as a software engineering coach.',
            'Use the Software Metrics Machine MCP tools to compare two windows.',
            '',
            `Project: ${optional(project)}`,
            `Current window: ${optional(startDate)} to ${optional(endDate)}`,
            `Previous window: ${optional(compareStartDate)} to ${optional(compareEndDate)}`,
            '',
            'Steps:',
            '1. Call smm_get_engineering_health with startDate, endDate, compareStartDate, and compareEndDate.',
            '2. For each metric, summarise whether the trend is improving, stable, or degrading.',
            '3. Produce a short before/after table and a prioritised list of follow-up actions.',
          ].join('\n'),
        },
      });
      break;

    case 'smm_dora_summary':
      messages.push({
        role: 'user',
        content: {
          type: 'text',
          text: [
            'You are acting as a DORA metrics analyst.',
            'Use the Software Metrics Machine MCP tools to report DORA metrics.',
            '',
            `Project: ${optional(project)}`,
            `Window: ${optional(startDate)} to ${optional(endDate)}`,
            '',
            'Steps:',
            '1. Call smm_get_dora_metrics with the filters above.',
            '2. Report deployment frequency, failure rate signals, and pipeline duration.',
            '3. Classify the project against the DORA tiers (elite, high, medium, low) where possible.',
          ].join('\n'),
        },
      });
      break;

    case 'smm_code_hotspots':
      messages.push({
        role: 'user',
        content: {
          type: 'text',
          text: [
            'You are acting as a code health reviewer.',
            'Use the Software Metrics Machine MCP tools to surface code hotspots.',
            '',
            `Project: ${optional(project)}`,
            `Window: ${optional(startDate)} to ${optional(endDate)}`,
            '',
            'Steps:',
            '1. Call smm_get_code_metrics to retrieve churn, coupling, and pairing data.',
            '2. Identify files with the highest churn and strongest coupling.',
            '3. Cross-reference pairing gaps and propose concrete refactoring or pairing actions.',
          ].join('\n'),
        },
      });
      break;

    default:
      throw new Error(`Unknown MCP prompt: ${name}`);
  }

  return {
    description: prompts.find((prompt) => prompt.name === name)?.description,
    messages,
  };
}
