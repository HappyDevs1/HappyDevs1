const fs = require('fs');

const USERNAME = 'HappyDevs1';
const README_PATH = 'README.md';
const START_MARKER = '<!-- recent_activity starts -->';
const END_MARKER = '<!-- recent_activity ends -->';
const MAX_LINES = 5;

const EMOJI = {
  PushEvent: '🚀',
  PullRequestEvent: '🔀',
  ReleaseEvent: '📦',
  WatchEvent: '⭐',
  IssuesEvent: '🐛',
  CreateEvent: '✨',
  ForkEvent: '🍴',
};

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function describe(event) {
  const repo = event.repo.name;
  switch (event.type) {
    case 'PushEvent': {
      const n = event.payload.commits ? event.payload.commits.length : 0;
      return `pushed ${n} commit${n === 1 ? '' : 's'} to ${repo}`;
    }
    case 'PullRequestEvent':
      return `${event.payload.action} PR #${event.payload.number} in ${repo}`;
    case 'ReleaseEvent':
      return `released ${event.payload.release.tag_name} on ${repo}`;
    case 'WatchEvent':
      return `starred ${repo}`;
    case 'IssuesEvent':
      return `${event.payload.action} issue #${event.payload.issue.number} in ${repo}`;
    case 'CreateEvent':
      return event.payload.ref_type === 'repository'
        ? `created ${repo}`
        : `created ${event.payload.ref_type} in ${repo}`;
    case 'ForkEvent':
      return `forked ${repo}`;
    default:
      return null;
  }
}

async function main() {
  const res = await fetch(`https://api.github.com/users/${USERNAME}/events/public`, {
    headers: {
      'User-Agent': USERNAME,
      Accept: 'application/vnd.github+json',
      ...(process.env.GH_TOKEN ? { Authorization: `Bearer ${process.env.GH_TOKEN}` } : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${await res.text()}`);
  }
  const events = await res.json();

  const lines = [];
  for (const event of events) {
    const desc = describe(event);
    if (!desc) continue;
    const emoji = EMOJI[event.type] || '•';
    lines.push(`  ${emoji} ${desc} (${timeAgo(event.created_at)})`);
    if (lines.length === MAX_LINES) break;
  }

  const block = [
    '```bash',
    '$ recent_activity --last 5',
    ...(lines.length ? lines : ['  (nothing recent — go build something)']),
    '```',
  ].join('\n');

  const readme = fs.readFileSync(README_PATH, 'utf8');
  const startIdx = readme.indexOf(START_MARKER);
  const endIdx = readme.indexOf(END_MARKER);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error('Markers not found in README.md');
  }

  const updated =
    readme.slice(0, startIdx + START_MARKER.length) +
    '\n' + block + '\n' +
    readme.slice(endIdx);

  fs.writeFileSync(README_PATH, updated);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
