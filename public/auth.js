const backendBaseUrl = 'http://192.168.1.177:8888';

let currentToken = {
  access_token: null,
  refresh_token: null,
  expires_in: null,
  expires: null
};

// Parse token from URL fragment
function parseTokenFromUrl() {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);

  return {
    access_token: params.get('access_token'),
    refresh_token: params.get('refresh_token'),
    expires_in: params.get('expires_in')
  };
}

function saveTokenToLocalStorage(token) {
  localStorage.setItem('access_token', token.access_token);
  localStorage.setItem('refresh_token', token.refresh_token);
  localStorage.setItem('expires_in', token.expires_in);
  localStorage.setItem('expires', token.expires);
}

function loadTokenFromLocalStorage() {
  const access_token = localStorage.getItem('access_token');
  const refresh_token = localStorage.getItem('refresh_token');
  const expires_in = localStorage.getItem('expires_in');
  const expires = localStorage.getItem('expires');

  if (access_token && refresh_token && expires_in && expires) {
    return {
      access_token,
      refresh_token,
      expires_in: Number(expires_in),
      expires: new Date(expires)
    };
  }
  return null;
}

// Refresh access token using the refresh token
async function refreshToken() {
  if (!currentToken.refresh_token) {
    console.error('No refresh token available');
    return;
  }

  const response = await fetch(`${backendBaseUrl}/refresh_token?refresh_token=${currentToken.refresh_token}`);
  const data = await response.json();
  if (response.ok) {
    console.log('Token refreshed:', data);
    return data;
  } else {
    console.error('Failed to refresh token:', data);
    return null;
  }
}

function scheduleTokenRefresh() {
  if (!currentToken.expires_in || !currentToken.expires) {
    console.error('Cannot schedule token refresh due to missing token information');
    return;
  }

  const now = new Date().getTime();
  const expiryTime = new Date(currentToken.expires).getTime();
  const delay = expiryTime - now - 60000; // Refresh the token 1 minute before it expires

  if (delay > 0) {
    setTimeout(async () => {
      try {
        const response = await refreshToken();
        if (response) {
          saveToken(response);
          console.log('Token refreshed automatically.');
        }
      } catch (error) {
        console.error('Error refreshing token automatically:', error);
      }
    }, delay);
  } else {
    console.warn('Token is already expired or will expire soon, refreshing now');
    refreshTokenClick();
  }
}

// Save token to the current state
function saveToken(token) {
  if (!token.access_token || !token.refresh_token || !token.expires_in) {
    console.error('Missing token information:', token);
    return;
  }

  currentToken = {
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expires_in: token.expires_in,
    expires: new Date(new Date().getTime() + (token.expires_in * 1000))
  };

  saveTokenToLocalStorage(currentToken);
  console.log('Tokens saved:', currentToken);
  updateOAuthInfo();
  scheduleTokenRefresh();
}

// On page load, try to fetch auth code from current browser search URL
document.addEventListener('DOMContentLoaded', () => {
  const loginButton = document.getElementById('login-button');
  const refreshButton = document.getElementById('refresh-button');
  const logoutButton = document.getElementById('logout-button');

  loginButton.addEventListener('click', loginWithSpotifyClick);
  refreshButton.addEventListener('click', refreshTokenClick);
  logoutButton.addEventListener('click', logoutClick);

  // Load token from localStorage
  const token = loadTokenFromLocalStorage();
  console.log('Loaded token from localStorage:', token);

  if (token) {
    saveToken(token);
  } else {
    const urlToken = parseTokenFromUrl();
    console.log('Parsed token from URL:', urlToken);

    // If we find a token in the URL, save it
    if (urlToken.access_token && urlToken.refresh_token && urlToken.expires_in) {
      saveToken(urlToken);

      // Remove token from URL so it doesn't interfere with subsequent operations
      window.location.hash = '';

      console.log('Authorization successful, tokens saved.');
    } else {
      console.log('No authorization token found, checking for existing tokens.');
    }
  }

  if (currentToken.access_token) {
    document.getElementById("song-container").style.display = 'flex';
    document.getElementById("login-container").style.display = 'none';
    updateOAuthInfo();
    scheduleTokenRefresh();
  } else {
    document.getElementById("login-container").style.display = 'flex';
    document.getElementById("song-container").style.display = 'none';
  }
});

function updateOAuthInfo() {
  document.getElementById('access-token').innerText = currentToken.access_token || 'N/A';
  document.getElementById('refresh-token').innerText = currentToken.refresh_token || 'N/A';
  document.getElementById('expires').innerText = currentToken.expires ? new Date(currentToken.expires).toLocaleString() : 'N/A';
}

// Redirect user to Spotify's authorization page in a popup
function redirectToSpotifyAuthorize() {
  const authWindow = window.open(`${backendBaseUrl}/login`, 'Spotify Auth', 'width=600,height=800');

  const pollTimer = window.setInterval(() => {
    try {
      if (authWindow.closed) {
        window.clearInterval(pollTimer);
        console.log('Authentication popup closed');
        // Check if tokens are set after popup closes
        if (currentToken.access_token) {
          document.getElementById("song-container").style.display = 'flex';
          document.getElementById("login-container").style.display = 'none';
          updateOAuthInfo();
        } else {
          document.getElementById("login-container").style.display = 'flex';
          document.getElementById("song-container").style.display = 'none';
        }
      }
    } catch (e) {
      console.error('Error during authentication popup handling:', e);
    }
  }, 1000);
}

function loginWithSpotifyClick() {
  redirectToSpotifyAuthorize();
}

async function refreshTokenClick() {
  console.log('Attempting to refresh token...');
  try {
    const response = await refreshToken();
    if (response) {
      console.log('Refresh response:', response);
      saveToken(response);
      console.log('Token refreshed successfully.');
    }
  } catch (error) {
    console.error('Error refreshing token:', error);
  }
}

function logoutClick() {
  currentToken = {
    access_token: null,
    refresh_token: null,
    expires_in: null,
    expires: null
  };
  localStorage.clear();
  console.log('Tokens cleared');
  window.location.href = '/';
  console.log('Logged out successfully.');
}

// Function to receive message from popup
window.addEventListener('message', (event) => {
  if (event.origin !== backendBaseUrl) return; // Check the origin of the message
  if (event.data.type === 'oauth') {
    saveToken(event.data.token);
    console.log('Received token from popup:', event.data.token);
  }
}, false);
