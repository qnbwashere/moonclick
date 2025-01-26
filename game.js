import UPGRADES from './upgrades.js';

class SpaceGame {
  constructor() {
    this.username = null;
    this.cookies = 0;
    this.lifetimeCookies = 0;
    // Deep clone the upgrades with their initial costs preserved
    this.upgrades = Object.keys(UPGRADES).reduce((acc, key) => {
      acc[key] = {
        ...UPGRADES[key],
        initialCost: UPGRADES[key].cost
      };
      return acc;
    }, {});

    // Initialize auth same as before
    const authToken = this.getCookie('authToken') || localStorage.getItem('authToken');
    if (authToken) {
      this.username = this.verifyAuthToken(authToken);
      if (this.username) {
        this.loadGame();
        this.setupEventListeners();
        this.updateLoop();
        this.updateLeaderboard();
        this.populateUpgrades();
      } else {
        this.showAuthModal();
      }
    } else {
      this.showAuthModal();
    }
    
    // Add dev panel functionality
    document.addEventListener('keydown', (e) => {
      if (e.key === 'd' || e.key === 'D') {
        this.toggleDevPanel();
      }
    });
  }

  showAuthModal() {
    document.getElementById('auth-modal').classList.remove('hidden');
  }

  verifyAuthToken(token) {
    try {
      const [username, hash] = token.split(':');
      const accounts = JSON.parse(localStorage.getItem('accounts') || '{}');
      if (accounts[username] && accounts[username].authToken === token) {
        return username;
      }
    } catch (e) {
      return null;
    }
    return null;
  }

  generateAuthToken(username, password) {
    const hash = Array.from(password).reduce(
      (hash, char) => ((hash << 5) - hash) + char.charCodeAt(0), 0
    ).toString(36);
    return `${username}:${hash}`;
  }

  async login(username, password) {
    const accounts = JSON.parse(localStorage.getItem('accounts') || '{}');
    const account = accounts[username];
    
    if (!account) {
      throw new Error('Account not found');
    }

    const authToken = this.generateAuthToken(username, password);
    if (authToken !== account.authToken) {
      throw new Error('Invalid password');
    }

    this.username = username;
    localStorage.setItem('authToken', authToken);
    this.setCookie('authToken', authToken); 
    document.getElementById('auth-modal').classList.add('hidden');
    this.loadGame();
    this.setupEventListeners();
    this.updateLoop();
    this.updateLeaderboard();
  }

  async register(username, password) {
    if (username.length < 3) {
      throw new Error('Username must be at least 3 characters');
    }
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    const accounts = JSON.parse(localStorage.getItem('accounts') || '{}');
    if (accounts[username]) {
      throw new Error('Username already exists');
    }

    const authToken = this.generateAuthToken(username, password);
    accounts[username] = {
      authToken,
      created: Date.now()
    };
    
    localStorage.setItem('accounts', JSON.stringify(accounts));
    await this.login(username, password);
  }

  async deleteAccount(password) {
    const accounts = JSON.parse(localStorage.getItem('accounts') || '{}');
    const authToken = this.generateAuthToken(this.username, password);
    
    if (authToken !== accounts[this.username].authToken) {
      throw new Error('Invalid password');
    }

    delete accounts[this.username];
    localStorage.setItem('accounts', JSON.stringify(accounts));
    
    localStorage.removeItem(`cookieGame_${this.username}`);
    localStorage.removeItem('authToken');
    this.deleteCookie('authToken'); 
    
    const leaderboardData = this.getLeaderboardData();
    delete leaderboardData[this.username];
    localStorage.setItem('leaderboard', JSON.stringify(leaderboardData));
    
    this.username = null;
    this.cookies = 0;
    this.lifetimeCookies = 0;
    this.upgrades = Object.keys(UPGRADES).reduce((acc, key) => {
      acc[key] = {
        ...UPGRADES[key],
        initialCost: UPGRADES[key].cost
      };
      return acc;
    }, {});
    
    this.updateDisplay();
    this.displayLeaderboard();
    
    this.showAuthModal();
    document.getElementById('confirm-delete-modal').classList.add('hidden');
  }

