import { LISTS, overallPlayers } from './rankings.js';
const $ = selector => document.querySelector(selector);
let data;
let selected = 'overall';
function listIcon(slug) {
  const icon = document.createElement('img');
  icon.src = `assets/${slug}.png`; icon.alt = ''; icon.width = 24; icon.height = 24;
  icon.addEventListener('error', () => { icon.hidden = true; });
  return icon;
}
function renderOverall(term) {
  const players = overallPlayers(data).filter(player => player.username.toLowerCase().includes(term));
  $('#list-description').textContent = 'Players ranked by total points across all seven tier lists. Equal scores share a rank.';
  $('#count').textContent = `${players.length} ${players.length === 1 ? 'player' : 'players'}${term ? ' matching your search' : ' in the network'}`;
  if (!players.length) { $('#tier-grid').append(element('p', 'overall-empty', term ? 'No matching players.' : 'No players have been published yet.')); return; }
  const table = element('table', 'overall-table', '');
  const caption = element('caption', 'sr-only', 'Overall player rankings by total tier points');
  const head = document.createElement('thead'); const titles = document.createElement('tr');
  for (const name of ['Rank', 'Player', 'Points', ...LISTS.map(([, name]) => name)]) {
    const cell = element('th', '', name); cell.scope = 'col'; titles.append(cell);
  }
  head.append(titles);
  const body = document.createElement('tbody');
  for (const player of players) {
    const row = document.createElement('tr');
    row.append(element('td', 'overall-rank', `#${player.rank}`));
    const name = element('th', 'player-name', player.username); name.scope = 'row'; row.append(name);
    row.append(element('td', 'overall-score', String(player.score)));
    for (const [slug] of LISTS) {
      const cell = document.createElement('td'); const tier = player.placements[slug];
      cell.append(element('span', tier ? `tier-badge ${tier.startsWith('LT') ? 'low' : ''}` : 'unranked', tier || '—'));
      if (!tier) cell.setAttribute('aria-label', 'Unranked');
      row.append(cell);
    }
    body.append(row);
  }
  table.append(caption, head, body); $('#tier-grid').append(table);
}
function element(tag, className, text) {
  const node = document.createElement(tag); node.className = className; node.textContent = text; return node;
}
function render() {
  const list = data.tierLists.find(t => t.slug === selected) || { slug: selected, name: LISTS.find(([slug]) => slug === selected)?.[1], players: [] };
  $('#tier-grid').replaceChildren(); $('#empty').hidden = true;
  $('#tier-grid').classList.toggle('overall-grid', selected === 'overall');
  $('#join-discord').hidden = true;
  const url = new URL(location.href); url.searchParams.set('list', selected); history.replaceState(null, '', url);
  const term = $('#search').value.trim().toLowerCase();
  $('#rankings-title').textContent = selected === 'overall' ? 'Overall rankings' : `${list.name} rankings`;
  for (const button of $('#tier-list').children) button.setAttribute('aria-pressed', String(button.dataset.slug === selected));
  if (selected === 'overall') { renderOverall(term); return; }
  $('#list-description').textContent = list.description || `Explore the ${list.name} tier list.`;
  if (/^https:\/\/(discord\.gg\/[A-Za-z0-9-]+|discord\.com\/invite\/[A-Za-z0-9-]+)$/.test(list.inviteUrl || '')) {
    $('#join-discord').href = list.inviteUrl; $('#join-discord').hidden = false;
  }
  const players = list.players.filter(p => p.username.toLowerCase().includes(term));
  $('#count').textContent = `${players.length} ${players.length === 1 ? 'player' : 'players'}${term ? ' matching your search' : ' ranked'}`;
  for (let number = 1; number <= 5; number++) {
    const column = element('article', 'tier-column', '');
    const heading = element('h3', '', '');
    heading.append(element('span', '', String(number)), document.createTextNode(`Tier ${number}`));
    const ul = document.createElement('ul');
    const members = players.filter(p => p.tier === `HT${number}` || p.tier === `LT${number}`);
    for (const player of members) {
      const li = element('li', 'player-row', '');
      li.append(element('span', 'player-name', player.username), element('span', `tier-badge ${player.tier.startsWith('LT') ? 'low' : ''}`, player.tier));
      ul.append(li);
    }
    if (!members.length) ul.append(element('li', 'empty-row', term ? 'No matching players' : 'No players yet'));
    column.append(heading, ul); $('#tier-grid').append(column);
  }
}
async function load() {
  $('#retry').hidden = true;
  try {
    const response = await fetch('data/tiers.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Request failed');
    data = await response.json();
    if (data.schemaVersion !== 1 || !Array.isArray(data.tierLists)) throw new Error('Unsupported data');
    const select = $('#tier-list'); select.replaceChildren();
    for (const [slug, name] of [['overall', 'Overall'], ...LISTS]) {
      const button = element('button', 'list-option', ''); button.type = 'button'; button.dataset.slug = slug;
      if (slug !== 'overall') button.append(listIcon(slug));
      button.append(document.createTextNode(name));
      button.addEventListener('click', () => { selected = slug; render(); });
      select.append(button);
    }
    const requested = new URLSearchParams(location.search).get('list');
    selected = LISTS.some(([slug]) => slug === requested) ? requested : 'overall';
    const date = data.generatedAt ? new Date(data.generatedAt) : null;
    const stale = date && Date.now() - date.getTime() > 60 * 60 * 1000;
    $('#updated').textContent = date ? `${stale ? 'Updates delayed · ' : ''}Updated ${date.toLocaleString()}` : 'Awaiting the first published rankings';
    render();
  } catch {
    $('#updated').textContent = 'Rankings are temporarily unavailable. Please try again.';
    $('#retry').hidden = false;
  }
}
$('#search').addEventListener('input', () => { if (data) render(); });
$('#retry').addEventListener('click', load);
document.addEventListener('keydown', event => {
  if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
  if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return;
  event.preventDefault();
  $('#search').focus();
});
let copyTimer;
$('#copy-ip').addEventListener('click', async () => {
  clearTimeout(copyTimer);
  try {
    await navigator.clipboard.writeText($('#server-ip').textContent);
    $('#copy-status').textContent = 'Copied!';
  } catch {
    $('#copy-status').textContent = 'Select the address to copy';
  }
  copyTimer = setTimeout(() => { $('#copy-status').textContent = ''; }, 4000);
});
load();
