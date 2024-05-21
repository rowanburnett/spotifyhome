const express = require('express');
const request = require('request');
const crypto = require('crypto');
const cors = require('cors');
const querystring = require('querystring');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');

const client_id = 'f82ac08f17c34c40a267ea3b4f772264'; // your clientId
const client_secret = 'b173232cbff64a2b9e9a4d3c2781fe55'; // your clientSecret
const redirect_uri = 'http://192.168.1.177:8888/callback'; // your redirect URI

const stateKey = 'spotify_auth_state';
const codeVerifierFilePath = path.join(__dirname, 'code_verifier.txt');

// Generate a random string to be used as state
const generateRandomString = (length) => {
  return crypto.randomBytes(60).toString('hex').slice(0, length);
};

const app = express();
const port = process.env.PORT || 8888;

app.use(express.static(path.join(__dirname, 'public')))
   .use(cors())
   .use(cookieParser());

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
  const state = generateRandomString(16);
  res.cookie(stateKey, state);

  const scope = 'user-read-private user-read-email user-read-playback-state user-modify-playback-state user-read-currently-playing user-library-read user-library-modify';
  const codeVerifier = generateRandomString(128);
  storeCodeVerifier(codeVerifier);
  const codeChallenge = createCodeChallenge(codeVerifier);

  const authUrl = 'https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge
    });

  res.redirect(authUrl);
});

app.get('/callback', (req, res) => {
  const code = req.query.code || null;
  const state = req.query.state || null;
  const storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    res.clearCookie(stateKey);

    const codeVerifier = retrieveCodeVerifier();

    const authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + (Buffer.from(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    };

    request.post(authOptions, (error, response, body) => {
      if (!error && response.statusCode === 200) {
        const access_token = body.access_token;
        const refresh_token = body.refresh_token;
        const expires_in = body.expires_in;

        const token = {
          access_token,
          refresh_token,
          expires_in
        };

        res.send(`
          <script>
            window.opener.postMessage({ type: 'oauth', token: ${JSON.stringify(token)} }, '${redirect_uri}');
            window.close();
          </script>
        `);
      } else {
        res.send(`
          <script>
            window.opener.postMessage({ type: 'oauth', error: 'invalid_token' }, '${redirect_uri}');
            window.close();
          </script>
        `);
      }
    });
  }
});

app.get('/refresh_token', (req, res) => {
  const refresh_token = req.query.refresh_token;
  const authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + (Buffer.from(client_id + ':' + client_secret).toString('base64'))
    },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  };

  request.post(authOptions, (error, response, body) => {
    if (!error && response.statusCode === 200) {
      const access_token = body.access_token;
      res.send({
        'access_token': access_token
      });
    } else {
      res.status(response.statusCode).send({
        error: 'Failed to refresh token'
      });
    }
  });
});

const storeCodeVerifier = (verifier) => {
  fs.writeFileSync(codeVerifierFilePath, verifier);
};

const retrieveCodeVerifier = () => {
  return fs.readFileSync(codeVerifierFilePath, 'utf8');
};

const createCodeChallenge = (verifier) => {
  return crypto.createHash('sha256').update(verifier).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
