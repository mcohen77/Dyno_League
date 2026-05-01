const SuggestionBoxTab = {
  render() {
    return `
      <div class="tab-content" id="suggestion-box-tab">
        <div class="suggestion-wrap">
          <div class="league-banner">
            <h2>League Suggestion Box</h2>
            <div class="league-meta">
              <span>Submit ideas for rules, payouts, draft chaos, or league upgrades</span>
            </div>
          </div>

          <section class="suggestion-panel">
            <p class="suggestion-desc">Drop your best idea below. Expect no mercy in the response.</p>

            <form id="sb-form">
              <div class="suggestion-field">
                <label for="sb-teamName">Your Team</label>
                <select id="sb-teamName" name="teamName" required>
                  <option value="">Select your team</option>
                  <option>FYF</option>
                  <option>The Rodfathers Dynasty</option>
                  <option>Roster Wood</option>
                  <option>BUDSandSMUSH</option>
                  <option>TB12</option>
                  <option>LEONandGAIA</option>
                  <option>Bmisk</option>
                  <option>Kvolks</option>
                  <option>PolandSpring</option>
                  <option>Poopiesnot</option>
                </select>
              </div>

              <div class="suggestion-field">
                <label for="sb-suggestion">Your Suggestion</label>
                <textarea id="sb-suggestion" name="suggestion" rows="5" placeholder="Type your suggestion here..." required></textarea>
              </div>

              <button type="submit" class="suggestion-submit">Submit Suggestion</button>
            </form>

            <div id="sb-responseBox" class="sb-response" aria-live="polite"></div>
          </section>
        </div>
      </div>
    `;
  },

  afterRender() {
    const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyPk1Te_pKfnmlxOJHUUuQ53aRpJOHbuKFoIb53rIPwfCyptDFQDp74uQGcR8Cet1TIXA/exec";

    const roasts = [
      "Get the hell out of here with that chaos-tier suggestion.",
      "That is absolute bullshit and you should be fined a draft pick for saying it.",
      "This suggestion is so bad it should be vetoed by common sense.",
      "No chance. That idea belongs straight in the trash with bad trade offers.",
      "That might be the most unserious suggestion in league history.",
      "Respectfully, that suggestion is football terrorism."
    ];

    const form = document.getElementById('sb-form');
    const responseBox = document.getElementById('sb-responseBox');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const teamName = document.getElementById('sb-teamName').value.trim();
      const suggestion = document.getElementById('sb-suggestion').value.trim();
      if (!teamName || !suggestion) return;

      const roast = roasts[Math.floor(Math.random() * roasts.length)];
      let saved = false;

      try {
        const looksValid = APPS_SCRIPT_URL.includes('/macros/s/') && APPS_SCRIPT_URL.endsWith('/exec');
        if (looksValid) {
          const params = new URLSearchParams({ teamName, suggestion, submittedAt: new Date().toISOString() });
          await fetch(`${APPS_SCRIPT_URL}?${params}`, { method: 'GET', mode: 'no-cors' });
          saved = true;
        }
      } catch {
        saved = false;
      }

      const statusLine = saved
        ? "Just kidding, suggestion noted."
        : "Just kidding, suggestion noted locally. Sheet sync failed.";

      responseBox.innerHTML = `
        <div class="sb-roast">${roast}</div>
        <div class="sb-jk">${statusLine}</div>
      `;
      form.reset();
    });
  }
};