  setupEventListeners() {
    document.getElementById('cookie').addEventListener('click', () => {
      this.addCookies(1);
      this.saveGame();
    });
  }

  addCookies(amount) {
    this.cookies += amount;
    this.lifetimeCookies += amount;
    this.updateDisplay();
    this.updateLeaderboard();
  }

  getCookiesPerSecond() {
    return Object.values(this.upgrades).reduce((total, upgrade) => {
      return total + (upgrade.owned * upgrade.cps);
    }, 0);
  }

  buyUpgrade(type) {
    const upgrade = this.upgrades[type];
    if (this.cookies >= upgrade.cost) {
      this.cookies -= upgrade.cost;
      upgrade.owned++;
      upgrade.cost = Math.ceil(upgrade.cost * 1.15);
      this.updateDisplay();
      this.saveGame();
      this.updateLeaderboard();
    }
  }

  populateUpgrades() {
    const container = document.getElementById('upgrades-container');
    container.innerHTML = '';

    // Group upgrades by category
    const categories = {
      'Cursor': ['astroFingers', 'cosmicCream', 'quantumGrip', 'stellarSwipe'],
      'Grandma': ['starryBiscuit', 'moonlitElder', 'galacticOven', 'nebulasWisdom'],
      'Farm': ['meteorHarvest', 'cosmicFertilizer', 'gravitationalGrowth'],
      'Advanced': ['quantumVault', 'cosmicCurrency', 'solarRituals', 'quantumSorcery', 'wormholeFreight'],
      'Super Advanced': ['darkMatterExtraction', 'stellarGateway', 'timeVortex', 'antimatterReactor'],
      'Ultimate': ['prismaticSingularity', 'supernovaIllumination', 'fractalCosmos', 'cosmicDebugger', 'gravityWellMastery']
    };

    Object.entries(categories).forEach(([categoryName, upgradeKeys]) => {
      const categoryHeader = document.createElement('h3');
      categoryHeader.textContent = categoryName;
      container.appendChild(categoryHeader);

      upgradeKeys.forEach(type => {
        const upgrade = this.upgrades[type];
        const div = document.createElement('div');
        div.id = type;
        div.className = 'upgrade';
        if (this.cookies < upgrade.cost) {
          div.className += ' disabled';
        }
        div.onclick = () => this.buyUpgrade(type); 
        div.innerHTML = `
          <h3>${this.formatUpgradeName(type)}</h3>
          <p class="description">${upgrade.description}</p>
          <p>Cost: <span class="cost">${this.formatNumber(upgrade.cost)}</span> stardust</p>
          <p>You have: <span class="owned">${upgrade.owned}</span></p>
          <p>Produces ${upgrade.cps} stardust per second</p>
        `;
        container.appendChild(div);
      });
    });
  }

  formatUpgradeName(name) {
    return name.replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
  }

