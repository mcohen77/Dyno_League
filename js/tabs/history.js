const HistoryTab = {
  selectedUserId: null,

  // Always use ALL seasons — history tab ignores the global year filter
  allRecords() { return DataStore.seasonalRecords(DataStore.seasons); },
  allCareer()  { return DataStore.careerStats(DataStore.seasons); },

  render() {
    const records = this.allRecords();
    const career  = this.allCareer();

    const sorted = Object.values(career).sort((a, b) => b.winPct - a.winPct);
    const users  = sorted.map(m => m.userId);

    if (!this.selectedUserId || !records[this.selectedUserId]) {
      this.selectedUserId = users[0];
    }

    return `
      <div class="tab-content" id="history">

        <section class="section">
          <h3 class="section-title">Career Leaderboard</h3>
          <div class="card-grid">
            ${sorted.map((s, i) => this.managerCard(s, i)).join('')}
          </div>
        </section>

        <section class="section">
          <h3 class="section-title">All-Time Records</h3>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Manager</th>
                  <th>W</th><th>L</th>
                  <th>Win%</th>
                  <th>Pts For</th>
                  <th>Pts Against</th>
                  <th>Avg PF/Wk</th>
                </tr>
              </thead>
              <tbody>
                ${sorted.map(s => `
                  <tr>
                    <td class="manager-name">${s.name}</td>
                    <td>${s.wins}</td>
                    <td>${s.losses}</td>
                    <td><span class="badge">${s.winPct}%</span></td>
                    <td>${s.pf.toLocaleString()}</td>
                    <td>${s.pa.toLocaleString()}</td>
                    <td>${s.avgPf}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </section>

        <section class="section">
          <h3 class="section-title">Season-by-Season Records</h3>
          <div class="manager-selector">
            ${users.map(uid => {
              const name = DataStore.canonicalNames[uid] || uid;
              return `
                <button class="mgr-btn ${uid === this.selectedUserId ? 'active' : ''}"
                        onclick="HistoryTab.selectManager('${uid}')">
                  ${name}
                </button>
              `;
            }).join('')}
          </div>
          <div id="history-detail">
            ${this.renderManagerHistory(records, career, this.selectedUserId)}
          </div>
        </section>

        <section class="section">
          <h3 class="section-title">Season Champions &amp; Finalists</h3>
          <div class="table-wrap">
            ${this.renderChampions()}
          </div>
        </section>
      </div>
    `;
  },

  managerCard(s, rank) {
    const medals = ['🥇', '🥈', '🥉'];
    const medal = medals[rank] || `#${rank + 1}`;
    return `
      <div class="manager-card">
        <div class="card-rank">${medal}</div>
        <div class="card-name">${s.name}</div>
        <div class="card-stats">
          <div class="stat"><span class="stat-val">${s.winPct}%</span><span class="stat-lbl">Win Rate</span></div>
          <div class="stat"><span class="stat-val">${s.wins}-${s.losses}</span><span class="stat-lbl">Record</span></div>
          <div class="stat"><span class="stat-val">${s.avgPf}</span><span class="stat-lbl">Avg Pts</span></div>
        </div>
      </div>
    `;
  },

  selectManager(uid) {
    this.selectedUserId = uid;
    const records = this.allRecords();
    const career  = this.allCareer();
    document.querySelectorAll('.mgr-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('onclick').includes(`'${uid}'`));
    });
    document.getElementById('history-detail').innerHTML =
      this.renderManagerHistory(records, career, uid);
  },

  renderManagerHistory(records, career, uid) {
    const seasons = [...(records[uid] || [])].reverse();
    const c    = career[uid] || {};
    const name = DataStore.canonicalNames[uid] || uid;

    return `
      <div class="history-header">
        <div class="history-career">
          <strong>${name}</strong> &nbsp;|&nbsp;
          Career: ${c.wins ?? 0}W – ${c.losses ?? 0}L &nbsp;|&nbsp;
          Win%: ${c.winPct ?? 0}% &nbsp;|&nbsp;
          Avg Pts: ${c.avgPf ?? 0}
        </div>
      </div>
      <div class="table-wrap" style="margin-top:1rem">
        <table class="data-table">
          <thead>
            <tr><th>Season</th><th>W</th><th>L</th><th>Win%</th><th>PF</th><th>PA</th><th>Rank</th></tr>
          </thead>
          <tbody>
            ${seasons.map(s => `
              <tr>
                <td>${s.season}</td>
                <td>${s.wins}</td><td>${s.losses}</td>
                <td>${s.wins + s.losses > 0 ? ((s.wins/(s.wins+s.losses))*100).toFixed(1) : 0}%</td>
                <td>${s.pf.toLocaleString()}</td>
                <td>${s.pa.toLocaleString()}</td>
                <td>${s.rank} / ${s.totalTeams}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  renderChampions() {
    const seasonList = [...DataStore.seasons].reverse();
    const rows = seasonList.map(season => {
      const override = SEASON_OVERRIDES[season.season];
      if (override?.type === 'tie') {
        const names = override.champions.map(n => `${n} 🏆`).join(' &amp; ');
        return `<tr><td>${season.season}</td><td class="champ-name" colspan="2">${names} <span class="tie-badge">TIE</span></td></tr>`;
      }
      const lid  = season.league_id;
      const game = DataStore.getChampionshipGame(lid);
      if (!game) return null;
      const champion = game.w != null ? DataStore.rosterToManager(lid, game.w) : '–';
      const runnerUp = game.l != null ? DataStore.rosterToManager(lid, game.l) : '–';
      if (champion === '–' && runnerUp === '–') return null;
      return `<tr>
        <td>${season.season}</td>
        <td class="champ-name">${champion !== '–' ? champion + ' 🏆' : '–'}</td>
        <td>${runnerUp}</td>
      </tr>`;
    }).filter(Boolean);

    if (!rows.length) return '<p style="color:var(--muted)">No bracket data available.</p>';
    return `
      <table class="data-table">
        <thead><tr><th>Season</th><th>Champion</th><th>Runner-Up</th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    `;
  },

  afterRender() {},
};
