export type WorkflowJsonResponse = {
  id: string;
  name: string;
  node_id: string;
  head_branch: string;
  head_sha: string;
  path: string;
  display_title: string;
  run_number: string;
  event: string;
  status: string;
  conclusion: string;
  workflow_id: string;
  check_suite_id: string;
  check_suite_node_id: string;
  url: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  run_attempt: string;
  run_started_at: string;
};

export type WorkflowJobStepJsonResponse = {
  name: string;
  status: string;
  conclusion: string;
  number: number;
  started_at: string;
  completed_at: string;
};

export type WorkflowJobJsonResponse = {
  id: string;
  run_id: string;
  workflow_name: string;
  head_branch: string;
  run_url: string;
  run_attempt: string;
  node_id: string;
  head_sha: string;
  url: string;
  html_url: string;
  status: string;
  conclusion: string;
  created_at: string;
  started_at: string;
  completed_at: string;
  name: string;
  steps?: WorkflowJobStepJsonResponse[];
};

export type PullRequestLabelJsonResponse = {
  id: string;
  node_id: string;
  url: string;
  name: string;
  color: string;
  default: boolean;
  description: string;
};

export type PullRequestJsonResponse = {
  url: string;
  id: string;
  node_id: string;
  html_url: string;
  diff_url: string;
  patch_url: string;
  issue_url: string;
  number: string;
  state: string;
  locked: boolean;
  title: string;
  body?: string;
  created_at: string;
  updated_at: string;
  closed_at: string;
  merged_at: string;
  labels: PullRequestLabelJsonResponse[];
  user?: {
    login: string;
    id: number;
    node_id: string;
    avatar_url: string;
    gravatar_id: string;
    url: string;
    html_url: string;
    followers_url: string;
    following_url: string;
    gists_url: string;
    starred_url: string;
    subscriptions_url: string;
    organizations_url: string;
    repos_url: string;
    events_url: string;
    received_events_url: string;
    type: string;
    user_view_type: string;
    site_admin: boolean;
  };
};

export interface PullRequestCommentJsonResponse {
  url: string;
  pull_request_review_id?: number;
  id: number;
  node_id: string;
  diff_hunk: string;
  path: string;
  position?: number;
  original_position?: number;
  commit_id: string;
  original_commit_id: string;
  in_reply_to_id?: number;
  user?: {
    login: string;
    id: number;
    node_id?: string;
    avatar_url?: string;
    gravatar_id?: string;
    url?: string;
    html_url?: string;
    followers_url?: string;
    following_url?: string;
    gists_url?: string;
    starred_url?: string;
    subscriptions_url?: string;
    organizations_url?: string;
    repos_url?: string;
    events_url?: string;
    received_events_url?: string;
    type?: string;
    site_admin?: boolean;
  };
  body: string;
  created_at: string;
  updated_at: string;
  html_url: string;
  pull_request_url: string;
  reactions: {
    url: string;
    total_count: number;
    '+1': number;
    '-1': number;
    laugh: number;
    hooray: number;
    confused: number;
    heart: number;
    rocket: number;
    eyes: number;
  };
}

export type GitHubIssueLabelJsonResponse = {
  id?: number | string;
  name: string;
  color?: string;
  description?: string | null;
};

export type GitHubIssueJsonResponse = {
  id: number;
  number: number;
  title: string;
  body?: string | null;
  state: 'open' | 'closed';
  state_reason?: string | null;
  html_url: string;
  url: string;
  comments: number;
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
  assignee?: { login: string } | null;
  labels: Array<GitHubIssueLabelJsonResponse | string>;
  pull_request?: unknown;
  user?: { login: string };
};

export type GitHubIssueCommentJsonResponse = {
  id: number;
  body?: string | null;
  html_url: string;
  issue_url: string;
  created_at: string;
  updated_at: string;
  user?: { login: string } | null;
};
