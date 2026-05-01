// Sleeper API wrapper
const SLEEPER_BASE = 'https://api.sleeper.app/v1';

const SleeperAPI = {
  async get(path) {
    const res = await fetch(`${SLEEPER_BASE}${path}`);
    if (!res.ok) throw new Error(`API error: ${res.status} for ${path}`);
    return res.json();
  },

  getLeague(leagueId) {
    return this.get(`/league/${leagueId}`);
  },
  getUsers(leagueId) {
    return this.get(`/league/${leagueId}/users`);
  },
  getRosters(leagueId) {
    return this.get(`/league/${leagueId}/rosters`);
  },
  getMatchups(leagueId, week) {
    return this.get(`/league/${leagueId}/matchups/${week}`);
  },
  getWinnersBracket(leagueId) {
    return this.get(`/league/${leagueId}/winners_bracket`);
  },
  getLosersBracket(leagueId) {
    return this.get(`/league/${leagueId}/losers_bracket`);
  },
  getNFLState() {
    return this.get('/state/nfl');
  },

  // Fetch all seasons by chaining previous_league_id backwards
  async getAllSeasons(currentLeagueId) {
    const seasons = [];
    let leagueId = currentLeagueId;
    while (leagueId) {
      const league = await this.getLeague(leagueId);
      seasons.unshift(league); // prepend so oldest is first
      const prev = league.previous_league_id;
      leagueId = (prev && prev !== '0' && prev !== 0) ? prev : null;
    }
    return seasons;
  },

  // All transactions for a season (trades, waivers, FA) — weeks 0–18
  async getAllTransactions(leagueId) {
    const weeks = Array.from({ length: 19 }, (_, i) => i); // 0–18
    const results = await Promise.all(
      weeks.map(w => this.get(`/league/${leagueId}/transactions/${w}`).catch(() => []))
    );
    return results.flat().filter(Boolean);
  },

  // Player database — large (~3MB), load once and cache
  getPlayers() {
    return this.get('/players/nfl');
  },

  // Drafts for a league (each season has its own draft)
  getLeagueDrafts(leagueId) {
    return this.get(`/league/${leagueId}/drafts`);
  },

  // All picks for a specific draft
  getDraftPicks(draftId) {
    return this.get(`/draft/${draftId}/picks`);
  },

  getDraft(draftId) {
    return this.get(`/draft/${draftId}`);
  },

  // Fetch all matchups for a season (weeks 1-18)
  async getAllMatchups(leagueId, totalWeeks = 17) {
    const promises = [];
    for (let week = 1; week <= totalWeeks; week++) {
      promises.push(this.getMatchups(leagueId, week).catch(() => []));
    }
    const results = await Promise.all(promises);
    return results.map((matchups, i) => ({ week: i + 1, matchups }));
  },
};
