const RookieDraftTab = {
  selectedDraftId: null,

  render() {
    if (!DataStore.draftsLoaded) {
      this._load();
      return this._loadingHtml('Loading draft history...');
    }
    return this._renderLoaded();
  },

  async _load() {
    const msg = id => { const el = document.getElementById('tab-load-msg'); if (el) el.textContent = id; };
    await DataStore.loadDrafts(msg);
    document.getElementById('app-root').innerHTML = this._renderLoaded();
  },

  _loadingHtml(text) {
    return `<div class="tab-content">
      <div class="tab-loading">
        <div class="spinner"></div>
        <div id="tab-load-msg" class="tab-load-msg">${text}</div>
      </div>
    </div>`;
  },

  _renderLoaded() {
    const drafts = DataStore.allDrafts;
    if (!drafts.length) {
      return `<div class="tab-content"><p style="color:var(--muted);padding:2rem">No draft data found.</p></div>`;
    }

    // Sort: season descending, then by start_time descending within the same season
    // so the most recent draft in a season comes first
    const sorted = [...drafts].sort((a, b) => {
      const sd = b.season.localeCompare(a.season);
      if (sd !== 0) return sd;
      return (b.draft.start_time || 0) - (a.draft.start_time || 0);
    });

    // Keep only the most recent draft per season (drops earlier 2020 startup/test drafts)
    const seenSeasons = new Set();
    const displayDrafts = sorted.filter(d => {
      if (seenSeasons.has(d.season)) return false;
      seenSeasons.add(d.season);
      return true;
    });

    if (!this.selectedDraftId || !displayDrafts.find(d => d.draft.draft_id === this.selectedDraftId)) {
      this.selectedDraftId = displayDrafts[0].draft.draft_id;
    }

    const current = displayDrafts.find(d => d.draft.draft_id === this.selectedDraftId);

    // Career summary uses only the canonical (most recent) draft per season
    const careerPicks = this._buildCareerSummary(displayDrafts);

    return `
      <div class="tab-content" id="rookiedraft">

        <section class="section">
          <h3 class="section-title">Career Draft Summary</h3>
          <div class="table-wrap">
            ${this._renderCareerSummary(careerPicks)}
          </div>
        </section>

        <section class="section">
          <h3 class="section-title">Draft Board</h3>
          <div class="draft-season-tabs">
            ${displayDrafts.map(d => {
              const id = d.draft.draft_id;
              return `<button class="draft-season-btn ${id === this.selectedDraftId ? 'active' : ''}"
                      onclick="RookieDraftTab.selectDraft('${id}')">
                ${d.season}
              </button>`;
            }).join('')}
          </div>
          ${current ? this._renderDraftBoard(current) : '<p style="color:var(--muted)">No data for this season.</p>'}
        </section>

        <section class="section">
          <h3 class="section-title">Position Breakdown by Manager</h3>
          <div class="table-wrap">
            ${this._renderPositionBreakdown(displayDrafts)}
          </div>
        </section>

      </div>
    `;
  },

  selectDraft(draftId) {
    this.selectedDraftId = draftId;
    document.getElementById('app-root').innerHTML = this._renderLoaded();
  },

  _renderDraftBoard(draftData) {
    const { draft, picks, season, leagueId } = draftData;
    if (!picks.length) return '<p style="color:var(--muted)">No picks recorded for this draft.</p>';

    // Group by round
    const rounds = {};
    for (const pick of picks) {
      if (!rounds[pick.round]) rounds[pick.round] = [];
      rounds[pick.round].push(pick);
    }

    const totalRounds = Math.max(...picks.map(p => p.round));

    // For each round, sort by pick_no
    const roundNums = Array.from({ length: totalRounds }, (_, i) => i + 1);

    return `
      <div class="draft-meta">
        <span>${season} Rookie Draft</span>
        <span>${picks.length} picks · ${totalRounds} rounds</span>
        <span>${draft.type === 'snake' ? 'Snake' : 'Linear'} order</span>
      </div>
      <div class="draft-board-wrap">
        <table class="draft-board">
          <thead>
            <tr>
              <th class="round-col">Rd</th>
              ${(rounds[1] || []).sort((a,b) => a.pick_no - b.pick_no).map((p, i) => {
                const uid = DataStore.rosterOwnerId(leagueId, p.roster_id);
                return `<th class="pick-col" title="${DataStore.canonicalNames[uid] || ''}">#${i+1}</th>`;
              }).join('')}
            </tr>
          </thead>
          <tbody>
            ${roundNums.map(rnd => {
              const roundPicks = (rounds[rnd] || []).sort((a, b) => a.pick_no - b.pick_no);
              return `<tr>
                <td class="round-label">${rnd}</td>
                ${roundPicks.map(pick => {
                  const uid  = DataStore.rosterOwnerId(leagueId, pick.roster_id);
                  const name = pick.metadata?.first_name
                    ? `${pick.metadata.first_name} ${pick.metadata.last_name}`
                    : '–';
                  const pos  = pick.metadata?.position || '?';
                  const nflTeam = pick.metadata?.team || '';
                  const mgr  = uid ? (DataStore.canonicalNames[uid] || uid) : '?';
                  return `<td class="draft-pick-cell">
                    <div class="dp-player">
                      <span class="pos-badge pos-${pos.toLowerCase()}">${pos}</span>
                      <span class="dp-name">${name}</span>
                    </div>
                    <div class="dp-meta" title="${nflTeam ? nflTeam + ' · ' : ''}${mgr}">${nflTeam ? nflTeam + ' · ' : ''}<span class="dp-mgr">${mgr}</span></div>
                  </td>`;
                }).join('')}
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  _buildCareerSummary(drafts) {
    // uid -> { picks: [{season, round, playerName, pos}] }
    const summary = {};
    for (const { picks, season, leagueId } of drafts) {
      for (const pick of picks) {
        const uid = DataStore.rosterOwnerId(leagueId, pick.roster_id);
        if (!uid || !DataStore.isVisible(uid)) continue;
        if (!summary[uid]) summary[uid] = { picks: [] };
        const name = pick.metadata?.first_name
          ? `${pick.metadata.first_name} ${pick.metadata.last_name}`
          : '–';
        summary[uid].picks.push({
          season,
          round: pick.round,
          pickNo: pick.pick_no,
          playerName: name,
          pos: pick.metadata?.position || '?',
          nflTeam: pick.metadata?.team || '',
        });
      }
    }
    return summary;
  },

  _renderCareerSummary(summary) {
    const rows = Object.entries(summary)
      .map(([uid, data]) => ({
        uid,
        name: DataStore.canonicalNames[uid] || uid,
        total: data.picks.length,
        firstRound: data.picks.filter(p => p.round === 1).length,
        positions: data.picks.reduce((acc, p) => {
          acc[p.pos] = (acc[p.pos] || 0) + 1;
          return acc;
        }, {}),
      }))
      .sort((a, b) => b.total - a.total);

    const allPos = ['QB','RB','WR','TE','K','DEF'];

    return `<table class="data-table">
      <thead>
        <tr>
          <th>Manager</th>
          <th>Total Picks</th>
          <th>1st Rd Picks</th>
          ${allPos.map(p => `<th>${p}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `<tr>
          <td class="manager-name">${r.name}</td>
          <td>${r.total}</td>
          <td>${r.firstRound > 0 ? `<span class="badge win">${r.firstRound}</span>` : '–'}</td>
          ${allPos.map(p => `<td>${r.positions[p] || '–'}</td>`).join('')}
        </tr>`).join('')}
      </tbody>
    </table>`;
  },

  _renderPositionBreakdown(drafts) {
    // Season → position counts across all managers
    const bySeasonPos = {};
    for (const { picks, season, leagueId } of drafts) {
      if (!bySeasonPos[season]) bySeasonPos[season] = {};
      for (const pick of picks) {
        const pos = pick.metadata?.position || '?';
        bySeasonPos[season][pos] = (bySeasonPos[season][pos] || 0) + 1;
      }
    }
    const seasons = Object.keys(bySeasonPos).sort().reverse();
    const allPos = ['QB','RB','WR','TE','K'];

    return `<table class="data-table">
      <thead><tr><th>Season</th>${allPos.map(p=>`<th>${p}</th>`).join('')}<th>Total</th></tr></thead>
      <tbody>
        ${seasons.map(s => {
          const d = bySeasonPos[s];
          const total = Object.values(d).reduce((a,b)=>a+b,0);
          return `<tr>
            <td><strong>${s}</strong></td>
            ${allPos.map(p => `<td>${d[p] || '–'}</td>`).join('')}
            <td>${total}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
  },

  afterRender() {},
};
