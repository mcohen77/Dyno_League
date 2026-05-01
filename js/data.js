// Central data store — loads all historical seasons once, then components read from here
const CURRENT_LEAGUE_ID = '1355649244354060288';
const LEAGUE_DISPLAY_NAME = 'The Dyno League of the People';

// Former members — matched by display_name or team_name (case-insensitive)
const FORMER_MEMBER_NAMES = ['npurritano', 'silly boys'];

// Manual overrides for outcomes Sleeper can't record (e.g. ties, disputes)
// season: the year string; type: 'tie' means co-champions
const SEASON_OVERRIDES = {
  '2022': {
    type: 'tie',
    champions: ['BUDSandSMUSH', 'Bmisk'], // exact canonical names (case-sensitive)
    note: 'Championship ended in a tie',
  },
};

const DataStore = {
  seasons: [],
  seasonData: {},
  nflState: null,
  loaded: false,

  canonicalNames: {},   // user_id -> string name (from most recent season)
  canonicalAvatars: {}, // user_id -> avatar url

  // Former member tracking
  formerMemberIds: new Set(), // user_ids of former members
  hideFormerMembers: false,   // toggle — hides them from leaderboards/lists

  // Year filter — null = all years, Set of season strings for multi-select
  activeSeasons: null,

  // ── Identity helpers ────────────────────────────────────────

  rosterOwnerId(leagueId, rosterId) {
    const sd = this.seasonData[leagueId];
    if (!sd) return null;
    const roster = sd.rosters.find(r => r.roster_id === rosterId);
    return roster?.owner_id ?? null;
  },

  rosterToManager(leagueId, rosterId) {
    const uid = this.rosterOwnerId(leagueId, rosterId);
    if (!uid) return `Team ${rosterId}`;
    return this.canonicalNames[uid] || `User ${uid}`;
  },

  managerAvatar(leagueId, rosterId) {
    const uid = this.rosterOwnerId(leagueId, rosterId);
    if (!uid) return null;
    return this.canonicalAvatars[uid] || null;
  },

  isFormerMember(userId) {
    return this.formerMemberIds.has(userId);
  },

  // Should this user be visible in lists? (former members hidden when toggle is on)
  isVisible(userId) {
    if (!this.hideFormerMembers) return true;
    return !this.formerMemberIds.has(userId);
  },

  _buildCanonicalNames() {
    this.canonicalNames = {};
    this.canonicalAvatars = {};
    this.formerMemberIds = new Set();

    // Oldest → newest so most recent name wins
    for (const season of this.seasons) {
      const sd = this.seasonData[season.league_id];
      if (!sd) continue;
      for (const user of sd.users) {
        const teamName = user.metadata?.team_name || '';
        const displayName = user.display_name || '';
        const name = teamName || displayName || `User ${user.user_id}`;
        this.canonicalNames[user.user_id] = name;
        if (user.avatar) {
          this.canonicalAvatars[user.user_id] = `https://sleepercdn.com/avatars/thumbs/${user.avatar}`;
        }
        // Detect former members by any historical name match
        const combined = (teamName + ' ' + displayName).toLowerCase();
        if (FORMER_MEMBER_NAMES.some(fn => combined.includes(fn))) {
          this.formerMemberIds.add(user.user_id);
        }
      }
    }
  },

  // ── Championship detection ──────────────────────────────────

  // Returns the championship bracket matchup for a given league.
  // Sleeper marks it with p===1 (winner gets 1st place).
  // Fallback: highest round, LOWEST matchup number (championship = m:1, 3rd place = m:2).
  getChampionshipGame(leagueId) {
    const sd = this.seasonData[leagueId];
    if (!sd?.bracket?.length) return null;
    const byP = sd.bracket.find(m => m.p === 1);
    if (byP) return byP;
    const withTeams = sd.bracket.filter(m => m.t1 != null || m.t2 != null || m.t1_from != null);
    if (!withTeams.length) return null;
    const maxR = Math.max(...withTeams.map(m => m.r));
    const finalRound = withTeams.filter(m => m.r === maxR);
    return finalRound.sort((a, b) => a.m - b.m)[0] || null; // m:1 = championship
  },

  // 3rd place game — Sleeper marks it with p===3
  getThirdPlaceGame(leagueId) {
    const sd = this.seasonData[leagueId];
    if (!sd?.bracket?.length) return null;
    return sd.bracket.find(m => m.p === 3) || null;
  },

  // All playoff week matchup results for a season (weeks >= playoff_week_start)
  getPlayoffMatchupResults(leagueId) {
    const sd = this.seasonData[leagueId];
    const season = this.seasons.find(s => s.league_id === leagueId);
    if (!sd || !season) return [];
    const playoffStart = season.settings?.playoff_week_start || 15;
    const results = [];
    for (const { week, matchups } of sd.matchupsPerWeek) {
      if (week < playoffStart) continue;
      if (!matchups?.length) continue;
      const byMatchup = {};
      for (const m of matchups) {
        if (!m.matchup_id) continue;
        if (!byMatchup[m.matchup_id]) byMatchup[m.matchup_id] = [];
        byMatchup[m.matchup_id].push(m);
      }
      for (const pair of Object.values(byMatchup)) {
        if (pair.length !== 2) continue;
        const [a, b] = pair;
        const aWin = a.points > b.points;
        const aUid = this.rosterOwnerId(leagueId, a.roster_id);
        const bUid = this.rosterOwnerId(leagueId, b.roster_id);
        if (a.points === 0 && b.points === 0) continue; // unplayed
        results.push({ week, leagueId, season: season.season, rosterId: a.roster_id, userId: aUid, pf: a.points, win: aWin });
        results.push({ week, leagueId, season: season.season, rosterId: b.roster_id, userId: bUid, pf: b.points, win: !aWin });
      }
    }
    return results;
  },

  // ── Filtering ───────────────────────────────────────────────

  filteredSeasons() {
    if (!this.activeSeasons || this.activeSeasons.size === 0) return this.seasons;
    return this.seasons.filter(s => this.activeSeasons.has(s.season));
  },

  setSeasonFilter(seasons) {
    // seasons: Set of strings, single string, or null for all
    if (!seasons || (seasons instanceof Set && seasons.size === 0)) {
      this.activeSeasons = null;
    } else if (seasons instanceof Set) {
      this.activeSeasons = seasons;
    } else {
      this.activeSeasons = new Set([seasons]);
    }
  },

  // ── Matchup data ────────────────────────────────────────────

  getMatchupResults(leagueId) {
    const sd = this.seasonData[leagueId];
    const season = this.seasons.find(s => s.league_id === leagueId);
    if (!sd || !season) return [];

    const playoffStart = season.settings?.playoff_week_start || 15;
    const results = [];

    for (const { week, matchups } of sd.matchupsPerWeek) {
      if (week >= playoffStart) continue;
      if (!matchups || matchups.length === 0) continue;
      const byMatchup = {};
      for (const m of matchups) {
        if (!m.matchup_id) continue;
        if (!byMatchup[m.matchup_id]) byMatchup[m.matchup_id] = [];
        byMatchup[m.matchup_id].push(m);
      }
      for (const pair of Object.values(byMatchup)) {
        if (pair.length !== 2) continue;
        const [a, b] = pair;
        const aWin = a.points > b.points;
        const aUid = this.rosterOwnerId(leagueId, a.roster_id);
        const bUid = this.rosterOwnerId(leagueId, b.roster_id);
        results.push({
          week, leagueId, season: season.season,
          rosterId: a.roster_id, opponentId: b.roster_id,
          userId: aUid, opponentUserId: bUid,
          pf: a.points, pa: b.points, win: aWin,
        });
        results.push({
          week, leagueId, season: season.season,
          rosterId: b.roster_id, opponentId: a.roster_id,
          userId: bUid, opponentUserId: aUid,
          pf: b.points, pa: a.points, win: !aWin,
        });
      }
    }
    return results;
  },

  // All matchup results — respects activeSeason filter
  // NOTE: does NOT filter former members — their games are always counted
  getAllMatchupResults() {
    return this.filteredSeasons().flatMap(s => this.getMatchupResults(s.league_id));
  },

  // ── Computed stats ──────────────────────────────────────────

  headToHead(uidA, uidB) {
    const results = this.getAllMatchupResults();
    let wins = 0, losses = 0, pf = 0, pa = 0;
    for (const r of results) {
      if (r.userId === uidA && r.opponentUserId === uidB) {
        if (r.win) wins++; else losses++;
        pf += r.pf;
        pa += r.pa;
      }
    }
    return { wins, losses, pf: +pf.toFixed(2), pa: +pa.toFixed(2) };
  },

  // All unique user_ids — respects hideFormerMembers for display lists
  allUserIds({ includeFormer = false } = {}) {
    const ids = new Set();
    for (const season of this.filteredSeasons()) {
      const sd = this.seasonData[season.league_id];
      if (!sd) continue;
      for (const user of sd.users) {
        if (!includeFormer && !this.isVisible(user.user_id)) continue;
        ids.add(user.user_id);
      }
    }
    return [...ids];
  },

  // Career stats — former members excluded from result when hideFormerMembers is on
  // Pass seasonsOverride to bypass the active year filter (e.g. DataStore.seasons for all-time)
  careerStats(seasonsOverride) {
    const results = (seasonsOverride ?? this.filteredSeasons())
      .flatMap(s => this.getMatchupResults(s.league_id));
    const stats = {};
    for (const r of results) {
      if (!r.userId) continue;
      if (!this.isVisible(r.userId)) continue; // skip former if hidden
      if (!stats[r.userId]) stats[r.userId] = { wins: 0, losses: 0, pf: 0, pa: 0, games: 0 };
      const s = stats[r.userId];
      if (r.win) s.wins++; else s.losses++;
      s.pf += r.pf;
      s.pa += r.pa;
      s.games++;
    }
    for (const [uid, s] of Object.entries(stats)) {
      s.pf = +s.pf.toFixed(2);
      s.pa = +s.pa.toFixed(2);
      s.winPct = s.games ? +((s.wins / s.games) * 100).toFixed(1) : 0;
      s.avgPf = s.games ? +(s.pf / s.games).toFixed(2) : 0;
      s.userId = uid;
      s.name = this.canonicalNames[uid] || `User ${uid}`;
      s.isFormer = this.formerMemberIds.has(uid);
    }
    return stats;
  },

  // Pass seasonsOverride (array) to bypass the active year filter
  seasonalRecords(seasonsOverride) {
    const list = Array.isArray(seasonsOverride) ? seasonsOverride : (seasonsOverride ?? this.filteredSeasons());
    const records = {};
    for (const season of list) {
      const lid = season.league_id;
      const results = this.getMatchupResults(lid);
      const perUser = {};
      for (const r of results) {
        if (!r.userId) continue;
        if (!this.isVisible(r.userId)) continue;
        if (!perUser[r.userId]) perUser[r.userId] = { wins: 0, losses: 0, pf: 0, pa: 0 };
        const m = perUser[r.userId];
        if (r.win) m.wins++; else m.losses++;
        m.pf += r.pf;
        m.pa += r.pa;
      }
      const ranked = Object.entries(perUser)
        .map(([uid, m]) => ({ uid, ...m }))
        .sort((a, b) => b.wins - a.wins || b.pf - a.pf);
      ranked.forEach((m, i) => {
        if (!records[m.uid]) records[m.uid] = [];
        records[m.uid].push({
          season: season.season,
          leagueId: lid,
          wins: m.wins,
          losses: m.losses,
          pf: +m.pf.toFixed(2),
          pa: +m.pa.toFixed(2),
          rank: i + 1,
          totalTeams: ranked.length,
          name: this.canonicalNames[m.uid] || `User ${m.uid}`,
        });
      });
    }
    return records;
  },

  // ── Lazy-loaded data (trades + drafts) ─────────────────────

  playersDb: null,      // player_id -> {full_name, position, team}
  allTrades: [],        // processed trade objects across all seasons
  tradesLoaded: false,

  allDrafts: [],        // [{draft, picks, season}] across all seasons
  draftsLoaded: false,

  async loadTrades(onProgress) {
    if (this.tradesLoaded) return;

    onProgress?.('Loading player database...');
    const raw = await SleeperAPI.getPlayers();
    this.playersDb = {};
    for (const [id, p] of Object.entries(raw)) {
      this.playersDb[id] = {
        name: p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || id,
        position: p.position || '?',
        team: p.team || 'FA',
      };
    }

    this.allTrades = [];
    for (let i = 0; i < this.seasons.length; i++) {
      const season = this.seasons[i];
      const lid    = season.league_id;
      onProgress?.(`Loading ${season.season} transactions... (${i + 1}/${this.seasons.length})`);
      const txns = await SleeperAPI.getAllTransactions(lid);
      const trades = txns.filter(t => t.type === 'trade' && t.status === 'complete');
      for (const t of trades) {
        this.allTrades.push({ ...t, leagueId: lid, seasonYear: season.season });
      }
    }
    // Sort oldest → newest
    this.allTrades.sort((a, b) => a.created - b.created);
    this.tradesLoaded = true;
  },

  async loadDrafts(onProgress) {
    if (this.draftsLoaded) return;
    this.allDrafts = [];

    for (let i = 0; i < this.seasons.length; i++) {
      const season = this.seasons[i];
      const lid    = season.league_id;
      onProgress?.(`Loading ${season.season} draft... (${i + 1}/${this.seasons.length})`);
      const drafts = await SleeperAPI.getLeagueDrafts(lid).catch(() => []);
      for (const draft of drafts) {
        if (draft.type !== 'snake' && draft.type !== 'linear' && draft.type !== 'auction') continue;
        const picks = await SleeperAPI.getDraftPicks(draft.draft_id).catch(() => []);
        this.allDrafts.push({ draft, picks, season: season.season, leagueId: lid });
      }
    }
    // Build ownership chain first (needs allTrades to be loaded), then pick map
    this._buildPickOwnerChain();
    this._buildPickMap();
    this.draftsLoaded = true;
  },

  // Map to resolve "which player was taken with a traded pick"
  // Key: `${season}|${round}|${roster_id}` -> array of picks (a team can hold multiple picks in same round)
  pickedByMap: {},

  // pickFinalOwner: `${season}|${round}|${originalRosterId}` -> finalOwnerRosterId
  // Built by following each pick's trade chain chronologically — last trade wins.
  pickFinalOwner: {},

  _buildPickOwnerChain() {
    this.pickFinalOwner = {};
    // Process all trades oldest → newest so the last trade overwrites earlier ones
    const sorted = [...this.allTrades].sort((a, b) => a.created - b.created);
    for (const trade of sorted) {
      for (const p of (trade.draft_picks || [])) {
        if (!p.roster_id || !p.owner_id || !p.season || !p.round) continue;
        const key = `${p.season}|${p.round}|${p.roster_id}`;
        this.pickFinalOwner[key] = p.owner_id; // most recent trade overwrites
      }
    }
  },

  _buildPickMap() {
    this.pickedByMap = {};

    for (const { draft, picks, season, leagueId } of this.allDrafts) {
      // Build: rosterId -> [picks they made this draft, sorted by round]
      const picksByRoster = {}; // rosterId -> [{round, playerName, position, pick_no}]
      for (const pick of picks) {
        const playerName = pick.metadata?.first_name
          ? `${pick.metadata.first_name} ${pick.metadata.last_name}`.trim()
          : (this.playersDb?.[pick.player_id]?.name || null);
        if (!playerName) continue;
        if (!picksByRoster[pick.roster_id]) picksByRoster[pick.roster_id] = [];
        picksByRoster[pick.roster_id].push({
          round: pick.round,
          pickNo: pick.pick_no,
          playerName,
          position: pick.metadata?.position || this.playersDb?.[pick.player_id]?.position || '?',
          draftSlot: pick.draft_slot,
        });
      }

      // Slot-based approach (primary): use slot_to_roster_id if available
      const slotToRoster = draft.slot_to_roster_id || {};
      const hasSlotData = Object.keys(slotToRoster).length > 0;

      if (hasSlotData) {
        // Build slot+round -> player map from actual picks
        const slotRoundMap = {};
        for (const pick of picks) {
          if (!pick.draft_slot) continue;
          const playerName = pick.metadata?.first_name
            ? `${pick.metadata.first_name} ${pick.metadata.last_name}`.trim()
            : (this.playersDb?.[pick.player_id]?.name || null);
          if (!playerName) continue;
          slotRoundMap[`${pick.round}|${pick.draft_slot}`] = {
            playerName,
            position: pick.metadata?.position || this.playersDb?.[pick.player_id]?.position || '?',
          };
        }
        // Map original roster → slot → player for each round
        for (const [slotStr, origRosterId] of Object.entries(slotToRoster)) {
          const slot = parseInt(slotStr);
          const maxRound = Math.max(...picks.map(p => p.round), 0);
          for (let round = 1; round <= maxRound; round++) {
            const resolved = slotRoundMap[`${round}|${slot}`];
            if (!resolved) continue;
            const key = `${season}|${round}|${origRosterId}`;
            if (!this.pickedByMap[key]) this.pickedByMap[key] = resolved;
          }
        }
      }

      // Timing/chain fallback: for any pick not resolved by slots,
      // use pickFinalOwner to find who held it at draft time,
      // then match their picks in that round by pick_no order.
      // We track how many picks of each round we've "used" per final owner
      // to avoid double-assigning the same player to two traded picks.
      const usedPickNos = new Set(); // pick_nos already assigned via slot method

      // Collect what's already resolved via slots
      for (const key of Object.keys(this.pickedByMap)) {
        const [s, r, orig] = key.split('|');
        if (s !== season) continue;
        const finalOwner = this.pickFinalOwner[key] || orig;
        const ownerPicks = (picksByRoster[finalOwner] || [])
          .filter(p => p.round === parseInt(r));
        if (ownerPicks.length > 0) usedPickNos.add(ownerPicks[0].pickNo);
      }

      // Now resolve remaining traded picks via timing chain
      for (const [key, finalOwnerRosterId] of Object.entries(this.pickFinalOwner)) {
        const [s, r, orig] = key.split('|');
        if (s !== season) continue;
        if (this.pickedByMap[key]) continue; // already resolved by slot method

        const round = parseInt(r);
        const ownerPicks = (picksByRoster[String(finalOwnerRosterId)] || [])
          .filter(p => p.round === round && !usedPickNos.has(p.pickNo))
          .sort((a, b) => a.pickNo - b.pickNo);

        if (ownerPicks.length > 0) {
          const chosen = ownerPicks[0];
          usedPickNos.add(chosen.pickNo);
          this.pickedByMap[key] = { playerName: chosen.playerName, position: chosen.position };
        }
      }
    }
  },

  // Resolve a traded pick using:
  //   1. Slot-based (if slot_to_roster_id available) — exact pick slot
  //   2. Timing chain fallback — final owner's unassigned pick in that round
  resolveTradedPick(pick) {
    if (!pick.roster_id || !pick.season || !pick.round) return null;
    const key = `${pick.season}|${pick.round}|${String(pick.roster_id)}`;
    return this.pickedByMap[key] || null;
  },

  // Get player name from DB
  playerName(playerId) {
    return this.playersDb?.[playerId]?.name || `Player ${playerId}`;
  },
  playerPos(playerId) {
    return this.playersDb?.[playerId]?.position || '?';
  },
  playerTeam(playerId) {
    return this.playersDb?.[playerId]?.team || '';
  },

  async load(onProgress) {
    if (this.loaded) return;
    onProgress?.('Fetching NFL state...');
    this.nflState = await SleeperAPI.getNFLState();

    onProgress?.('Loading all seasons...');
    this.seasons = await SleeperAPI.getAllSeasons(CURRENT_LEAGUE_ID);

    for (let i = 0; i < this.seasons.length; i++) {
      const season = this.seasons[i];
      const lid = season.league_id;
      onProgress?.(`Loading ${season.season} season data... (${i + 1}/${this.seasons.length})`);

      const [users, rosters, bracket] = await Promise.all([
        SleeperAPI.getUsers(lid),
        SleeperAPI.getRosters(lid),
        SleeperAPI.getWinnersBracket(lid).catch(() => []),
      ]);

      const totalWeeks = season.settings?.playoff_week_start
        ? season.settings.playoff_week_start + 3
        : 17;

      const matchupsPerWeek = await SleeperAPI.getAllMatchups(lid, totalWeeks);
      this.seasonData[lid] = { users, rosters, matchupsPerWeek, bracket };
    }

    this._buildCanonicalNames();
    this.loaded = true;
    onProgress?.('Done!');
  },
};