  formatNumber(num) {
    const suffixes = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];
    let suffixIndex = 0;
    while (num >= 1000 && suffixIndex < suffixes.length - 1) {
      num /= 1000;
      suffixIndex++;
    }
    return num.toFixed(1) + suffixes[suffixIndex];
  }

  updateDisplay() {
    document.getElementById('cookie-count').textContent = this.formatNumber(this.cookies);
    document.getElementById('lifetime-cookies').textContent = this.formatNumber(this.lifetimeCookies);
    document.getElementById('cps').textContent = this.formatNumber(this.getCookiesPerSecond());
    document.getElementById('current-player').textContent = this.username;

    // Update upgrade boxes
    Object.entries(this.upgrades).forEach(([type, upgrade]) => {
      const element = document.getElementById(type);
      if (element) {
        element.querySelector('.cost').textContent = this.formatNumber(upgrade.cost);
        element.querySelector('.owned').textContent = upgrade.owned;
        if (this.cookies < upgrade.cost) {
          element.classList.add('disabled');
        } else {
          element.classList.remove('disabled');
        }
      }
    });
  }

  saveGame() {
    const gameState = {
      cookies: this.cookies,
      lifetimeCookies: this.lifetimeCookies,
      upgrades: this.upgrades
    };
    localStorage.setItem(`cookieGame_${this.username}`, JSON.stringify(gameState));
    this.updateLeaderboard();
  }

  loadGame() {
    const savedGame = localStorage.getItem(`cookieGame_${this.username}`);
    if (savedGame) {
      const gameState = JSON.parse(savedGame);
      this.cookies = gameState.cookies;
      this.lifetimeCookies = gameState.lifetimeCookies || gameState.cookies;
      this.upgrades = gameState.upgrades;
      this.updateDisplay();
    }
  }

  updateLeaderboard() {
    if (!this.username) return;
    
    const leaderboardData = this.getLeaderboardData();
    leaderboardData[this.username] = Math.floor(this.lifetimeCookies);
    localStorage.setItem('leaderboard', JSON.stringify(leaderboardData));
    this.displayLeaderboard();
  }

  getLeaderboardData() {
    const leaderboard = localStorage.getItem('leaderboard');
    return leaderboard ? JSON.parse(leaderboard) : {};
  }

  displayLeaderboard() {
    const leaderboardElement = document.getElementById('leaderboard-list');
    if (!leaderboardElement) return;
    
    const leaderboardData = this.getLeaderboardData();
    const sortedPlayers = Object.entries(leaderboardData)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);

    leaderboardElement.innerHTML = sortedPlayers
      .map(([username, score], index) => `
        <div class="leaderboard-entry">
          <span>${index + 1}. ${username}</span>
          <span>${score} cookies</span>
        </div>
      `)
      .join('');
  }

  updateLoop() {
    setInterval(() => {
      const cps = this.getCookiesPerSecond();
      const increment = cps / 10;
      this.cookies += increment;
      this.lifetimeCookies += increment;
      this.updateDisplay();
      this.saveGame();

      // Update last active timestamp
      if (this.username) {
        const accounts = JSON.parse(localStorage.getItem('accounts') || '{}');
        if (accounts[this.username]) {
          accounts[this.username].lastActive = Date.now();
          localStorage.setItem('accounts', JSON.stringify(accounts));
        }
      }
    }, 100);
  }

  setCookie(name, value, days = 30) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = `expires=${date.toUTCString()}`;
    document.cookie = `${name}=${value};${expires};path=/`;
  }

  getCookie(name) {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [cookieName, cookieValue] = cookie.trim().split('=');
      if (cookieName === name) return cookieValue;
    }
    return null;
  }

  deleteCookie(name) {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
  }

  toggleDevPanel() {
    const devPanel = document.getElementById('dev-panel');
    devPanel.classList.toggle('hidden');
    // Clear password input when opening/closing
    document.getElementById('dev-password').value = '';
    document.getElementById('dev-password-error').textContent = '';
    document.getElementById('dev-controls').classList.add('hidden');
  }

  checkDevPassword(password) {
    if (password === '8211') {
      document.getElementById('dev-controls').classList.remove('hidden');
      document.getElementById('dev-password-error').textContent = '';
      return true;
    } else {
      document.getElementById('dev-password-error').textContent = 'Invalid password';
      return false;
    }
  }

  resetGame() {
    if (!this.checkDevPassword(document.getElementById('dev-password').value)) return;
    
    this.cookies = 0;
    this.lifetimeCookies = 0;
    Object.keys(this.upgrades).forEach(key => {
      this.upgrades[key].owned = 0;
      this.upgrades[key].cost = this.upgrades[key].initialCost || this.upgrades[key].cost;
    });
    this.saveGame();
    this.updateDisplay();
  }

  addDevCookies(amount) {
    if (!this.checkDevPassword(document.getElementById('dev-password').value)) return;
    this.addCookies(amount);
  }

  displayOverview() {
    if (!this.checkDevPassword(document.getElementById('dev-password').value)) return;
    
    const accounts = JSON.parse(localStorage.getItem('accounts') || '{}');
    const leaderboardData = this.getLeaderboardData();
    const currentOnline = Object.keys(accounts).filter(username => {
      const lastActive = accounts[username].lastActive || 0;
      return Date.now() - lastActive < 5 * 60 * 1000; // Consider active if within last 5 minutes
    }).length;

    // Create overview panel if it doesn't exist
    let overviewPanel = document.getElementById('overview-panel');
    if (!overviewPanel) {
      overviewPanel = document.createElement('div');
      overviewPanel.id = 'overview-panel';
      overviewPanel.className = 'overview-panel';
      document.body.appendChild(overviewPanel);
    }

    const closeButton = document.createElement('button');
    closeButton.className = 'close-overview';
    closeButton.textContent = 'Close Overview';
    closeButton.onclick = () => this.closeOverview();

    overviewPanel.innerHTML = `
      <h3>System Overview</h3>
      <div class="overview-stats">
        <p>Total Players: ${Object.keys(accounts).length}</p>
        <p>Currently Online: ${currentOnline}</p>
      </div>
      <div class="overview-data">
        <h4>Account Details</h4>
        <table class="overview-table">
          <tr>
            <th>Username</th>
            <th>Auth Token</th>
            <th>Created</th>
            <th>Last Active</th>
            <th>Lifetime Score</th>
          </tr>
          ${Object.entries(accounts).map(([username, data]) => `
            <tr>
              <td>${username}</td>
              <td>${data.authToken}</td>
              <td>${new Date(data.created).toLocaleDateString()}</td>
              <td>${data.lastActive ? new Date(data.lastActive).toLocaleString() : 'Never'}</td>
              <td>${leaderboardData[username] || 0}</td>
            </tr>
          `).join('')}
        </table>
      </div>
      <div style="margin-top: 20px">
        <p style="color: #ffaaaa">Note: Auth tokens can be used to log in as users for moderation. Simply paste the auth token into localStorage with key 'authToken' using browser dev tools.</p>
      </div>
    `;
    
    overviewPanel.appendChild(closeButton);
    overviewPanel.classList.remove('hidden');
  }

  closeOverview() {
    if (!this.checkDevPassword(document.getElementById('dev-password').value)) return;
    const overviewPanel = document.getElementById('overview-panel');
    if (overviewPanel) {
      overviewPanel.classList.add('hidden');
    }
  }
}

