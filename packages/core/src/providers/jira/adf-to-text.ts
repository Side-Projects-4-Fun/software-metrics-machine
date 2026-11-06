type AdfNode = {
  type?: string;
  text?: string;
  content?: AdfNode[];
  attrs?: Record<string, unknown>;
};

const BLOCK_CONTAINERS = new Set([
  'doc',
  'bulletList',
  'orderedList',
  'panel',
  'blockquote',
  'table',
  'tableRow',
  'listItem',
  'tableCell',
  'tableHeader',
]);

function readAttribute(node: AdfNode, key: string): string | undefined {
  const value = node.attrs?.[key];
  return typeof value === 'string' ? value : undefined;
}

function flattenNode(node: AdfNode): string {
  if (node.type === 'text') {
    return node.text ?? '';
  }

  if (node.type === 'hardBreak') {
    return '\n';
  }

  if (node.type === 'mention') {
    return readAttribute(node, 'text') ?? readAttribute(node, 'displayName') ?? '';
  }

  if (node.type === 'emoji') {
    return readAttribute(node, 'text') ?? readAttribute(node, 'shortName') ?? '';
  }

  if (node.type === 'inlineCard' || node.type === 'blockCard') {
    return readAttribute(node, 'url') ?? '';
  }

  const children = node.content ?? [];
  const separator = node.type && BLOCK_CONTAINERS.has(node.type) ? '\n' : '';

  return children.map(flattenNode).join(separator);
}

/**
 * Flattens Atlassian Document Format into plain text.
 *
 * Jira REST API v3 returns comment bodies as ADF documents instead of strings.
 * This helper keeps the domain `IssueComment.body` provider-neutral without
 * pulling in a full ADF renderer.
 */
export function adfToPlainText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (!value || typeof value !== 'object') {
    return '';
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => (entry && typeof entry === 'object' ? flattenNode(entry as AdfNode) : ''))
      .filter((entry) => entry.length > 0)
      .join('\n')
      .trim();
  }

  return flattenNode(value as AdfNode)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
