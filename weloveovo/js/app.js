(() => {
  'use strict';
  const songs = Array.isArray(window.DRAKE_SONGS) ? window.DRAKE_SONGS : [];
  const artwork = window.DRAKE_ARTWORK || {};
  const $ = (selector) => document.querySelector(selector);
  const esc = (value = '') => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const yearOf = song => Number(String(song.albumDate || '').slice(0, 4)) || 0;
  const keyOf = song => song.spotifyTrackId || `${song.album}:${song.song}`;
  const explicit = song => String(song.explicit).toLowerCase() === 'yes';
  const PAGE_SIZE = 12;
  const state = {page: 1, savedOnly: false, mood: '', era: null};
  const controls = {search: $('#searchInput'), album: $('#albumFilter'), year: $('#yearFilter'), sort: $('#sortFilter'), explicit: $('#explicitToggle')};
  let favorites = new Set();
  let toastTimer;
  let openedSong = null;
  let modalTrigger = null;
  let storageAvailable = true;
  try {
    const stored = JSON.parse(localStorage.getItem('weloveovo.favorites') || '[]');
    if (Array.isArray(stored)) favorites = new Set(stored.filter(value => typeof value === 'string'));
  } catch { storageAvailable = false; }
  const validKeys = new Set(songs.map(keyOf));
  favorites = new Set([...favorites].filter(key => validKeys.has(key)));

  const eras = [
    {years: '2009–2010', label: 'The introduction', range: [2009, 2010], album: 'So Far Gone', title: 'A voice from somewhere different.', text: 'Before the arena anthems, there was the mixtape feeling: intimate, restless, and full of possibility. So Far Gone introduced a world where rap ambition and R&B vulnerability could share the same room. Thank Me Later brought that world into sharper focus.', song: 'Best I Ever Had'},
    {years: '2011–2013', label: 'The blue hour', range: [2011, 2013], album: 'Take Care (Deluxe)', title: 'The feelings got a little louder.', text: 'Take Care turned the lights down. Nothing Was the Same sharpened the silhouette. Between them: spacious production, unguarded melodies, and the tension between wanting everything and wondering what it costs.', song: 'Marvins Room'},
    {years: '2014–2015', label: 'The statement', range: [2014, 2015], album: "If You're Reading This It's Too Late", title: 'Something to prove. Nothing to lose.', text: 'The voice became leaner, the drums more urgent. If You’re Reading This It’s Too Late captured a colder, more confrontational mood; What a Time to Be Alive took that momentum into a full-length collaboration with Future.', song: 'Know Yourself'},
    {years: '2016–2018', label: 'The whole world', range: [2016, 2018], album: 'Views', title: 'The city became the center.', text: 'Views made the skyline an icon. More Life let the sound travel. Scorpion stretched across two sides of the same artist. Dance-floor warmth and late-night introspection became parts of one sprawling world.', song: 'Passionfruit'},
    {years: '2019–2022', label: 'New frequencies', range: [2019, 2022], album: 'Honestly, Nevermind', title: 'No single lane could hold it.', text: 'Loose ends became Care Package. Dark Lane Demo Tapes opened another drawer. Certified Lover Boy, the dance-led Honestly, Nevermind, and the 21 Savage collaboration Her Loss kept shifting the shape of the catalog.', song: 'Massive'},
    {years: '2023–2026', label: 'Still unfolding', range: [2023, 2026], album: 'For All The Dogs', title: 'The story keeps finding new rooms.', text: 'For All the Dogs and its Scary Hours extension revisited familiar tensions. A PARTYNEXTDOOR collaboration followed in 2025; the 2026 releases ICEMAN, HABIBTI, and MAID OF HONOUR open the next chapter. There is always another version to discover.', song: 'Virginia Beach'}
  ];
  const releases = ['So Far Gone', 'Thank Me Later', 'Take Care (Deluxe)', 'Nothing Was The Same (Deluxe)', "If You're Reading This It's Too Late", 'What A Time To Be Alive', 'Views', 'More Life', 'Scorpion', 'Care Package', 'Dark Lane Demo Tapes', 'Certified Lover Boy', 'Honestly, Nevermind', 'Her Loss', 'For All The Dogs', 'For All The Dogs Scary Hours Edition', '$ome $exy $ongs 4 U', 'ICEMAN', 'HABIBTI', 'MAID OF HONOUR'];
  const moodNames = {night: 'After hours', drive: 'The long way home', energy: 'Headlines'};
  const moodMatches = {
    night: song => Number(song.energy) <= 50 && Number(song.valence) <= 50,
    drive: song => Number(song.dance) >= 65 && Number(song.energy) >= 40 && Number(song.energy) <= 75,
    energy: song => Number(song.energy) >= 70
  };

  function cover(album, className = '', lazy = true) {
    return artwork[album] ? `<img class="${className}" src="${esc(artwork[album].image)}" alt="${esc(album)} cover" ${lazy ? 'loading="lazy"' : ''} width="600" height="600" />` : `<span class="${className || 'track-thumb'}" aria-hidden="true">6</span>`;
  }
  function notify(message) {
    $('#toast').textContent = message;
    $('#toast').classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 2800);
  }
  function updateFavoriteCount() { $('#savedCount').textContent = favorites.size; }
  function toggleFavorite(song) {
    const key = keyOf(song);
    const adding = !favorites.has(key);
    if (adding) favorites.add(key); else favorites.delete(key);
    try { localStorage.setItem('weloveovo.favorites', JSON.stringify([...favorites])); storageAvailable = true; }
    catch { storageAvailable = false; }
    updateFavoriteCount();
    notify(`${adding ? 'Added to your favorites' : 'Removed from your favorites'}${storageAvailable ? '' : ' · saved for this visit only'}`);
    render();
    if (openedSong) updateModalFavorite();
  }
  function initEras() {
    $('#eraTabs').innerHTML = eras.map((era, i) => `<button class="era-tab" id="eraTab${i}" role="tab" aria-controls="eraPanel" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-era="${i}">${era.years}<span>${era.label}</span></button>`).join('');
    $('#eraTabs').addEventListener('click', e => {
      const tab = e.target.closest('[data-era]');
      if (tab) selectEra(Number(tab.dataset.era));
    });
    $('#eraTabs').addEventListener('keydown', e => {
      const current = Number(e.target.closest('[data-era]')?.dataset.era);
      if (!Number.isInteger(current)) return;
      let next = current;
      if (e.key === 'ArrowRight') next = (current + 1) % eras.length;
      else if (e.key === 'ArrowLeft') next = (current - 1 + eras.length) % eras.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = eras.length - 1;
      else return;
      e.preventDefault(); selectEra(next); $(`#eraTab${next}`).focus();
    });
    selectEra(0);
  }
  function selectEra(index) {
    const era = eras[index];
    document.querySelectorAll('.era-tab').forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === index)); tab.tabIndex = i === index ? 0 : -1;
    });
    $('#eraPanel').setAttribute('aria-labelledby', `eraTab${index}`);
    const song = songs.find(s => s.song.toLowerCase() === era.song.toLowerCase()) || songs.find(s => s.album === era.album);
    $('#eraPanel').innerHTML = `<div class="era-art" data-year="${era.range[0]}">${cover(era.album, '', false)}<span class="art-stamp mono">SIDE ${String(index + 1).padStart(2, '0')} / ${era.years}</span></div><div class="era-copy"><p class="eyebrow">CHAPTER ${String(index + 1).padStart(2, '0')} — ${era.label.toUpperCase()}</p><h3>${era.title}</h3><p>${era.text}</p>${song ? `<button class="era-song" data-track="${songs.indexOf(song)}" style="width:100%;background:none;border-inline:0;text-align:left"><span class="circle-button" aria-hidden="true">↗</span><span><small>START WITH THIS ONE</small><span>${esc(song.song)}</span></span></button>` : ''}<button class="era-link" id="exploreEra">Explore the ${era.years} chapter ↗</button></div>`;
    $('#exploreEra').addEventListener('click', () => {
      resetFilters(false); state.era = index; render(); goToArchive();
    });
  }
  function initRecords() {
    $('#recordShelf').innerHTML = releases.filter(album => songs.some(s => s.album === album)).map(album => {
      const albumSongs = songs.filter(s => s.album === album);
      const year = Math.min(...albumSongs.map(yearOf));
      return `<button class="record-card" data-album="${esc(album)}" aria-label="Explore ${esc(album)}"><span class="record-cover">${cover(album)}<span class="record-open" aria-hidden="true">↗</span></span><span class="record-title">${esc(album.replace(' (Deluxe)', ''))}</span><span class="record-meta">${year} &nbsp; / &nbsp; ${albumSongs.length} TRACKS IN THE COLLECTION</span></button>`;
    }).join('');
    $('#recordShelf').addEventListener('click', e => {
      const button = e.target.closest('[data-album]');
      if (!button) return;
      resetFilters(false); controls.album.value = button.dataset.album; render(); goToArchive();
    });
    const shelf = $('#recordShelf');
    const updateArrows = () => {
      $('#shelfPrev').disabled = shelf.scrollLeft < 2;
      $('#shelfNext').disabled = shelf.scrollLeft + shelf.clientWidth >= shelf.scrollWidth - 2;
    };
    $('#shelfPrev').addEventListener('click', () => shelf.scrollBy({left: -shelf.clientWidth, behavior: 'smooth'}));
    $('#shelfNext').addEventListener('click', () => shelf.scrollBy({left: shelf.clientWidth, behavior: 'smooth'}));
    shelf.addEventListener('scroll', updateArrows, {passive: true});
    window.addEventListener('resize', updateArrows);
    updateArrows();
  }
  function goToArchive() {
    $('#archive').scrollIntoView({behavior: 'smooth'});
    $('#archiveTitle').setAttribute('tabindex', '-1');
    $('#archiveTitle').focus({preventScroll: true});
  }
  function initFilters() {
    const albums = [...new Set(songs.map(s => s.album).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const years = [...new Set(songs.map(yearOf).filter(Boolean))].sort((a, b) => b - a);
    controls.album.insertAdjacentHTML('beforeend', albums.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join(''));
    controls.year.insertAdjacentHTML('beforeend', years.map(y => `<option value="${y}">${y}</option>`).join(''));
  }
  function getFiltered() {
    const query = controls.search.value.trim().toLowerCase();
    return songs.filter(song => {
      if (query && !`${song.song} ${song.artist} ${song.album}`.toLowerCase().includes(query)) return false;
      if (controls.album.value !== 'all' && song.album !== controls.album.value) return false;
      if (controls.year.value !== 'all' && yearOf(song) !== Number(controls.year.value)) return false;
      if (controls.explicit.checked && explicit(song)) return false;
      if (state.savedOnly && !favorites.has(keyOf(song))) return false;
      if (state.mood && !moodMatches[state.mood](song)) return false;
      if (state.era !== null) {
        const range = eras[state.era].range;
        if (yearOf(song) < range[0] || yearOf(song) > range[1]) return false;
      }
      return true;
    }).sort((a, b) => {
      if (controls.sort.value === 'newest') return String(b.albumDate).localeCompare(String(a.albumDate)) || a.rank - b.rank;
      if (controls.sort.value === 'oldest') return String(a.albumDate).localeCompare(String(b.albumDate)) || a.rank - b.rank;
      if (controls.sort.value === 'title') return a.song.localeCompare(b.song);
      if (controls.sort.value === 'popularity') return Number(b.popularity) - Number(a.popularity);
      if (controls.sort.value === 'energy') return Number(b.energy) - Number(a.energy);
      return a.rank - b.rank;
    });
  }
  function render() {
    const filtered = getFiltered();
    const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    state.page = Math.max(1, Math.min(state.page, pages));
    const start = (state.page - 1) * PAGE_SIZE;
    $('#resultStatus').textContent = filtered.length ? `${start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)} OF ${filtered.length} TRACKS` : '0 TRACKS';
    $('#emptyState').hidden = filtered.length !== 0;
    $('#emptyMessage').textContent = state.savedOnly && !favorites.size ? 'Tap a heart beside any track to make this space yours.' : 'Try another search, or reset your filters.';
    $('#allTracks').classList.toggle('active', !state.savedOnly);
    $('#savedTracks').classList.toggle('active', state.savedOnly);
    $('#allTracks').setAttribute('aria-pressed', String(!state.savedOnly));
    $('#savedTracks').setAttribute('aria-pressed', String(state.savedOnly));
    $('#activeMood').hidden = !state.mood && state.era === null;
    $('#activeMood').textContent = state.mood ? `FREQUENCY: ${moodNames[state.mood].toUpperCase()}` : state.era !== null ? `CHAPTER: ${eras[state.era].years}` : '';
    $('#trackList').innerHTML = filtered.slice(start, start + PAGE_SIZE).map((song, i) => {
      const index = songs.indexOf(song);
      const saved = favorites.has(keyOf(song));
      return `<div class="track-row"><span class="track-number">${String(start + i + 1).padStart(2, '0')}</span><button class="track-open" data-track="${index}" aria-label="Open ${esc(song.song)} by ${esc(song.artist)}">${cover(song.album)}<span class="track-text"><span class="track-title">${esc(song.song)}${explicit(song) ? '<span class="explicit-badge" aria-label="Explicit">E</span>' : ''}</span><span class="track-artist">${esc(song.artist)}</span></span></button><span class="track-album">${esc(song.album)}</span><span class="track-year">${yearOf(song) || '—'}</span><span class="track-time">${esc(song.duration)}</span><button class="save-button" data-save="${index}" aria-label="Favorite ${esc(song.song)}" aria-pressed="${saved}">${saved ? '♥' : '♡'}</button></div>`;
    }).join('');
    renderPagination(pages);
  }
  function renderPagination(total) {
    if (total <= 1) { $('#pagination').innerHTML = ''; return; }
    const pages = [...new Set([1, total, state.page - 1, state.page, state.page + 1].filter(p => p >= 1 && p <= total))].sort((a, b) => a - b);
    let previous = 0;
    const buttons = [`<button class="page-btn" data-page="${state.page - 1}" ${state.page === 1 ? 'disabled' : ''} aria-label="Previous page">←</button>`];
    pages.forEach(page => {
      if (previous && page - previous > 1) buttons.push('<span class="page-gap">…</span>');
      buttons.push(`<button class="page-btn ${page === state.page ? 'active' : ''}" data-page="${page}" ${page === state.page ? 'aria-current="page"' : ''} aria-label="Page ${page}">${page}</button>`);
      previous = page;
    });
    buttons.push(`<button class="page-btn" data-page="${state.page + 1}" ${state.page === total ? 'disabled' : ''} aria-label="Next page">→</button>`);
    $('#pagination').innerHTML = buttons.join('');
  }
  function resetFilters(shouldRender = true) {
    controls.search.value = ''; controls.album.value = 'all'; controls.year.value = 'all'; controls.sort.value = 'rank'; controls.explicit.checked = false;
    Object.assign(state, {page: 1, savedOnly: false, mood: '', era: null});
    if (shouldRender) render();
  }
  function featureBar(label, value) {
    const number = Math.max(0, Math.min(100, Number(value) || 0));
    return `<div class="feature-row"><span>${label}</span><span class="feature-track" aria-hidden="true"><i style="width:${number}%"></i></span><span>${number}</span></div>`;
  }
  function updateModalFavorite() {
    const saved = favorites.has(keyOf(openedSong));
    $('#modalFavorite').textContent = saved ? '♥ In your favorites' : '♡ Add to favorites';
    $('#modalFavorite').setAttribute('aria-pressed', String(saved));
  }
  function openTrack(song, trigger) {
    if (!song) return;
    openedSong = song;
    modalTrigger = trigger || document.activeElement;
    const spotify = /^[a-zA-Z0-9]{22}$/.test(song.spotifyTrackId) ? `https://open.spotify.com/track/${song.spotifyTrackId}` : '';
    const apple = artwork[song.album]?.url || `https://music.apple.com/us/search?term=${encodeURIComponent(`${song.song} Drake`)}`;
    $('#modalContent').innerHTML = `<article class="modal-body"><div class="modal-top">${cover(song.album, 'modal-cover', false)}<div><p class="modal-kicker">IN YOUR ROTATION / ${yearOf(song)}</p><h3 id="modalTitle">${esc(song.song)}</h3><p class="modal-artist">${esc(song.artist)}${explicit(song) ? ' · Explicit' : ''}</p></div></div><div class="modal-meta"><div><span>THE RECORD</span><b>${esc(song.album)}</b></div><div><span>RELEASED</span><b>${esc(song.albumDate)}</b></div><div><span>TIME / TEMPO</span><b>${esc(song.duration)} / ${Number(song.bpm) || '—'} BPM</b></div></div><p class="eyebrow">THE FEEL OF THE TRACK</p><div class="feature-bars">${featureBar('Energy', song.energy)}${featureBar('Danceability', song.dance)}${featureBar('Brightness', song.valence)}${featureBar('Acoustic', song.acoustic)}</div><div class="modal-actions">${spotify ? `<a class="solid-button" href="${spotify}" target="_blank" rel="noopener">Listen on Spotify ↗</a>` : ''}<a class="solid-button secondary" href="${esc(apple)}" target="_blank" rel="noopener">Apple Music ↗</a><button class="solid-button secondary" id="modalFavorite" aria-pressed="false"></button></div><p class="modal-foot">Listening opens in your music service. Favorites stay in this browser.</p></article>`;
    updateModalFavorite();
    $('#modalFavorite').addEventListener('click', () => toggleFavorite(song));
    $('#trackModal').showModal();
    $('#modalClose').focus();
  }
  function bindEvents() {
    Object.entries(controls).forEach(([name, control]) => control.addEventListener(name === 'search' ? 'input' : 'change', () => {state.page = 1; render();}));
    $('#clearFilters').addEventListener('click', () => resetFilters());
    $('#emptyReset').addEventListener('click', () => resetFilters());
    $('#allTracks').addEventListener('click', () => {state.savedOnly = false; state.page = 1; render();});
    $('#savedTracks').addEventListener('click', () => {state.savedOnly = true; state.page = 1; render();});
    $('#randomTrack').addEventListener('click', e => openTrack(songs[Math.floor(Math.random() * songs.length)], e.currentTarget));
    document.addEventListener('click', e => {
      const track = e.target.closest('[data-track]');
      const save = e.target.closest('[data-save]');
      if (track) openTrack(songs[Number(track.dataset.track)], track);
      if (save) {
        const index = Number(save.dataset.save);
        toggleFavorite(songs[index]);
        const nextFocus = $(`[data-save="${index}"]`) || $('#savedTracks');
        nextFocus.focus({preventScroll: true});
      }
    });
    document.querySelectorAll('[data-mood]').forEach(button => button.addEventListener('click', () => {
      resetFilters(false); state.mood = button.dataset.mood; render(); goToArchive();
    }));
    $('#pagination').addEventListener('click', e => {
      const button = e.target.closest('[data-page]');
      if (!button || button.disabled) return;
      state.page = Number(button.dataset.page); render();
      $('#pagination [aria-current="page"]').focus({preventScroll: true});
      $('.table-wrap').scrollIntoView({behavior: 'smooth', block: 'start'});
    });
    $('#modalClose').addEventListener('click', () => $('#trackModal').close());
    $('#trackModal').addEventListener('click', e => {
      const bounds = $('#trackModal').getBoundingClientRect();
      if (e.target === $('#trackModal') && (e.clientX < bounds.left || e.clientX > bounds.right || e.clientY < bounds.top || e.clientY > bounds.bottom)) $('#trackModal').close();
    });
    $('#trackModal').addEventListener('close', () => {
      openedSong = null;
      if (modalTrigger?.isConnected) modalTrigger.focus({preventScroll: true});
      else controls.search.focus({preventScroll: true});
    });
    document.addEventListener('keydown', e => {
      const editing = e.target.closest('input, textarea, select, [contenteditable="true"]');
      if (e.key === '/' && !editing && !$('#trackModal').open) {e.preventDefault(); controls.search.focus();}
    });
  }
  function updateClock() {
    const now = new Date();
    $('#torontoClock').dateTime = now.toISOString();
    $('#torontoClock').textContent = new Intl.DateTimeFormat('en-US', {timeZone: 'America/Toronto', hour: '2-digit', minute: '2-digit', hour12: false}).format(now);
  }
  $('#songCount').textContent = songs.length.toLocaleString();
  updateClock(); setInterval(updateClock, 60000);
  initEras(); initRecords(); initFilters(); bindEvents(); updateFavoriteCount(); render();
})();