const game = new SpaceGame();

// Expose global handlers to window object
window.game = game;

window.switchTab = (tab) => {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const tabs = document.querySelectorAll('.tab-btn');
  
  tabs.forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  
  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
  } else {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
  }
};

window.loginHandler = async () => {
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  const errorElement = document.getElementById('login-error');
  
  try {
    await game.login(username, password);
    errorElement.textContent = '';
  } catch (error) {
    errorElement.textContent = error.message;
  }
};

window.registerHandler = async () => {
  const username = document.getElementById('register-username').value;
  const password = document.getElementById('register-password').value;
  const confirmPassword = document.getElementById('register-confirm-password').value;
  const errorElement = document.getElementById('register-error');
  
  if (password !== confirmPassword) {
    errorElement.textContent = 'Passwords do not match';
    return;
  }
  
  try {
    await game.register(username, password);
    errorElement.textContent = '';
  } catch (error) {
    errorElement.textContent = error.message;
  }
};

window.confirmDeleteHandler = async () => {
  const password = document.getElementById('delete-password').value;
  const errorElement = document.getElementById('delete-error');
  
  try {
    await game.deleteAccount(password);
    errorElement.textContent = '';
  } catch (error) {
    errorElement.textContent = error.message;
  }
};

window.cancelDeleteHandler = () => {
  document.getElementById('confirm-delete-modal').classList.add('hidden');
  document.getElementById('delete-password').value = '';
  document.getElementById('delete-error').textContent = '';
};

window.deleteAccountHandler = () => {
  document.getElementById('confirm-delete-modal').classList.remove('hidden');
};

window.closeDevPanel = () => {
  document.getElementById('dev-panel').classList.add('hidden');
};

document.getElementById('dev-password').addEventListener('keyup', function(event) {
  if (event.key === 'Enter') {
    game.checkDevPassword(this.value);
  }
});

document.getElementById('dev-controls').innerHTML = `
  <button onclick="game.addDevCookies(1000000)">Add 1M Stardust</button>
  <button onclick="game.addDevCookies(1000000000)">Add 1B Stardust</button>
  <button onclick="game.addDevCookies(1000000000000)">Add 1T Stardust</button>
  <button onclick="game.resetGame()">Reset Game</button>
  <button onclick="game.displayOverview()">System Overview</button>
  <button onclick="game.closeOverview()">Close Overview</button>
`;

export default game;