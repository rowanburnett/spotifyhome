// Configuration and endpoint constants
const clientId = 'f82ac08f17c34c40a267ea3b4f772264'; // your clientId
const redirectUrl = 'http://localhost:5500'; // your redirect URL - must be localhost URL and/or HTTPS
const authorizationEndpoint = "https://accounts.spotify.com/authorize";
const tokenEndpoint = "https://accounts.spotify.com/api/token";
const scope = 'user-read-private user-read-email user-read-playback-state user-modify-playback-state user-read-currently-playing user-library-read user-library-modify';

// Data structure that manages the current active token, caching it in localStorage
const currentToken = {
  get access_token() { return localStorage.getItem('access_token') || null; },
  get refresh_token() { return localStorage.getItem('refresh_token') || null; },
  get expires_in() { return localStorage.getItem('expires_in') || null },
  get expires() { return localStorage.getItem('expires') || null },

  save: function (response) {
    const { access_token, refresh_token, expires_in } = response;
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);
    localStorage.setItem('expires_in', expires_in);

    const now = new Date();
    const expiry = new Date(now.getTime() + (expires_in * 1000));
    localStorage.setItem('expires', expiry);
    updateOAuthInfo();
    scheduleTokenRefresh(); // Schedule the next token refresh
  },

  clear: function () {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('expires_in');
    localStorage.removeItem('expires');
  }
};

// Utility function to handle PKCE code verifier/challenge creation
async function createPKCEChallenge() {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const randomValues = crypto.getRandomValues(new Uint8Array(64));
  const codeVerifier = Array.from(randomValues).map(x => possible[x % possible.length]).join('');

  const data = new TextEncoder().encode(codeVerifier);
  const hashed = await crypto.subtle.digest('SHA-256', data);

  const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(hashed)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  localStorage.setItem('code_verifier', codeVerifier);
  return codeChallenge;
}

// Redirect user to Spotify's authorization page
async function redirectToSpotifyAuthorize() {
  const codeChallenge = await createPKCEChallenge();

  const authUrl = new URL(authorizationEndpoint);
  const params = {
    response_type: 'code',
    client_id: clientId,
    scope: scope,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    redirect_uri: redirectUrl,
  };

  authUrl.search = new URLSearchParams(params).toString();
  window.location.href = authUrl.toString(); // Redirect the user to the authorization server for login
}

// Exchange authorization code for access and refresh tokens
async function getToken(code) {
  const codeVerifier = localStorage.getItem('code_verifier');

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUrl,
      code_verifier: codeVerifier,
    }),
  });

  return await response.json();
}

// Refresh access token using the refresh token
async function refreshToken() {
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'refresh_token',
      refresh_token: currentToken.refresh_token
    }),
  });

  return await response.json();
}

// Schedule the token refresh
function scheduleTokenRefresh() {
  const expiresIn = currentToken.expires_in;
  const now = new Date().getTime();
  const expiryTime = new Date(currentToken.expires).getTime();
  const delay = expiryTime - now - 60000; // Refresh the token 1 minute before it expires

  setTimeout(async () => {
    try {
      const response = await refreshToken();
      currentToken.save(response);
      console.log('Token refreshed automatically.');
    } catch (error) {
      console.error('Error refreshing token automatically:', error);
    }
  }, delay);
}

// On page load, try to fetch auth code from current browser search URL
document.addEventListener('DOMContentLoaded', async () => {
  const loginButton = document.getElementById('login-button');
  const refreshButton = document.getElementById('refresh-button');
  const logoutButton = document.getElementById('logout-button');
  
  loginButton.addEventListener('click', loginWithSpotifyClick);
  refreshButton.addEventListener('click', refreshTokenClick);
  logoutButton.addEventListener('click', logoutClick);
  
  const args = new URLSearchParams(window.location.search);
  const code = args.get('code');

  // If we find a code, we're in a callback, do a token exchange
  if (code) {
    const token = await getToken(code);
    currentToken.save(token);

    // Remove code from URL so we can refresh correctly
    const url = new URL(window.location.href);
    url.searchParams.delete("code");

    const updatedUrl = url.search ? url.href : url.href.replace('?', '');
    window.history.replaceState({}, document.title, updatedUrl);

    console.log('Authorization successful, tokens saved.');
  } else {
    console.log('No authorization code found, initiate login.');
  }

  if (currentToken.access_token) {
    document.getElementById("song-container").style.display = 'flex';
    updateOAuthInfo();
    scheduleTokenRefresh(); // Schedule the token refresh
  } else {
    document.getElementById("login-container").style.display = 'flex';
  }
});

// Update the OAuth information on the page
function updateOAuthInfo() {
  document.getElementById('access-token').innerText = currentToken.access_token || 'N/A';
  document.getElementById('refresh-token').innerText = currentToken.refresh_token || 'N/A';
  document.getElementById('expires').innerText = currentToken.expires ? new Date(currentToken.expires).toLocaleString() : 'N/A';
}

// Click handlers
async function loginWithSpotifyClick() {
  await redirectToSpotifyAuthorize();
}

async function refreshTokenClick() {
  console.log('Attempting to refresh token...');
  try {
    const response = await refreshToken();
    console.log('Refresh response:', response);
    currentToken.save(response);
    console.log('Token refreshed successfully.');
  } catch (error) {
    console.error('Error refreshing token:', error);
  }
}

async function logoutClick() {
  currentToken.clear();
  window.location.href = redirectUrl;
  console.log('Logged out successfully.');
}
