const TradesTab = {
  filterUid:      null,
  filterSeason:   null,
  showFormer:     false,

  render() {
    if (!DataStore.tradesLoaded || !DataStore.draftsLoaded) {
      this._load();
      return this._loadingHtml('Loading player database and trade history...');
    }
    return this._renderLoaded();
  },

  async _load() {
    const msg = text => { const el = document.getElementById('tab-load-msg'); if (el) el.textContent = text; };
    // Load trades + drafts together so pick resolution works
    await DataStore.loadTrades(msg);
    await DataStore.loadDrafts(msg);
    document.getElementById('app-root').innerHTML = this._renderLoaded();
  },

  _loadingHtml(text) {
    return `<div class="tab-content">
      <div class="tab-loading">
        <div class="spinner"></div>
        <div id="tab-load-msg" class="tab-load-msg">${text}</div>
        <div style="color:var(--muted);font-size:0.8rem;margin-top:0.5rem">Loads once — player database is ~3MB</div>
      </div>
    </div>`;
  },

  // A trade is "blank" if neither side received anything meaningful
  _tradeHasContent(t) {
    const hasPlayers = Object.keys(t.adds || {}).length > 0;
    // Only count picks that have an owner_id (i.e. properly formed pick records)
    const hasPicks   = (t.draft_picks || []).some(p => p.owner_id != null);
    return hasPlayers || hasPicks;
  },

  // Does this trade involve at least one active (non-former) member?
  _tradeHasActiveMember(t) {
    for (const rid of (t.roster_ids || [])) {
      const uid = DataStore.rosterOwnerId(t.leagueId, rid);
      if (uid && !DataStore.isFormerMember(uid)) return true;
    }
    return false;
  },

  _getFiltered() {
    return DataStore.allTrades
      .filter(t => this._tradeHasContent(t))
      .filter(t => this.showFormer || this._tradeHasActiveMember(t))
      .filter(t => !this.filterSeason || t.seasonYear === this.filterSeason)
      .filter(t => {
        if (!this.filterUid) return true;
        const uids = (t.roster_ids || []).map(rid => DataStore.rosterOwnerId(t.leagueId, rid));
        return uids.includes(this.filterUid);
      })
      .slice()     // copy
      .reverse();  // most recent first
  },

  _renderLoaded() {
    const allValid = DataStore.allTrades.filter(t => this._tradeHasContent(t));
    const filtered  = this._getFiltered();
    const seasons   = [...new Set(allValid.map(t => t.seasonYear))].sort().reverse();

    // Manager dropdown — active members only (former shown if toggled)
    const dropdownUids = DataStore.allUserIds({ includeFormer: this.showFormer });

    // Summary stats — computed from filtered set (respects season filter)
    const statBase = this.filterSeason
      ? allValid.filter(t => t.seasonYear === this.filterSeason)
      : allValid;

    const tradesBySeason = {};
    const tradesByUid    = {};
    for (const t of statBase) {
      tradesBySeason[t.seasonYear] = (tradesBySeason[t.seasonYear] || 0) + 1;
      for (const rid of (t.roster_ids || [])) {
        const uid = DataStore.rosterOwnerId(t.leagueId, rid);
        if (uid && (this.showFormer || !DataStore.isFormerMember(uid))) {
          tradesByUid[uid] = (tradesByUid[uid] || 0) + 1;
        }
      }
    }

    const busiestEntry = this.filterSeason
      ? [this.filterSeason, tradesBySeason[this.filterSeason] || 0]
      : Object.entries(tradesBySeason).sort((a,b) => b[1]-a[1])[0] || ['–', 0];

    const mostActiveEntry = Object.entries(tradesByUid).sort((a,b) => b[1]-a[1])[0];
    const mostActiveName  = mostActiveEntry
      ? (DataStore.canonicalNames[mostActiveEntry[0]] || mostActiveEntry[0])
      : '–';

    // Managers who appear in the current season filter (or all if no season)
    const activeUidsInSeason = new Set();
    for (const t of allValid.filter(t => !this.filterSeason || t.seasonYear === this.filterSeason)) {
      for (const rid of (t.roster_ids || [])) {
        const uid = DataStore.rosterOwnerId(t.leagueId, rid);
        if (uid && (this.showFormer || !DataStore.isFormerMember(uid))) activeUidsInSeason.add(uid);
      }
    }
    const managerUids = [...activeUidsInSeason].sort((a, b) =>
      (DataStore.canonicalNames[a] || '').localeCompare(DataStore.canonicalNames[b] || '')
    );
    // If current filterUid isn't active in selected season, clear it
    if (this.filterUid && !activeUidsInSeason.has(this.filterUid)) this.filterUid = null;

    return `
      <div class="tab-content" id="trades">

        <div class="trade-summary-strip">
          <div class="trade-stat">
            <span class="trade-stat-val">${statBase.length}</span>
            <span class="trade-stat-lbl">${this.filterSeason ? this.filterSeason + ' ' : ''}Total Trades</span>
          </div>
          <div class="trade-stat">
            <span class="trade-stat-val">${busiestEntry[0]}</span>
            <span class="trade-stat-lbl">${this.filterSeason ? 'Trades This Season' : `Busiest Season (${busiestEntry[1]})`}</span>
          </div>
          <div class="trade-stat">
            <span class="trade-stat-val">${mostActiveName}</span>
            <span class="trade-stat-lbl">Most Active Trader${mostActiveEntry ? ` (${mostActiveEntry[1]})` : ''}</span>
          </div>
        </div>

        <div class="trade-filters">
          <div class="year-btn-group">
            <button class="year-btn ${!this.filterSeason ? 'active' : ''}"
                    onclick="TradesTab.setSeason('')">All</button>
            ${seasons.map(s => `
              <button class="year-btn ${s === this.filterSeason ? 'active' : ''}"
                      onclick="TradesTab.setSeason('${s}')">${s}</button>
            `).join('')}
          </div>

          <div class="trade-filter-right">
            <select onchange="TradesTab.setManager(this.value)">
              <option value="">All Managers</option>
              ${managerUids.map(uid => `
                <option value="${uid}" ${uid === this.filterUid ? 'selected' : ''}>
                  ${DataStore.canonicalNames[uid] || uid}
                </option>
              `).join('')}
            </select>

            <button class="former-btn ${this.showFormer ? '' : 'former-hidden'}"
                    onclick="TradesTab.toggleFormer()">
              ${this.showFormer ? 'Hide Former Members' : 'Show Former Members'}
            </button>

            <span class="trade-count-label">${filtered.length} trade${filtered.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        <div class="trades-list">
          ${filtered.length
            ? filtered.map(t => this._renderTrade(t)).join('')
            : '<p style="color:var(--muted);padding:2rem 0">No trades match the current filters.</p>'
          }
        </div>
      </div>
    `;
  },

  setSeason(val)  {
    this.filterSeason = val || null;
    // Reset manager filter when switching seasons (roster_ids change per season)
    this.filterUid = null;
    document.getElementById('app-root').innerHTML = this._renderLoaded();
  },
  setManager(val) {
    this.filterUid = val || null;
    document.getElementById('app-root').innerHTML = this._renderLoaded();
  },
  toggleFormer() {
    this.showFormer = !this.showFormer;
    if (!this.showFormer && this.filterUid && DataStore.isFormerMember(this.filterUid)) {
      this.filterUid = null; // clear former-member filter if hiding
    }
    document.getElementById('app-root').innerHTML = this._renderLoaded();
  },

  _renderTrade(t) {
    const lid      = t.leagueId;
    const date     = t.created
      ? new Date(t.created).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
      : '–';
    const rosterIds = t.roster_ids || [];

    const sides = rosterIds.map(rid => {
      const uid  = DataStore.rosterOwnerId(lid, rid);
      const name = uid ? (DataStore.canonicalNames[uid] || uid) : `Roster ${rid}`;

      const playersReceived = Object.entries(t.adds || {})
        .filter(([, toRid]) => toRid === rid)
        .map(([pid]) => ({
          name: DataStore.playerName(pid),
          pos:  DataStore.playerPos(pid),
          team: DataStore.playerTeam(pid),
        }));

      const picksReceived = (t.draft_picks || [])
        .filter(p => p.owner_id === rid)
        .map(p => {
          const ordinal     = this._ordinal(p.round);
          const origUid     = DataStore.rosterOwnerId(lid, p.roster_id);
          const receiverUid = DataStore.rosterOwnerId(lid, rid);
          const origName    = origUid ? DataStore.canonicalNames[origUid] : null;
          const viaName     = (origUid && origUid !== receiverUid) ? origName : null;

          // Check if this pick was re-traded before the draft
          const chainKey      = `${p.season}|${p.round}|${p.roster_id}`;
          const finalOwnerRid = DataStore.pickFinalOwner[chainKey];
          const wasRetraded   = finalOwnerRid && String(finalOwnerRid) !== String(rid);
          const finalOwnerUid = wasRetraded ? DataStore.rosterOwnerId(lid, finalOwnerRid) : null;
          const retradedTo    = finalOwnerUid ? DataStore.canonicalNames[finalOwnerUid] : null;

          const resolved = DataStore.resolveTradedPick(p);
          return { label: `${p.season} ${ordinal} Rd Pick`, viaName, resolved, wasRetraded, retradedTo };
        });

      return { name, playersReceived, picksReceived };
    });

    // Skip sides that are truly empty (shouldn't happen after content filter, but safety net)
    const totalItems = sides.reduce((s, side) => s + side.playersReceived.length + side.picksReceived.length, 0);
    if (totalItems === 0) return '';

    return `
      <div class="trade-card">
        <div class="trade-card-header">
          <span class="trade-week">Week ${t.leg || '?'} &nbsp;·&nbsp; ${t.seasonYear}</span>
          <span class="trade-date">${date}</span>
        </div>
        <div class="trade-sides">
          ${sides.map((side, i) => `
            <div class="trade-side">
              <div class="trade-team-name">${side.name} receives</div>
              <div class="trade-items">
                ${side.playersReceived.map(p => `
                  <div class="trade-item player-item">
                    <span class="pos-badge pos-${p.pos.toLowerCase()}">${p.pos}</span>
                    <span class="item-name">${p.name}</span>
                    <span class="item-meta">${p.team}</span>
                  </div>
                `).join('')}
                ${side.picksReceived.map(p => `
                  <div class="trade-item pick-item">
                    <span class="pos-badge pos-pick">PICK</span>
                    <div class="pick-detail">
                      <span class="item-name">${p.label}${p.viaName ? ` <span class="item-meta">(${p.viaName}'s pick)</span>` : ''}</span>
                      ${p.wasRetraded
                        ? `<span class="pick-retraded">↪ Re-traded to ${p.retradedTo || 'another team'}</span>`
                        : ''}
                      ${this._resolvedHtml(p.resolved)}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
            ${i < sides.length - 1 ? '<div class="trade-divider">⇄</div>' : ''}
          `).join('')}
        </div>
      </div>
    `;
  },

  _resolvedHtml(resolved) {
    if (!resolved) return `<span class="pick-unresolved">pick not yet used</span>`;
    const picks = Array.isArray(resolved) ? resolved : [resolved];
    return picks.map(p =>
      `<span class="pick-resolved">→ ${p.playerName} <span class="pick-pos">${p.position}</span></span>`
    ).join(' ');
  },

  _ordinal(n) {
    const s = ['th','st','nd','rd'], v = n % 100;
    return n + (s[(v-20)%10] || s[v] || s[0]);
  },

  afterRender() {},
};
