const OverviewTab = {
  render() {
    return `
      <div class="tab-content" id="overview">
        <section class="section">
          <h3 class="section-title">League Constitution</h3>
          <p class="section-sub">Year 6 rules — last updated 2024 season. Click any section to expand.</p>
          <div class="constitution-accordion">
            ${this.constitutionSections().map((sec, i) => `
              <div class="ca-item" id="ca-item-${i}">
                <button class="ca-header" onclick="OverviewTab.toggleSection(${i})">
                  <span class="ca-icon">${sec.icon}</span>
                  <span class="ca-title">${sec.title}</span>
                  <span class="ca-chevron" id="ca-chev-${i}">›</span>
                </button>
                <div class="ca-body" id="ca-body-${i}" style="display:none">
                  ${sec.content}
                </div>
              </div>
            `).join('')}
          </div>
        </section>
      </div>
    `;
  },

  toggleSection(i) {
    const body = document.getElementById(`ca-body-${i}`);
    const chev = document.getElementById(`ca-chev-${i}`);
    const item = document.getElementById(`ca-item-${i}`);
    const open = body.style.display !== 'none';
    body.style.display = open ? 'none' : 'block';
    chev.style.transform = open ? '' : 'rotate(90deg)';
    item.classList.toggle('ca-open', !open);
  },

  constitutionSections() {
    return [
      {
        icon: '📋',
        title: 'Overview',
        content: `
          <ul class="ca-list">
            <li><strong>10 teams</strong>, Dynasty format on the <strong>Sleeper App</strong></li>
            <li><strong>.5 PPR</strong>, <strong>4 pts per QB TD</strong></li>
            <li>24 active roster spots + 5 Taxi Squad + 4 IR</li>
            <li>No kickers — eliminated!</li>
            <li>Buy-in: <strong>$135/team</strong> · Total pot: <strong>$1,350</strong></li>
          </ul>
        `,
      },
      {
        icon: '💰',
        title: "Let's Talk Money",
        content: `
          <ul class="ca-list">
            <li><span class="ca-prize ca-gold">1st place — $600</span></li>
            <li><span class="ca-prize ca-silver">2nd place — $300</span></li>
            <li><span class="ca-prize ca-bronze">3rd place — $100</span></li>
            <li>Most Points (regular season) — $60</li>
            <li>Best Regular Season Record — $60</li>
            <li>Weekly High Score (each week) — $10/week</li>
            <li class="ca-note">Last $90 goes toward the trophy and rolls into next year's prizes.</li>
          </ul>
        `,
      },
      {
        icon: '📝',
        title: 'Rosters',
        content: `
          <p class="ca-p"><strong>Starting lineup:</strong> 1 QB · 2 RB · 2 WR · 1 TE · 2 FLEX · 1 DEF</p>
          <p class="ca-p"><strong>Roster maximums per position:</strong></p>
          <ul class="ca-list">
            <li>QB — max 4</li>
            <li>WR / RB — no cap</li>
            <li>TE — max 4</li>
            <li>DEF — max 3</li>
          </ul>
          <p class="ca-p ca-note">IR spots are for injured players only. Suspended or holding-out players are not eligible. An invalid player in IR locks your roster until resolved.</p>
        `,
      },
      {
        icon: '🚌',
        title: 'Taxi Squad',
        content: `
          <ul class="ca-list">
            <li><strong>5 taxi squad spots</strong> — do not need to be filled</li>
            <li>Eligible players: <strong>rookies and sophomores only</strong></li>
            <li>Max <strong>2 years</strong> on taxi squad — 3rd-year players must come up</li>
            <li>Taxi squad must be set <strong>before Sept. 1st</strong></li>
            <li>During the season you can pull a player off taxi squad, but cannot return them until the offseason</li>
            <li>Trades can move players directly between taxi squads without losing eligibility</li>
          </ul>
        `,
      },
      {
        icon: '🎯',
        title: 'Draft',
        content: `
          <p class="ca-p"><strong>Picks 1–4 — Toilet Bowl Lottery:</strong></p>
          <ul class="ca-list">
            <li>4 teams that miss playoffs enter a toilet bowl tournament</li>
            <li>Winner gets 4 entries · 2nd gets 3 · 3rd gets 2 · Last gets 1</li>
            <li>Lottery determines first four picks from those entries</li>
          </ul>
          <p class="ca-p"><strong>Picks 5–10 — Playoff outcome (inverse):</strong></p>
          <ul class="ca-list">
            <li>Championship winner — pick 10 · Runner-up — pick 9</li>
            <li>3rd/4th place game — picks 8 & 7</li>
            <li>5th/6th place game — <em>winner</em> gets pick 5, loser gets pick 6 (to add stakes)</li>
          </ul>
          <p class="ca-p"><strong>Format:</strong> NFL-style draft (not snake). Slow draft — <strong>8 hours per pick</strong>. Miss your clock and the commissioner picks for you.</p>
        `,
      },
      {
        icon: '🏆',
        title: 'Playoffs',
        content: `
          <ul class="ca-list">
            <li><strong>6 teams</strong> make playoffs</li>
            <li>Playoff weeks: <strong>15–17</strong></li>
            <li>Top 2 seeds receive a Week 15 bye</li>
            <li><strong>Tiebreaker 1:</strong> Total points scored in regular season</li>
            <li><strong>Tiebreaker 2:</strong> Head-to-head record</li>
            <li><strong>In-game tie:</strong> Highest individual scoring player on the team wins</li>
          </ul>
        `,
      },
      {
        icon: '🔄',
        title: 'Trades',
        content: `
          <ul class="ca-list">
            <li>Trades are encouraged</li>
            <li><strong>Trade deadline:</strong> Week 11, Sunday 1:00 PM EST</li>
            <li>Trades process <strong>instantly</strong> — no waiting period</li>
            <li>Vetoes only for clear collusion with a league-wide majority vote</li>
          </ul>
        `,
      },
      {
        icon: '📡',
        title: 'Waiver Wire (FAAB)',
        content: `
          <ul class="ca-list">
            <li>FAAB bidding system — highest bid wins the player</li>
            <li><strong>$1,000 FAAB</strong> per team, resets <strong>May 1st</strong> each year</li>
            <li>FAAB does <strong>not</strong> carry over between seasons</li>
            <li>Waivers run <strong>Tuesday nights</strong> during the season</li>
            <li>Offseason waivers run once daily at <strong>1:00 PM EST</strong></li>
          </ul>
        `,
      },
      {
        icon: '📊',
        title: 'Scoring',
        content: `
          <ul class="ca-list">
            <li><strong>.5 PPR</strong> (half a point per reception)</li>
            <li>Passing TD — <strong>4 pts</strong></li>
            <li>Rushing TD — <strong>6 pts</strong></li>
            <li>Receiving TD — <strong>6 pts</strong></li>
            <li>See league settings in Sleeper for full DEF and misc scoring details</li>
          </ul>
        `,
      },
      {
        icon: '⚾',
        title: 'Not Setting Your Lineup',
        content: `
          <p class="ca-p">Three strikes and you're out — literally.</p>
          <ul class="ca-list">
            <li>Fail to set your lineup <strong>3 times</strong> and you are removed from the league</li>
          </ul>
        `,
      },
      {
        icon: '❄️',
        title: 'Offseason',
        content: `
          <ul class="ca-list">
            <li>Rosters, trades, and waivers <strong>lock after playoffs</strong></li>
            <li>Everything reopens <strong>May 1st</strong></li>
          </ul>
        `,
      },
      {
        icon: '💬',
        title: 'Suggestion Box',
        content: `
          <ul class="ca-list">
            <li>Submit suggestions via the Suggestion Box tab in this dashboard</li>
            <li>If the commissioner deems it vote-worthy, it goes to a league-wide off-season vote</li>
            <li>Majority rules — ties go to the following year's box</li>
            <li>Urgent loopholes or oversights trigger an immediate league-wide vote</li>
          </ul>
        `,
      },
    ];
  },

  afterRender() {},
};
