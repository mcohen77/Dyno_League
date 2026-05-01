const DashboardTab = {
  selectedUid: null,

  // Strip emojis, skip leading "The" — same logic as rivalries
  shortName(uid) {
    const name  = DataStore.canonicalNames[uid] || uid;
    const clean = name.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}]+/gu, '').trim();
    const words = clean.split(/\s+/);
    const start = words[0]?.toLowerCase() === 'the' ? 1 : 0;
    return words[start] || clean;
  },

  render() {
    const career  = DataStore.careerStats();
    const uids    = Object.values(career).sort((a, b) => b.winPct - a.winPct).map(m => m.userId);

    const allResults    = DataStore.getAllMatchupResults();
    const withPts       = allResults.filter(r => r.pf > 0);
    const highScorer    = Object.values(career).reduce((a, b) => a.avgPf > b.avgPf ? a : b);
    const mostWins      = Object.values(career).reduce((a, b) => a.wins > b.wins ? a : b);
    const mostLosses    = Object.values(career).reduce((a, b) => a.losses > b.losses ? a : b);
    const highGame      = withPts.length ? withPts.reduce((a, b) => a.pf > b.pf ? a : b) : null;
    const highGameName  = highGame ? DataStore.rosterToManager(highGame.leagueId, highGame.rosterId) : '–';
    const lowGame       = withPts.filter(r => r.pf > 50).reduce((a, b) => a.pf < b.pf ? a : b, { pf: 9999 });
    const lowGameName   = lowGame.pf < 9999 ? DataStore.rosterToManager(lowGame.leagueId, lowGame.rosterId) : '–';

    return `
      <div class="tab-content" id="dashboard">

        <section class="section">
          <h3 class="section-title">Fun Facts</h3>
          <div class="fun-facts">
            <div class="fact-card"><div class="fact-icon">🏹</div><div class="fact-label">Highest Scorer</div><div class="fact-val">${highScorer.name}</div><div class="fact-sub">${highScorer.avgPf} pts/wk avg</div></div>
            <div class="fact-card"><div class="fact-icon">👑</div><div class="fact-label">Most Wins</div><div class="fact-val">${mostWins.name}</div><div class="fact-sub">${mostWins.wins} career wins</div></div>
            <div class="fact-card"><div class="fact-icon">😢</div><div class="fact-label">Most Losses</div><div class="fact-val">${mostLosses.name}</div><div class="fact-sub">${mostLosses.losses} career losses</div></div>
            <div class="fact-card"><div class="fact-icon">💥</div><div class="fact-label">Highest Score</div><div class="fact-val">${highGameName}</div><div class="fact-sub">${highGame ? highGame.pf : '–'} pts in a week</div></div>
            <div class="fact-card"><div class="fact-icon">💀</div><div class="fact-label">Lowest Score</div><div class="fact-val">${lowGameName}</div><div class="fact-sub">${lowGame.pf < 9999 ? lowGame.pf : '–'} pts in a week</div></div>
          </div>
        </section>

        <div class="dash-filter-bar">
          <label class="filter-label">Focus on manager:</label>
          <select id="dash-select" onchange="DashboardTab.filterByManager(this.value)">
            <option value="">All Managers</option>
            ${uids.map(uid => `
              <option value="${uid}" ${uid === this.selectedUid ? 'selected' : ''}>
                ${career[uid]?.name || uid}
              </option>
            `).join('')}
          </select>
        </div>

        <section class="section two-col">
          <div>
            <h3 class="section-title">Win % by Manager</h3>
            <canvas id="winpct-chart" height="240"></canvas>
          </div>
          <div>
            <h3 class="section-title">Avg Points Per Week</h3>
            <canvas id="avgpf-chart" height="240"></canvas>
          </div>
        </section>

        <section class="section">
          <h3 class="section-title">Luck Index</h3>
          <p class="section-sub">Expected wins (if you played every opponent every week) vs actual wins. Positive = lucky schedule, Negative = unlucky.</p>
          <div class="table-wrap">${this.renderLuckIndex(career)}</div>
        </section>

        <section class="section two-col">
          <div>
            <h3 class="section-title">Consistency Rating</h3>
            <p class="section-sub">Std deviation of weekly scores — lower = more consistent</p>
            <div class="table-wrap">${this.renderConsistency(career)}</div>
          </div>
          <div>
            <h3 class="section-title">Close Game Record</h3>
            <p class="section-sub">W-L in games decided by ≤15 pts vs blowouts</p>
            <div class="table-wrap">${this.renderCloseGames(career)}</div>
          </div>
        </section>

        <section class="section two-col">
          <div>
            <h3 class="section-title">Weekly High Score Rate</h3>
            <p class="section-sub">How often each manager posts the week's top score</p>
            <div class="table-wrap">${this.renderHighScoreRate(career)}</div>
          </div>
          <div>
            <h3 class="section-title">Points Against Rank</h3>
            <p class="section-sub">Total points scored against — higher = harder schedule faced</p>
            <div class="table-wrap">${this.renderPointsAgainst(career)}</div>
          </div>
        </section>

      </div>
    `;
  },

  filterByManager(uid) {
    this.selectedUid = uid || null;
    Object.values(Chart.instances || {}).forEach(c => c.destroy());
    document.getElementById('app-root').innerHTML = this.render();
    this.afterRender();
  },

  afterRender() {
    this.renderWinPctChart();
    this.renderAvgPFChart();
  },

  // ── Charts ───────────────────────────────────────────────────

  renderWinPctChart() {
    const career  = DataStore.careerStats();
    const sorted  = Object.values(career).sort((a, b) => b.winPct - a.winPct);
    const sel     = this.selectedUid;

    const colors = sorted.map(m =>
      (!sel || m.userId === sel) ? '#63b3ed' : 'rgba(99,179,237,0.2)'
    );
    const borderColors = sorted.map(m =>
      (!sel || m.userId === sel) ? '#4299e1' : 'rgba(99,179,237,0.1)'
    );

    new Chart(document.getElementById('winpct-chart'), {
      plugins: [ChartDataLabels],
      type: 'bar',
      data: {
        labels: sorted.map(m => this.shortName(m.userId)),
        datasets: [{
          label: 'Win %',
          data: sorted.map(m => m.winPct),
          backgroundColor: colors,
          borderColor: borderColors,
          borderWidth: 1,
          borderRadius: 4,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        layout: { padding: { right: 90 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.raw}%  (${sorted[ctx.dataIndex].wins}W–${sorted[ctx.dataIndex].losses}L)`,
            },
          },
          datalabels: {
            anchor: 'end',
            align: 'right',
            color: '#e2e8f0',
            font: { size: 11, weight: '600' },
            formatter: (val, ctx) => {
              const m = sorted[ctx.dataIndex];
              return `${val}%  (${m.wins}–${m.losses})`;
            },
          },
        },
        scales: {
          x: { max: 100, ticks: { callback: v => v + '%' }, grid: { color: '#2d3748' } },
          y: { grid: { display: false } },
        },
      },
    });
  },

  renderAvgPFChart() {
    const career = DataStore.careerStats();
    const sorted = Object.values(career).sort((a, b) => b.avgPf - a.avgPf);
    const sel    = this.selectedUid;

    const colors = sorted.map(m =>
      (!sel || m.userId === sel) ? '#f6ad55' : 'rgba(246,173,85,0.2)'
    );

    new Chart(document.getElementById('avgpf-chart'), {
      plugins: [ChartDataLabels],
      type: 'bar',
      data: {
        labels: sorted.map(m => this.shortName(m.userId)),
        datasets: [{
          label: 'Avg PF',
          data: sorted.map(m => m.avgPf),
          backgroundColor: colors,
          borderColor: colors,
          borderWidth: 1,
          borderRadius: 4,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        layout: { padding: { right: 55 } },
        plugins: {
          legend: { display: false },
          datalabels: {
            anchor: 'end',
            align: 'right',
            color: '#e2e8f0',
            font: { size: 11, weight: '600' },
            formatter: val => val,
          },
        },
        scales: {
          x: { title: { display: true, text: 'Avg Points' }, grid: { color: '#2d3748' } },
          y: { grid: { display: false } },
        },
      },
    });
  },

  // ── Analytics ────────────────────────────────────────────────

  // Expected wins: each week, count how many opponents you'd beat.
  // Expected wins = sum over all weeks of (games_you_beat / total_opponents_that_week).
  renderLuckIndex(career) {
    const results = DataStore.getAllMatchupResults();
    const weeklyScores = {}; // leagueId+week -> [{userId, pf}]

    for (const r of results) {
      const key = `${r.leagueId}|${r.week}`;
      if (!weeklyScores[key]) weeklyScores[key] = [];
      weeklyScores[key].push({ userId: r.userId, pf: r.pf });
    }

    const expected = {}; // uid -> expected wins
    const actual   = {}; // uid -> actual wins

    for (const r of results) {
      if (!r.userId || !DataStore.isVisible(r.userId)) continue;
      actual[r.userId] = (actual[r.userId] || 0) + (r.win ? 1 : 0);
      const key   = `${r.leagueId}|${r.week}`;
      const week  = weeklyScores[key] || [];
      const others = week.filter(e => e.userId !== r.userId && e.pf > 0);
      if (!others.length) continue;
      const beaten = others.filter(e => r.pf > e.pf).length;
      expected[r.userId] = (expected[r.userId] || 0) + (beaten / others.length);
    }

    const uids = Object.keys(career).filter(uid => DataStore.isVisible(uid));
    const rows = uids
      .map(uid => ({
        uid,
        name: career[uid]?.name || uid,
        act:  actual[uid]   || 0,
        exp:  +(expected[uid] || 0).toFixed(1),
        luck: +((actual[uid] || 0) - (expected[uid] || 0)).toFixed(1),
      }))
      .filter(r => !this.selectedUid || r.uid === this.selectedUid)
      .sort((a, b) => b.luck - a.luck);

    return `<table class="data-table">
      <thead><tr><th>Manager</th><th>Actual W</th><th>Expected W</th><th>Luck</th><th></th></tr></thead>
      <tbody>${rows.map(r => {
        const cls   = r.luck > 0 ? 'h2h-win' : r.luck < 0 ? 'h2h-loss' : '';
        const label = r.luck >  3 ? '🍀 Lucky'
                    : r.luck < -3 ? '😤 Unlucky'
                    : '😐 Fair';
        return `<tr>
          <td class="manager-name">${r.name}</td>
          <td>${r.act}</td>
          <td>${r.exp}</td>
          <td class="${cls}">${r.luck > 0 ? '+' : ''}${r.luck}</td>
          <td>${label}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
  },

  renderConsistency(career) {
    const results = DataStore.getAllMatchupResults();
    const weekly  = {}; // uid -> [pf, pf, ...]

    for (const r of results) {
      if (!r.userId || !DataStore.isVisible(r.userId) || r.pf === 0) continue;
      if (!weekly[r.userId]) weekly[r.userId] = [];
      weekly[r.userId].push(r.pf);
    }

    const stdDev = arr => {
      const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
      return Math.sqrt(arr.reduce((sum, v) => sum + (v - mean) ** 2, 0) / arr.length);
    };

    const uids = Object.keys(career).filter(uid => DataStore.isVisible(uid));
    const rows = uids
      .map(uid => ({
        uid,
        name: career[uid]?.name || uid,
        avg:  career[uid]?.avgPf || 0,
        std:  weekly[uid]?.length > 1 ? +stdDev(weekly[uid]).toFixed(1) : null,
        games: weekly[uid]?.length || 0,
      }))
      .filter(r => r.std !== null)
      .filter(r => !this.selectedUid || r.uid === this.selectedUid)
      .sort((a, b) => a.std - b.std);

    return `<table class="data-table">
      <thead><tr><th>Manager</th><th>Avg Pts</th><th>Std Dev</th><th>Style</th></tr></thead>
      <tbody>${rows.map(r => {
        const label = r.std < 18 ? '🎯 Consistent' : r.std > 28 ? '🎢 Boom/Bust' : '〰️ Moderate';
        return `<tr>
          <td class="manager-name">${r.name}</td>
          <td>${r.avg}</td>
          <td>${r.std}</td>
          <td>${label}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
  },

  renderCloseGames(career) {
    const MARGIN = 15;
    const results = DataStore.getAllMatchupResults();
    const stats   = {}; // uid -> {closeW, closeL, blowW, blowL}

    // Pair up results by week/leagueId/matchup to get margin
    const byMatch = {};
    for (const r of results) {
      const key = `${r.leagueId}|${r.week}|${[r.rosterId, r.opponentId].sort().join('|')}`;
      if (!byMatch[key]) byMatch[key] = [];
      byMatch[key].push(r);
    }

    for (const pair of Object.values(byMatch)) {
      if (pair.length !== 2) continue;
      const margin = Math.abs(pair[0].pf - pair[1].pf);
      const close  = margin <= MARGIN;
      for (const r of pair) {
        if (!r.userId || !DataStore.isVisible(r.userId)) continue;
        if (!stats[r.userId]) stats[r.userId] = { closeW: 0, closeL: 0, blowW: 0, blowL: 0 };
        const s = stats[r.userId];
        if (close) { r.win ? s.closeW++ : s.closeL++; }
        else       { r.win ? s.blowW++  : s.blowL++;  }
      }
    }

    const uids = Object.keys(career).filter(uid => DataStore.isVisible(uid) && stats[uid]);
    const rows = uids
      .map(uid => {
        const s   = stats[uid];
        const tot = s.closeW + s.closeL;
        return { uid, name: career[uid]?.name || uid, ...s, closePct: tot ? +((s.closeW / tot) * 100).toFixed(0) : 0 };
      })
      .filter(r => !this.selectedUid || r.uid === this.selectedUid)
      .sort((a, b) => b.closePct - a.closePct);

    return `<table class="data-table">
      <thead><tr><th>Manager</th><th>Close W–L</th><th>Close%</th><th>Blowout W–L</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td class="manager-name">${r.name}</td>
        <td>${r.closeW}–${r.closeL}</td>
        <td><span class="badge ${r.closePct >= 50 ? 'win' : 'loss'}">${r.closePct}%</span></td>
        <td>${r.blowW}–${r.blowL}</td>
      </tr>`).join('')}</tbody>
    </table>`;
  },

  renderHighScoreRate(career) {
    const results = DataStore.getAllMatchupResults();
    const weeklyScores = {};

    for (const r of results) {
      if (!r.userId || r.pf === 0) continue;
      const key = `${r.leagueId}|${r.week}`;
      if (!weeklyScores[key]) weeklyScores[key] = [];
      weeklyScores[key].push({ userId: r.userId, pf: r.pf });
    }

    const highScores = {}; // uid -> count of weeks with top score
    const weeks      = {}; // uid -> total weeks played

    for (const [, entries] of Object.entries(weeklyScores)) {
      if (!entries.length) continue;
      const maxPf  = Math.max(...entries.map(e => e.pf));
      const topUid = entries.find(e => e.pf === maxPf)?.userId;
      for (const e of entries) {
        if (!DataStore.isVisible(e.userId)) continue;
        weeks[e.userId] = (weeks[e.userId] || 0) + 1;
        if (e.userId === topUid) highScores[e.userId] = (highScores[e.userId] || 0) + 1;
      }
    }

    const uids = Object.keys(career).filter(uid => DataStore.isVisible(uid));
    const rows = uids
      .map(uid => ({
        uid,
        name: career[uid]?.name || uid,
        highs: highScores[uid] || 0,
        total: weeks[uid] || 0,
        rate:  weeks[uid] ? +((( highScores[uid] || 0) / weeks[uid]) * 100).toFixed(1) : 0,
      }))
      .filter(r => !this.selectedUid || r.uid === this.selectedUid)
      .sort((a, b) => b.highs - a.highs);

    return `<table class="data-table">
      <thead><tr><th>Manager</th><th>Top Scores</th><th>Weeks</th><th>Rate</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td class="manager-name">${r.name}</td>
        <td>${r.highs} ${'🏆'.repeat(Math.min(r.highs, 5))}</td>
        <td>${r.total}</td>
        <td><span class="badge">${r.rate}%</span></td>
      </tr>`).join('')}</tbody>
    </table>`;
  },

  renderPointsAgainst(career) {
    const uids = Object.keys(career).filter(uid => DataStore.isVisible(uid));
    const rows = uids
      .map(uid => ({
        uid,
        name: career[uid]?.name || uid,
        pa:   career[uid]?.pa   || 0,
        games: career[uid]?.games || 0,
        avgPa: career[uid]?.games ? +(career[uid].pa / career[uid].games).toFixed(1) : 0,
      }))
      .filter(r => !this.selectedUid || r.uid === this.selectedUid)
      .sort((a, b) => b.pa - a.pa);

    const maxPa = Math.max(...rows.map(r => r.pa));
    return `<table class="data-table">
      <thead><tr><th>Manager</th><th>Total PA</th><th>Avg PA/Wk</th><th>Schedule</th></tr></thead>
      <tbody>${rows.map(r => {
        const pct   = maxPa ? (r.pa / maxPa) : 0;
        const label = pct > 0.95 ? '😩 Brutal' : pct > 0.8 ? '😬 Hard' : pct < 0.6 ? '😌 Easy' : '😐 Average';
        return `<tr>
          <td class="manager-name">${r.name}</td>
          <td>${r.pa.toLocaleString()}</td>
          <td>${r.avgPa}</td>
          <td>${label}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
  },
};
