const songSlider = document.getElementById("song-slider");
const playButton = document.getElementById("play-button");
const playButtonIcon = document.getElementById("play-button-icon");
const albumArt = document.getElementById("album-art");
const nextButton = document.getElementById("next-button");
const previousButton = document.getElementById("previous-button");
const songName = document.getElementById("song-name");
const artistName = document.getElementById("artist-name");
const shuffleButton = document.getElementById("shuffle-button");
const shuffleButtonIcon = document.getElementById("shuffle-button-icon");
const volumeButton = document.getElementById("volume-button");
const volumeSlider = document.getElementById("volume-slider");
const repeatButton = document.getElementById("repeat-button");
const repeatButtonIcon = document.getElementById("repeat-button-icon");
const currentTime = document.getElementById("current-time");
const duration = document.getElementById("duration");
const likeButton = document.getElementById("like-button");
const likeButtonIcon = document.getElementById("like-button-icon");
const menuButton = document.getElementById("menu-button");

let isSeeking = false;
let isChangingVolume = false;
let userInteracting = false;

function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

async function getPlayerData() {
  try {
    const response = await fetch("https://api.spotify.com/v1/me/player", {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + currentToken.access_token },
    });

    return await response.json();
  } catch (e) {
    console.log("Error fetching player data: ", e);
    // setTimeout(getPlayerData, 5000);
  }
}

function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

function checkLiked(trackId) {
    fetch(`https://api.spotify.com/v1/me/tracks/contains?ids=${trackId}`, {
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + currentToken.access_token },
    }).then(response => {
        response.json().then(data => {
            if (data[0]) {
                likeButton.classList.add("active");
                likeButtonIcon.src = "icons/like-button-active.png";
            } else {
                likeButton.classList.remove("active");
                likeButtonIcon.src = "icons/like-button.png";
            }
        });
    });
}

// Update the UI with player data
async function updatePlayerData() {
  if (userInteracting) return; // Skip updating if the user is interacting

  const playerData = await getPlayerData();

  if (playerData) {
    playButtonIcon.src = playerData.is_playing ? "icons/pause-button.png" : "icons/play-button.png";

    if (!isSeeking) {
      songSlider.max = playerData.item.duration_ms;
      songSlider.value = playerData.progress_ms;
      progressSlider(songSlider);
    }
    currentTime.innerHTML = formatTime(playerData.progress_ms);


    const newSong = playerData.item.name !== songName.innerHTML;
    if (newSong) {
        duration.innerHTML = formatTime(playerData.item.duration_ms);
        albumArt.style.backgroundImage = `url(${playerData.item.album.images[0].url})`;
        songName.innerHTML = playerData.item.name;
        artistName.innerHTML = playerData.item.artists.map(artist => artist.name).join(", ");
        checkLiked(playerData.item.id);
    }

    if (!isChangingVolume) {
      volumeSlider.value = playerData.device.volume_percent;
      progressSlider(volumeSlider);
    }

    if (playerData.shuffle_state) {
      shuffleButton.classList.add("active");
      shuffleButtonIcon.src = "icons/shuffle-button-active.png";
    } else {
      shuffleButton.classList.remove("active");
      shuffleButtonIcon.src = "icons/shuffle-button.png";
    }

    if (playerData.repeat_state !== 'off') {
      repeatButtonIcon.classList.add("active");
      repeatButtonIcon.src = "icons/repeat-button-active.png";
    } else {
      repeatButtonIcon.classList.remove("active");
      repeatButtonIcon.src = "icons/repeat-button.png";
    }
  }

  setTimeout(updatePlayerData, 1000);
}

function progressSlider(slider) {
  const sliderPercent = (slider.value / slider.max) * 100;
  slider.style.background = `linear-gradient(to right, #1bcf62 ${sliderPercent}%, #ccc ${sliderPercent}%)`;
}


// Event Listeners for player controls
document.addEventListener('DOMContentLoaded', () => {
  playButton.addEventListener("click", togglePlayback);
  nextButton.addEventListener("click", skipToNextTrack);
  previousButton.addEventListener("click", skipToPreviousTrack);
  volumeButton.addEventListener("click", () => volumeSlider.classList.toggle("hidden"));
  likeButton.addEventListener("click", likeTrack);

  volumeSlider.addEventListener("input", () => {
    userInteracting = true;
    progressSlider(volumeSlider);
    throttledChangeVolume();
  });

  songSlider.addEventListener("input", () => {
    userInteracting = true;
    progressSlider(songSlider);
    throttledSeekTrack();
  });

  shuffleButton.addEventListener("click", toggleShuffle);
  repeatButton.addEventListener("click", toggleRepeat);

  if (currentToken.access_token) {
    document.getElementById("song-container").style.display = 'flex';
    try {
        updatePlayerData();
    } catch (e) {
        console.log("Error updating player data: ", e);
    }
  } else {
    console.log("No access token found, please log in.");
  }
});

