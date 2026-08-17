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
  DeleteEvent: '🗑️',
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

// The public events API returns a trimmed payload (no html_url on most
// nested objects), so URLs are reconstructed from repo name + ids/refs.
function describe(event) {
  const repo = event.repo.name;
  const repoUrl = `https://github.com/${repo}`;
  const payload = event.payload;

  switch (event.type) {
    case 'PushEvent':
      return { text: `pushed to ${repo}`, url: `${repoUrl}/commit/${payload.head}` };
    case 'PullRequestEvent':
      return {
        text: `${payload.action} PR #${payload.number} in ${repo}`,
        url: `${repoUrl}/pull/${payload.number}`,
      };
    case 'ReleaseEvent':
      return {
        text: `released ${payload.release.tag_name} on ${repo}`,
        url: payload.release.html_url || `${repoUrl}/releases/tag/${payload.release.tag_name}`,
      };
    case 'WatchEvent':
      return { text: `starred ${repo}`, url: repoUrl };
    case 'IssuesEvent':
      return {
        text: `${payload.action} issue #${payload.issue.number} in ${repo}`,
        url: payload.issue.html_url || `${repoUrl}/issues/${payload.issue.number}`,
      };
    case 'CreateEvent':
      if (payload.ref_type === 'repository') {
        return { text: `created ${repo}`, url: repoUrl };
      }
      return {
        text: `created ${payload.ref_type} \`${payload.ref}\` in ${repo}`,
        url: `${repoUrl}/tree/${payload.ref}`,
      };
    case 'DeleteEvent':
      return {
        text: `deleted ${payload.ref_type} \`${payload.ref}\` in ${repo}`,
        url: repoUrl,
      };
    case 'ForkEvent':
      return {
        text: `forked ${repo}`,
        url: payload.forkee ? `https://github.com/${payload.forkee.full_name}` : repoUrl,
      };
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
    lines.push(`- ${emoji} [${desc.text}](${desc.url}) \`${timeAgo(event.created_at)}\``);
    if (lines.length === MAX_LINES) break;
  }

  const block = lines.length
    ? lines.join('\n')
    : '_(nothing recent — go build something)_';

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
