const PlayoffsTab = {
  render() {
    const seasons = [...DataStore.seasons].reverse(); // most recent first

    return `
      <div class="tab-content" id="playoffs">

        <section class="section">
          <h3 class="section-title">Season-by-Season Results</h3>
          <div class="bracket-seasons">
            ${seasons.map(s => this.renderSeasonCard(s)).join('')}
          </div>
        </section>

        <section class="section">
          <h3 class="section-title">Playoff Appearances &amp; Hardware</h3>
          <div class="table-wrap">
            ${this.renderAppearances()}
          </div>
        </section>

        <section class="section">
          <h3 class="section-title">Post Season Win Rate</h3>
          <p class="section-sub">Win/loss record exclusively in playoff-week matchups across all seasons</p>
          <div class="table-wrap">
            ${this.renderPlayoffRecord()}
          </div>
        </section>

        <section class="section two-col">
          <div>
            <h3 class="section-title">Post Season Scoring vs Regular Season</h3>
            <p class="section-sub">Who scores more when it matters?</p>
            <div class="table-wrap">
              ${this.renderPlayoffScoring()}
            </div>
          </div>
          <div>
            <h3 class="section-title">Seed Success Rate</h3>
            <p class="section-sub">How often does each seeding position win the championship?</p>
            <div class="table-wrap">
              ${this.renderSeedSuccess()}
            </div>
          </div>
        </section>


      </div>
    `;
  },

  // ── Season card ──────────────────────────────────────────────

  // Strip trailing trophy/medal emojis from a manager's display name
  cleanName(name) {
    if (!name) return '–';
    return name.replace(/[\u{1F3C6}\u{1F947}\u{1F948}\u{1F949}\s]+$/gu, '').trim();
  },

  renderSeasonCard(season) {
    const lid      = season.league_id;
    const override = SEASON_OVERRIDES[season.season];

    let resultHtml;
    if (override?.type === 'tie') {
      resultHtml = `<div class="bracket-result">
        ${override.champions.map(n => `
          <span class="place-row">
            <span class="place-label place-1">1st</span>
            <span class="place-name">${this.cleanName(n)}</span>
          </span>
        `).join('')}
        <span class="tie-badge">TIE</span>
      </div>`;
    } else {
      const game  = DataStore.getChampionshipGame(lid);
      const third = DataStore.getThirdPlaceGame(lid);
      if (game && (game.w != null || game.l != null)) {
        const champ    = game.w != null ? this.cleanName(DataStore.rosterToManager(lid, game.w)) : null;
        const runnerUp = game.l != null ? this.cleanName(DataStore.rosterToManager(lid, game.l)) : null;
        const thirdPl  = third?.w != null ? this.cleanName(DataStore.rosterToManager(lid, third.w)) : null;
        resultHtml = `<div class="bracket-result">
          ${champ    ? `<span class="place-row"><span class="place-label place-1">1st</span><span class="place-name">${champ}</span></span>` : ''}
          ${runnerUp ? `<span class="place-row"><span class="place-label place-2">2nd</span><span class="place-name">${runnerUp}</span></span>` : ''}
          ${thirdPl  ? `<span class="place-row"><span class="place-label place-3">3rd</span><span class="place-name">${thirdPl}</span></span>` : ''}
        </div>`;
      } else {
        resultHtml = `<div class="bracket-result" style="color:var(--muted)">Season in progress</div>`;
      }
    }

    return `
      <div class="bracket-season-card">
        <div class="bracket-season-year">${season.season}</div>
        ${resultHtml}
      </div>
    `;
  },

  // ── Appearance table ─────────────────────────────────────────

  renderAppearances() {
    const rec = this._buildAppearanceRecords();
    const totalSeasons = DataStore.filteredSeasons().length;
    const sorted = Object.values(rec).sort((a, b) =>
      b.championships - a.championships || b.appearances - a.appearances
    );
    const rows = sorted.map(s => `<tr>
      <td class="manager-name">${s.name}</td>
      <td>${s.championships > 0 ? '🏆'.repeat(Math.min(s.championships, 5)) + ' ' + s.championships : '0'}</td>
      <td>${s.runnerUps    > 0 ? '🥈'.repeat(Math.min(s.runnerUps, 5))    + ' ' + s.runnerUps    : '0'}</td>
      <td>${s.appearances}</td>
      <td>${totalSeasons ? ((s.appearances / totalSeasons) * 100).toFixed(0) + '%' : '–'}</td>
    </tr>`).join('');

    return `<table class="data-table">
      <thead><tr><th>Manager</th><th>Championships</th><th>Runner-Up</th><th>Appearances</th><th>App Rate</th></tr></thead>
      <tbody>${rows || noData(5)}</tbody>
    </table>`;
  },

  // ── Playoff Win Rate ─────────────────────────────────────────

  renderPlayoffRecord() {
    const stats = {}; // uid -> {wins, losses, pf, games}
    for (const season of DataStore.seasons) {
      const results = DataStore.getPlayoffMatchupResults(season.league_id);
      for (const r of results) {
        if (!r.userId || !DataStore.isVisible(r.userId)) continue;
        if (!stats[r.userId]) stats[r.userId] = { wins: 0, losses: 0, pf: 0, games: 0 };
        const s = stats[r.userId];
        if (r.win) s.wins++; else s.losses++;
        s.pf += r.pf;
        s.games++;
      }
    }
    const sorted = Object.entries(stats)
      .map(([uid, s]) => ({
        name: DataStore.canonicalNames[uid] || uid,
        ...s,
        winPct: s.games ? +((s.wins / s.games) * 100).toFixed(1) : 0,
        avgPf:  s.games ? +(s.pf / s.games).toFixed(1) : 0,
      }))
      .sort((a, b) => b.winPct - a.winPct);

    const rows = sorted.map(s => `<tr>
      <td class="manager-name">${s.name}</td>
      <td>${s.wins}</td><td>${s.losses}</td>
      <td><span class="badge ${s.winPct >= 50 ? 'win' : 'loss'}">${s.winPct}%</span></td>
      <td>${s.avgPf}</td>
    </tr>`).join('');

    return `<table class="data-table">
      <thead><tr><th>Manager</th><th>PW</th><th>PL</th><th>Win%</th><th>Avg Pts</th></tr></thead>
      <tbody>${rows || noData(5)}</tbody>
    </table>`;
  },

  // ── Playoff Scoring vs Regular Season ────────────────────────

  renderPlayoffScoring() {
    // Regular season avg PF per manager
    const rsStats = DataStore.careerStats(DataStore.seasons); // uid -> {avgPf}

    // Playoff avg PF per manager
    const poStats = {};
    for (const season of DataStore.seasons) {
      const results = DataStore.getPlayoffMatchupResults(season.league_id);
      for (const r of results) {
        if (!r.userId || !DataStore.isVisible(r.userId)) continue;
        if (!poStats[r.userId]) poStats[r.userId] = { pf: 0, games: 0 };
        poStats[r.userId].pf += r.pf;
        poStats[r.userId].games++;
      }
    }

    const managers = Object.keys(rsStats).filter(uid => poStats[uid]);
    const rows = managers.map(uid => {
      const rsAvg = rsStats[uid]?.avgPf || 0;
      const poAvg = poStats[uid] ? +(poStats[uid].pf / poStats[uid].games).toFixed(1) : 0;
      const diff  = +(poAvg - rsAvg).toFixed(1);
      return { uid, name: DataStore.canonicalNames[uid] || uid, rsAvg, poAvg, diff };
    }).sort((a, b) => b.diff - a.diff);

    const rowHtml = rows.map(r => {
      const cls = r.diff > 0 ? 'h2h-win' : r.diff < 0 ? 'h2h-loss' : '';
      const arrow = r.diff > 2 ? '⬆️' : r.diff < -2 ? '⬇️' : '➡️';
      return `<tr>
        <td class="manager-name">${r.name}</td>
        <td>${r.rsAvg}</td>
        <td>${r.poAvg}</td>
        <td class="${cls}">${r.diff > 0 ? '+' : ''}${r.diff} ${arrow}</td>
      </tr>`;
    }).join('');

    return `<table class="data-table">
      <thead><tr><th>Manager</th><th>RS Avg</th><th>PO Avg</th><th>Diff</th></tr></thead>
      <tbody>${rowHtml || noData(4)}</tbody>
    </table>`;
  },

  // ── Seed Success Rate ─────────────────────────────────────────

  renderSeedSuccess() {
    // For each season, rank playoff teams by their regular-season record → assign seed
    // Then track which seed won
    const seedWins   = {}; // seed# -> wins
    const seedAppear = {}; // seed# -> appearances

    for (const season of DataStore.seasons) {
      const lid      = season.league_id;
      const override = SEASON_OVERRIDES[season.season];
      const field    = this.getPlayoffFieldUids(lid);
      if (field.length === 0) continue;

      // Get regular season records for this season to assign seeds
      const rsRec = DataStore.seasonalRecords([season]);
      const seeded = field
        .map(uid => ({ uid, rank: (rsRec[uid]?.[0]?.rank ?? 99) }))
        .sort((a, b) => a.rank - b.rank);

      seeded.forEach((entry, i) => {
        const seed = i + 1;
        seedAppear[seed] = (seedAppear[seed] || 0) + 1;
      });

      // Who won?
      let champUid = null;
      if (override?.type === 'tie') {
        // Both win — count both
        for (const champName of override.champions) {
          champUid = Object.entries(DataStore.canonicalNames).find(([, n]) => n === champName)?.[0];
          if (champUid) {
            const seedEntry = seeded.find(e => e.uid === champUid);
            if (seedEntry) {
              const seed = seeded.indexOf(seedEntry) + 1;
              seedWins[seed] = (seedWins[seed] || 0) + 0.5;
            }
          }
        }
      } else {
        const game = DataStore.getChampionshipGame(lid);
        if (game?.w != null) {
          champUid = DataStore.rosterOwnerId(lid, game.w);
          const seedEntry = seeded.find(e => e.uid === champUid);
          if (seedEntry) {
            const seed = seeded.indexOf(seedEntry) + 1;
            seedWins[seed] = (seedWins[seed] || 0) + 1;
          }
        }
      }
    }

    const seeds = Object.keys(seedAppear).map(Number).sort((a, b) => a - b);
    const rows = seeds.map(seed => {
      const wins   = seedWins[seed] || 0;
      const appear = seedAppear[seed] || 0;
      const pct    = appear ? ((wins / appear) * 100).toFixed(0) : '0';
      const bar    = '█'.repeat(Math.round(wins / appear * 10));
      return `<tr>
        <td><strong>#${seed} seed</strong></td>
        <td>${wins}</td>
        <td>${appear}</td>
        <td><span class="badge ${wins > 0 ? 'win' : ''}">${pct}%</span></td>
      </tr>`;
    }).join('');

    return `<table class="data-table">
      <thead><tr><th>Seed</th><th>Titles</th><th>Seasons</th><th>Win%</th></tr></thead>
      <tbody>${rows || noData(4)}</tbody>
    </table>`;
  },


  // ── Shared helpers ───────────────────────────────────────────

  getPlayoffField(leagueId) {
    return this.getPlayoffFieldUids(leagueId)
      .map(uid => DataStore.canonicalNames[uid] || uid);
  },

  getPlayoffFieldUids(leagueId) {
    const sd = DataStore.seasonData[leagueId];
    if (!sd?.bracket) return [];
    const rIds = new Set();
    for (const m of sd.bracket) {
      if (m.t1) rIds.add(m.t1);
      if (m.t2) rIds.add(m.t2);
    }
    return [...rIds].map(rid => DataStore.rosterOwnerId(leagueId, rid)).filter(Boolean);
  },

  _buildAppearanceRecords() {
    const rec    = {};
    const ensure = (uid, name) => {
      if (!rec[uid]) rec[uid] = { name: name || DataStore.canonicalNames[uid] || uid, appearances: 0, championships: 0, runnerUps: 0 };
    };
    for (const season of DataStore.filteredSeasons()) {
      const lid  = season.league_id;
      for (const uid of this.getPlayoffFieldUids(lid)) {
        if (!DataStore.isVisible(uid)) continue;
        ensure(uid);
        rec[uid].appearances++;
      }
      const override = SEASON_OVERRIDES[season.season];
      if (override?.type === 'tie') {
        for (const champName of override.champions) {
          const uid = Object.entries(DataStore.canonicalNames).find(([, n]) => n === champName)?.[0];
          if (uid && DataStore.isVisible(uid)) { ensure(uid, champName); rec[uid].championships++; }
        }
      } else {
        const game = DataStore.getChampionshipGame(lid);
        if (game?.w != null) {
          const uid = DataStore.rosterOwnerId(lid, game.w);
          if (uid && DataStore.isVisible(uid)) { ensure(uid); rec[uid].championships++; }
        }
        if (game?.l != null) {
          const uid = DataStore.rosterOwnerId(lid, game.l);
          if (uid && DataStore.isVisible(uid)) { ensure(uid); rec[uid].runnerUps++; }
        }
      }
    }
    return rec;
  },

  afterRender() {},
};

function noData(cols) {
  return `<tr><td colspan="${cols}" style="color:var(--muted);text-align:center">Not enough data yet.</td></tr>`;
}
