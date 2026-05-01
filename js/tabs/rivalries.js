const RivalriesTab = {
  selectedUid: null, // null = show all managers

  render() {
    const career  = DataStore.careerStats();
    const userIds = Object.keys(career).sort((a, b) =>
      this.cleanName(career[a]?.name || '').localeCompare(this.cleanName(career[b]?.name || ''))
    );
    const matrix = this.getH2HMatrix(userIds);

    return `
      <div class="tab-content" id="rivalries">

        <div class="rivalry-filter-bar">
          <label class="filter-label">Focus on team:</label>
          <select id="rivalry-select" onchange="RivalriesTab.filterByManager(this.value)">
            <option value="">All Managers</option>
            ${userIds.map(uid => `
              <option value="${uid}" ${uid === this.selectedUid ? 'selected' : ''}>
                ${this.cleanName(career[uid]?.name || uid)}
              </option>
            `).join('')}
          </select>
        </div>

        ${this.selectedUid
          ? this.renderFocusedView(this.selectedUid, userIds, career, matrix)
          : this.renderAllView(userIds, career, matrix)
        }
      </div>
    `;
  },

  filterByManager(uid) {
    this.selectedUid = uid || null;
    Object.values(Chart.instances || {}).forEach(c => c.destroy());
    document.getElementById('app-root').innerHTML = this.render();
  },

  // ── Helpers ─────────────────────────────────────────────────

  // Strip emojis from a name for clean display / matrix labels
  cleanName(name) {
    return (name || '').replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}]+/gu, '').trim();
  },

  // Short label for H2H matrix columns — skip leading "The"
  shortName(uid, career) {
    const clean = this.cleanName(career[uid]?.name || uid);
    const words = clean.trim().split(/\s+/);
    const start = words[0]?.toLowerCase() === 'the' ? 1 : 0;
    return words[start] || clean;
  },

  getH2HMatrix(userIds) {
    const matrix = {};
    for (const a of userIds) {
      matrix[a] = {};
      for (const b of userIds) {
        if (a !== b) matrix[a][b] = DataStore.headToHead(a, b);
      }
    }
    return matrix;
  },

  getRivalryData(uid, userIds, matrix) {
    let rival = null, rivalScore = Infinity, rivalTotal = 0;
    let nemesis = null, nemesisMargin = 0;
    let punching = null, punchingMargin = 0;

    for (const opp of userIds) {
      if (opp === uid) continue;
      const h = matrix[uid][opp];
      const total = h.wins + h.losses;
      if (total < 2) continue;
      const margin = h.wins - h.losses;
      const closeness = Math.abs(margin);

      if (closeness < rivalScore || (closeness === rivalScore && total > rivalTotal)) {
        rivalScore = closeness; rivalTotal = total; rival = opp;
      }
      if (nemesis === null || margin < nemesisMargin) { nemesisMargin = margin; nemesis = opp; }
      if (punching === null || margin > punchingMargin) { punchingMargin = margin; punching = opp; }
    }
    return { rival, nemesis, punching, nemesisMargin, punchingMargin, matrix };
  },

  // ── All Managers view ────────────────────────────────────────

  renderAllView(userIds, career, matrix) {
    return `
      <section class="section">
        <h3 class="section-title">Rivalry Profiles</h3>
        <div class="rivalry-grid">
          ${userIds.map(uid => this.renderRivalryCard(uid, userIds, career, matrix)).join('')}
        </div>
      </section>

      <section class="section">
        <h3 class="section-title">Head-to-Head Matrix</h3>
        <p class="section-sub">Green = winning record &nbsp;·&nbsp; Red = losing record &nbsp;·&nbsp; Hover for details</p>
        <div class="table-wrap h2h-wrap">
          ${this.renderH2HMatrix(userIds, career, matrix)}
        </div>
      </section>

      <section class="section">
        <h3 class="section-title">Most Lopsided All-Time Records</h3>
        <div class="table-wrap">
          ${this.renderLopsided(userIds, career)}
        </div>
      </section>
    `;
  },

  // ── Focused single-manager view ──────────────────────────────

  renderFocusedView(uid, userIds, career, matrix) {
    const name = this.cleanName(career[uid]?.name || uid);
    const { rival, nemesis, punching, nemesisMargin, punchingMargin } = this.getRivalryData(uid, userIds, matrix);

    // H2H detail: this manager vs every other, sorted by games played
    const opponents = userIds
      .filter(o => o !== uid)
      .map(o => ({ uid: o, ...matrix[uid][o] }))
      .filter(o => o.wins + o.losses > 0)
      .sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses));

    const rivalName   = rival   ? this.cleanName(career[rival]?.name   || rival)   : null;
    const nemesisName = nemesis ? this.cleanName(career[nemesis]?.name || nemesis) : null;
    const punchName   = punching? this.cleanName(career[punching]?.name|| punching): null;

    return `
      <section class="section">
        <div class="focused-header">
          <div class="focused-name">${name}</div>
          <div class="focused-badges">
            ${rival ? `<div class="focused-badge rival-badge"><span class="badge-icon">⚔️</span><span class="badge-label">Rival</span><span class="badge-team">${rivalName}</span><span class="badge-record">${matrix[uid][rival].wins}–${matrix[uid][rival].losses}</span></div>` : ''}
            ${nemesis && nemesis !== rival && nemesisMargin < 0 ? `<div class="focused-badge nemesis-badge"><span class="badge-icon">😤</span><span class="badge-label">Nemesis</span><span class="badge-team">${nemesisName}</span><span class="badge-record">${matrix[uid][nemesis].wins}–${matrix[uid][nemesis].losses}</span></div>` : ''}
            ${punching && punching !== nemesis && punchingMargin > 0 ? `<div class="focused-badge punching-badge"><span class="badge-icon">💪</span><span class="badge-label">Punching Bag</span><span class="badge-team">${punchName}</span><span class="badge-record">${matrix[uid][punching].wins}–${matrix[uid][punching].losses}</span></div>` : ''}
          </div>
        </div>

        <h3 class="section-title" style="margin-top:1.5rem">Record vs Every Opponent</h3>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr><th>Opponent</th><th>W</th><th>L</th><th>Win%</th><th>PF</th><th>PA</th><th>Diff</th></tr>
            </thead>
            <tbody>
              ${opponents.map(o => {
                const total = o.wins + o.losses;
                const pct   = total ? ((o.wins / total) * 100).toFixed(1) : '0.0';
                const diff  = +(o.pf - o.pa).toFixed(1);
                const cls   = o.wins > o.losses ? 'h2h-win' : o.wins < o.losses ? 'h2h-loss' : 'h2h-tie';
                return `<tr>
                  <td class="manager-name">${this.cleanName(career[o.uid]?.name || o.uid)}</td>
                  <td>${o.wins}</td>
                  <td>${o.losses}</td>
                  <td><span class="badge ${cls === 'h2h-win' ? 'win' : cls === 'h2h-loss' ? 'loss' : ''}">${pct}%</span></td>
                  <td>${o.pf.toLocaleString()}</td>
                  <td>${o.pa.toLocaleString()}</td>
                  <td class="${diff >= 0 ? 'h2h-win' : 'h2h-loss'}">${diff >= 0 ? '+' : ''}${diff}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </section>
    `;
  },

  // ── Rivalry card (all-managers view) ────────────────────────

  renderRivalryCard(uid, userIds, career, matrix) {
    const name = this.cleanName(career[uid]?.name || uid);
    const { rival, nemesis, punching, nemesisMargin, punchingMargin } = this.getRivalryData(uid, userIds, matrix);
    if (!rival) return '';

    const row = (icon, label, oppUid, h, colorClass) => {
      const oppName = this.cleanName(career[oppUid]?.name || oppUid);
      const total   = h.wins + h.losses;
      const pct     = total ? ((h.wins / total) * 100).toFixed(0) : 0;
      return `
        <div class="rc-row ${colorClass}">
          <span class="rc-icon">${icon}</span>
          <span class="rc-label">${label}</span>
          <span class="rc-team">${oppName}</span>
          <span class="rc-record">${h.wins}–${h.losses}</span>
        </div>`;
    };

    const rH = matrix[uid][rival];
    const nH = nemesis  ? matrix[uid][nemesis]  : null;
    const pH = punching ? matrix[uid][punching] : null;

    return `
      <div class="rivalry-card-v2" onclick="RivalriesTab.filterByManager('${uid}')">
        <div class="rc-name">${name}</div>
        <div class="rc-rows">
          ${rival   ? row('⚔️','Rival',       rival,   rH, 'rc-rival')   : ''}
          ${nemesis && nemesis !== rival && nemesisMargin < 0
            ? row('😤','Nemesis',    nemesis, nH, 'rc-nemesis') : ''}
          ${punching && punching !== nemesis && punchingMargin > 0
            ? row('💪','Punching Bag', punching, pH, 'rc-punching') : ''}
        </div>
      </div>
    `;
  },

  // ── H2H Matrix ───────────────────────────────────────────────

  renderH2HMatrix(userIds, career, matrix) {
    const sn = uid => this.shortName(uid, career);

    const header = `<tr>
      <th class="h2h-corner"></th>
      ${userIds.map(uid => `<th class="h2h-header" title="${this.cleanName(career[uid]?.name || uid)}">${sn(uid)}</th>`).join('')}
    </tr>`;

    const rows = userIds.map(a => {
      const cells = userIds.map(b => {
        if (a === b) return '<td class="h2h-self">–</td>';
        const h = matrix[a][b];
        const total = h.wins + h.losses;
        if (total === 0) return '<td class="h2h-none">–</td>';
        const cls = h.wins > h.losses ? 'h2h-win' : h.wins < h.losses ? 'h2h-loss' : 'h2h-tie';
        return `<td class="${cls}" title="${this.cleanName(career[a]?.name)} vs ${this.cleanName(career[b]?.name)}: ${h.wins}W–${h.losses}L">${h.wins}–${h.losses}</td>`;
      }).join('');
      return `<tr><td class="h2h-row-label">${sn(a)}</td>${cells}</tr>`;
    }).join('');

    return `<table class="data-table h2h-table"><thead>${header}</thead><tbody>${rows}</tbody></table>`;
  },

  // ── Lopsided records ─────────────────────────────────────────

  renderLopsided(userIds, career) {
    const pairs = [];
    const seen  = new Set();
    for (const a of userIds) {
      for (const b of userIds) {
        if (a >= b) continue;
        const key = `${a}|${b}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const h = DataStore.headToHead(a, b);
        const total = h.wins + h.losses;
        if (total < 2) continue;
        pairs.push({ a, b, wins: h.wins, losses: h.losses, total, margin: Math.abs(h.wins - h.losses) });
      }
    }
    pairs.sort((x, y) => y.margin - x.margin || y.total - x.total);

    const rows = pairs.slice(0, 10).map(p => {
      const domUid  = p.wins > p.losses ? p.a : p.b;
      const subUid  = p.wins > p.losses ? p.b : p.a;
      const wW = Math.max(p.wins, p.losses);
      const wL = Math.min(p.wins, p.losses);
      return `<tr>
        <td class="manager-name">${this.cleanName(career[domUid]?.name || domUid)}</td>
        <td class="h2h-none" style="text-align:center">vs</td>
        <td>${this.cleanName(career[subUid]?.name || subUid)}</td>
        <td><span class="badge win">${wW}–${wL}</span></td>
        <td style="color:var(--muted)">${p.total} games</td>
      </tr>`;
    }).join('');

    return `
      <table class="data-table">
        <thead><tr><th>Dominant</th><th></th><th>Dominated</th><th>Record</th><th>Games Played</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5" style="color:var(--muted)">Not enough data.</td></tr>'}</tbody>
      </table>
    `;
  },

  afterRender() {},
};