const throttledChangeVolume = throttle(changeVolume, 300);
const throttledSeekTrack = throttle(seekTrack, 300);

// Toggle playback (play/pause)
async function togglePlayback() {
  const isPlaying = playButtonIcon.src.includes("pause");
  const endpoint = isPlaying ? "https://api.spotify.com/v1/me/player/pause" : "https://api.spotify.com/v1/me/player/play";

  try {
    await fetch(endpoint, {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer ' + currentToken.access_token }
    });
    playButtonIcon.src = isPlaying ? "icons/play-button.png" : "icons/pause-button.png";
  } catch (error) {
    console.error('Error toggling playback:', error);
  }
}

// Skip to next track
async function skipToNextTrack() {
  try {
    const response = await fetch("https://api.spotify.com/v1/me/player/next", {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + currentToken.access_token },
    });
    if (!response.ok) throw new Error('Failed to skip to next track');
  } catch (error) {
    console.error(error);
  }
}

// Skip to previous track
async function skipToPreviousTrack() {
  try {
    const response = await fetch("https://api.spotify.com/v1/me/player/previous", {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + currentToken.access_token },
    });
    if (!response.ok) throw new Error('Failed to skip to previous track');
  } catch (error) {
    console.error(error);
  }
}

// Change volume
async function changeVolume() {
  isChangingVolume = true;
  try {
    const response = await fetch(`https://api.spotify.com/v1/me/player/volume?volume_percent=${volumeSlider.value}`, {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer ' + currentToken.access_token },
    });
    if (!response.ok) throw new Error('Failed to change volume');
  } catch (error) {
    console.error(error);
  } finally {
    isChangingVolume = false;
  }
}

// Seek track position
async function seekTrack() {
  isSeeking = true;
  try {
    const response = await fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${songSlider.value}`, {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer ' + currentToken.access_token },
    });
    if (!response.ok) throw new Error('Failed to seek track');
  } catch (error) {
    console.error(error);
  } finally {
    isSeeking = false;
  }
}

// Toggle shuffle state
async function toggleShuffle() {
  try {
    const shuffleState = shuffleButtonIcon.classList.contains("active") ? 'false' : 'true';
    const response = await fetch(`https://api.spotify.com/v1/me/player/shuffle?state=${shuffleState}`, {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer ' + currentToken.access_token },
    });
    if (!response.ok) throw new Error('Failed to toggle shuffle');
    shuffleButtonIcon.classList.toggle("active");
    shuffleButtonIcon.src = shuffleButtonIcon.src.includes("active") ? "icons/shuffle-button.png" : "icons/shuffle-button-active.png";
  } catch (error) {
    console.error(error);
  }
}

// Toggle repeat state
async function toggleRepeat() {
  try {
    const repeatState = repeatButtonIcon.classList.contains("active") ? 'off' : 'context';
    const response = await fetch(`https://api.spotify.com/v1/me/player/repeat?state=${repeatState}`, {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer ' + currentToken.access_token },
    });
    if (!response.ok) throw new Error('Failed to toggle repeat');
    repeatButtonIcon.classList.toggle("active");
    repeatButtonIcon.src = repeatButtonIcon.src.includes("active") ? "icons/repeat-button.png" : "icons/repeat-button-active.png";
  } catch (error) {
    console.error(error);
  }
}

// Toggle like track
async function likeTrack() {
    try {
        const isLiked = likeButton.classList.contains("active");
        const trackId = (await getPlayerData()).item.id;
        const response = await fetch(`https://api.spotify.com/v1/me/tracks?ids=${trackId}`, {
            method: isLiked ? 'DELETE' : 'PUT',
            headers: { 'Authorization': 'Bearer ' + currentToken.access_token },
        });
        if (!response.ok) throw new Error('Failed to like track');
        likeButton.classList.toggle("active");
        likeButtonIcon.src = likeButtonIcon.src.includes("active") ? "icons/like-button.png" : "icons/like-button-active.png";
    } catch (error) {
        console.error(error);
    }
}