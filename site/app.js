import { RANKINGS_URL } from './config.js';
import { LISTS, TIER_POINTS, overallPlayers, playerTitle, tierColumnPlayers, prepareSnapshot } from './rankings.js';
const $ = selector => document.querySelector(selector);
let data;
let selected = 'overall';
let profiles = new Map();
function skinBust(player, large = false) {
  const frame = element('span', `skin-frame${large ? ' large' : ''}`, '');
  const fallback = element('span', 'skin-fallback', player.username.slice(0, 2).toUpperCase());
  fallback.setAttribute('aria-hidden', 'true');
  const image = document.createElement('img');
  const subject = data.demo ? (Number(player.uuid.slice(-1)) % 2 ? 'MHF_Alex' : 'MHF_Steve') : player.uuid;
  image.src = `https://render.crafty.gg/3d/bust/${encodeURIComponent(subject)}?width=${large ? 240 : 96}&height=${large ? 240 : 96}`;
  image.width = large ? 120 : 40; image.height = large ? 120 : 40;
  image.alt = ''; image.loading = large ? 'eager' : 'lazy'; image.decoding = 'async'; image.referrerPolicy = 'no-referrer';
  image.addEventListener('load', () => { fallback.hidden = true; });
  image.addEventListener('error', () => { image.hidden = true; });
  frame.append(fallback, image); return frame;
}
function modePlacement(slug, name, tier) {
  const placement = element('span', 'overall-placement', '');
  if (tier) placement.dataset.tier = tier;
  placement.setAttribute('aria-label', `${name}: ${tier || 'Unranked'}, ${TIER_POINTS[tier] || 0} Points`);
  const icon = listIcon(slug); icon.alt = name;
  const circle = element('span', 'mode-icon-circle', ''); circle.append(icon);
  const badge = element('span', tier ? 'tier-badge' : 'unranked', tier || '—');
  if (tier) badge.dataset.tier = tier;
  placement.append(circle, badge); return placement;
}
function hidePlacementDisplay() {
  const display = $('#placement-display');
  if (display.matches(':popover-open')) display.hidePopover();
}
function showPlacementDisplay(row, name, tier) {
  const display = $('#placement-display');
  display.textContent = `${name} - ${TIER_POINTS[tier]} Points`;
  display.dataset.tier = tier;
  if (!display.matches(':popover-open')) display.showPopover();
  const box = row.getBoundingClientRect();
  const panel = display.getBoundingClientRect();
  display.style.left = `${Math.max(12, Math.min(innerWidth - panel.width - 12, box.left + (box.width - panel.width) / 2))}px`;
  display.style.top = `${box.bottom + panel.height + 12 <= innerHeight ? box.bottom + 10 : Math.max(12, box.top - panel.height - 10)}px`;
}
function openProfile(player) {
  const profile = profiles.get(player.uuid); if (!profile) return;
  hidePlacementDisplay();
  $('#profile-username').textContent = profile.username;
  $('#profile-title').textContent = playerTitle(profile);
  $('#profile-summary').textContent = `${profile.score} Points · Rank #${profile.rank}`;
  $('#profile-skin').replaceChildren(skinBust(profile, true));
  $('#profile-tiers').replaceChildren();
  for (const [slug, name] of LISTS) {
    const tier = profile.placements[slug]; if (!tier) continue;
    const row = modePlacement(slug, name, tier); row.classList.add('profile-tier');
    row.tabIndex = 0; row.dataset.tier = tier;
    row.setAttribute('aria-label', `${name}: ${tier}, ${TIER_POINTS[tier]} Points`);
    row.setAttribute('aria-describedby', 'placement-display');
    row.addEventListener('pointerenter', () => showPlacementDisplay(row, name, tier));
    row.addEventListener('pointerleave', hidePlacementDisplay);
    row.addEventListener('focus', () => showPlacementDisplay(row, name, tier));
    row.addEventListener('blur', hidePlacementDisplay);
    $('#profile-tiers').append(row);
  }
  if (!$('#profile-tiers').children.length) $('#profile-tiers').append(element('p', 'profile-no-tiers', 'No tier placements yet.'));
  $('#player-profile').showModal(); document.body.classList.add('profile-open');
}
function playerButton(player) {
  const button = element('button', 'player-button', ''); button.type = 'button';
  button.setAttribute('aria-label', `View ${player.username}'s profile`);
  button.setAttribute('aria-haspopup', 'dialog');
  button.append(skinBust(player), element('span', 'player-name', player.username));
  button.addEventListener('click', () => openProfile(player)); return button;
}
function listIcon(slug) {
  const icon = document.createElement('img');
  icon.src = `assets/${slug}.png`; icon.alt = ''; icon.width = 36; icon.height = 36;
  icon.addEventListener('error', () => { icon.hidden = true; });
  return icon;
}
function renderOverall(term) {
  const players = [...profiles.values()].filter(player => player.username.toLowerCase().includes(term));
  $('#list-description').textContent = 'Players ranked by total points across all seven tier lists. Equal scores share a rank.';
  $('#list-description').hidden = false; $('.list-info').hidden = false;
  $('#count').textContent = `${players.length} tested ${players.length === 1 ? 'player' : 'players'}${term ? ' matching your search' : ''}`;
  if (!players.length) { $('#tier-grid').append(element('p', 'overall-empty', term ? 'No matching players.' : 'No players have been published yet.')); return; }
  const table = element('table', 'overall-table', '');
  const caption = element('caption', 'sr-only', 'Overall player rankings by total tier points');
  const head = document.createElement('thead'); const titles = document.createElement('tr');
  for (const name of ['#', 'Player', 'Points', 'Tiers']) {
    const cell = element('th', '', name); cell.scope = 'col'; titles.append(cell);
  }
  head.append(titles);
  const body = document.createElement('tbody');
  for (const player of players) {
    const row = document.createElement('tr');
    row.append(element('td', 'overall-rank', `${player.rank}.`));
    const name = element('th', 'player-name', ''); name.scope = 'row';
    const button = playerButton(player); name.append(button); row.append(name);
    row.className = 'profile-row';
    row.dataset.rank = String(player.rank);
    row.style.setProperty('--rank-scale', String(Math.max(0, 10 - player.rank) / 9));
    row.addEventListener('click', event => { if (!event.target.closest('button')) { button.focus(); openProfile(player); } });
    row.append(element('td', 'overall-score', String(player.score)));
    const tiers = element('td', 'overall-tiers-cell', '');
    const placements = element('div', 'overall-placements', '');
    for (const [slug, listName] of LISTS) {
      const tier = player.placements[slug];
      const placement = modePlacement(slug, listName, tier);
      placement.title = `${listName}: ${tier || 'Unranked'} (${TIER_POINTS[tier] || 0} Pts)`;
      placements.append(placement);
    }
    tiers.append(placements); row.append(tiers);
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
  $('#rankings-title').textContent = selected === 'overall' ? 'Overall Rankings' : `${list.name} Rankings`;
  for (const button of $('#tier-list').children) button.setAttribute('aria-pressed', String(button.dataset.slug === selected));
  if (selected === 'overall') { renderOverall(term); return; }
  $('#list-description').textContent = ''; $('#list-description').hidden = true;
  $('.list-info').hidden = true;
  if (/^https:\/\/(discord\.gg\/[A-Za-z0-9-]+|discord\.com\/invite\/[A-Za-z0-9-]+)$/.test(list.inviteUrl || '')) {
    $('#join-discord').href = list.inviteUrl; $('#join-discord').hidden = false;
    $('.list-info').hidden = false;
  }
  const players = list.players.filter(p => p.username.toLowerCase().includes(term));
  $('#count').textContent = `${players.length} tested ${players.length === 1 ? 'player' : 'players'}${term ? ' matching your search' : ''}`;
  for (let number = 1; number <= 5; number++) {
    const column = element('article', 'tier-column', '');
    column.dataset.tier = String(number);
    const heading = element('h3', '', `TIER ${number}`);
    const ul = document.createElement('ul');
    const members = tierColumnPlayers(players, number, profiles);
    for (const player of members) {
      const li = element('li', 'player-row', '');
      const button = playerButton(player);
      button.classList.add(player.tier.startsWith('LT') ? 'low-tier-player' : 'high-tier-player');
      button.setAttribute('aria-label', `View ${player.username}'s profile, ${player.tier}`);
      li.append(button);
      ul.append(li);
    }
    if (!members.length) ul.append(element('li', 'empty-row', term ? 'No matching players' : 'No players yet'));
    column.append(heading, ul); $('#tier-grid').append(column);
  }
}
let loading = false;
async function load() {
  if (loading) return;
  loading = true;
  const initial = !data;
  $('#retry').hidden = true;
  try {
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
    const response = await fetch(local ? './data/tiers.json' : RANKINGS_URL, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Request failed');
    const next = prepareSnapshot(await response.json());
    const nextProfiles = new Map(overallPlayers(next).map(player => [player.uuid, player]));
    data = next;
    profiles = nextProfiles;
    $('#demo-notice').hidden = !data.demo;
    if (initial) {
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
    }
    const date = data.generatedAt ? new Date(data.generatedAt) : null;
    const stale = date && Date.now() - date.getTime() > 60 * 60 * 1000;
    $('#updated').textContent = data.demo ? 'Local sample data · All tiers populated' : date ? `${stale ? 'Updates delayed · ' : ''}Updated ${date.toLocaleString()}` : 'Awaiting the first published rankings';
    render();
  } catch {
    $('#updated').textContent = data ? 'Updates delayed · Showing the last successful rankings' : 'Rankings are temporarily unavailable. Please try again.';
    $('#retry').hidden = false;
  } finally { loading = false; }
}
$('#search').addEventListener('input', () => { if (data) render(); });
$('#retry').addEventListener('click', load);
document.addEventListener('keydown', event => {
  if ($('#player-profile').open) return;
  if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
  if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return;
  event.preventDefault();
  $('#search').focus();
});
$('#close-profile').addEventListener('click', () => $('#player-profile').close());
$('#player-profile').addEventListener('close', () => { hidePlacementDisplay(); document.body.classList.remove('profile-open'); });
window.addEventListener('resize', hidePlacementDisplay);
$('#player-profile').addEventListener('scroll', hidePlacementDisplay);
$('#profile-tiers').addEventListener('scroll', hidePlacementDisplay);
$('#player-profile').addEventListener('click', event => {
  const box = event.currentTarget.getBoundingClientRect();
  if (event.target === event.currentTarget && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) event.currentTarget.close();
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
setInterval(load, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
