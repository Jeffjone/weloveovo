(() => {
  'use strict';

  const songs = Array.isArray(window.DRAKE_SONGS) ? window.DRAKE_SONGS : [];
  const PAGE_SIZE = 24;
  let currentPage = 1;

  const $ = (selector) => document.querySelector(selector);
  const els = {
    songCount: $('#songCount'), releaseCount: $('#releaseCount'), collabCount: $('#collabCount'), yearRange: $('#yearRange'),
    spotlightGrid: $('#spotlightGrid'), search: $('#searchInput'), album: $('#albumFilter'), year: $('#yearFilter'),
    sort: $('#sortFilter'), explicit: $('#explicitToggle'), clear: $('#clearFilters'), filteredCount: $('#filteredCount'),
    trackList: $('#trackList'), emptyState: $('#emptyState'), pagination: $('#pagination'), randomTrack: $('#randomTrack'),
    modal: $('#trackModal'), modalContent: $('#modalContent'), modalClose: $('#modalClose')
  };

  const esc = (value = '') => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const yearOf = (song) => Number(String(song.albumDate || '').slice(0, 4)) || 0;
  const drakeCredit = (song) => String(song.artist || '').split(',').map(s => s.trim()).some(a => a === 'Drake');

  function initStats() {
    const releases = new Set(songs.map(s => s.album).filter(Boolean));
    const artists = new Set();
    songs.forEach(s => String(s.artist || '').split(',').map(v => v.trim()).filter(Boolean).forEach(v => artists.add(v)));
    const years = songs.map(yearOf).filter(Boolean);
    els.songCount.textContent = songs.length.toLocaleString();
    els.releaseCount.textContent = releases.size.toLocaleString();
    els.collabCount.textContent = artists.size.toLocaleString();
    els.yearRange.textContent = years.length ? `${Math.min(...years)}—${Math.max(...years)}` : '—';
  }

  function average(field) {
    const vals = songs.map(s => Number(s[field])).filter(Number.isFinite);
    return vals.length ? Math.round(vals.reduce((a,b) => a+b, 0) / vals.length) : 0;
  }

  function initSpotlights() {
    const top = [...songs].sort((a,b) => b.popularity - a.popularity)[0];
    const highestEnergy = [...songs].sort((a,b) => b.energy - a.energy)[0];
    const albumCounts = songs.reduce((acc, s) => (acc[s.album] = (acc[s.album] || 0) + 1, acc), {});
    const largestRelease = Object.entries(albumCounts).sort((a,b) => b[1]-a[1])[0];
    const cards = [
      {index:'01 / POPULARITY', big: top ? esc(top.song) : '—', sub: top ? `${esc(top.artist)} · ${esc(top.album)}` : '', metric:'CSV popularity', value: top ? `${top.popularity}/100` : '—', accent:true},
      {index:'02 / AUDIO', big:`${average('bpm')} BPM`, sub:'Average tempo across every track in the supplied CSV.', metric:'Avg. energy', value:`${average('energy')}/100`},
      {index:'03 / RELEASE', big: largestRelease ? esc(largestRelease[0]) : '—', sub:'The release with the most tracks represented in this dataset.', metric:'Tracks indexed', value: largestRelease ? largestRelease[1] : '—'},
      {index:'04 / PEAK ENERGY', big: highestEnergy ? esc(highestEnergy.song) : '—', sub: highestEnergy ? `${esc(highestEnergy.artist)} · ${esc(highestEnergy.album)}` : '', metric:'Energy', value: highestEnergy ? `${highestEnergy.energy}/100` : '—'}
    ];
    els.spotlightGrid.innerHTML = cards.map(c => `
      <article class="spot-card reveal ${c.accent ? 'accent' : ''}">
        <span class="index">${c.index}</span>
        <div><div class="big">${c.big}</div><div class="sub">${c.sub}</div></div>
        <div class="metric"><span>${c.metric}</span><b>${c.value}</b></div>
      </article>`).join('');
  }

  function initFilters() {
    const albums = [...new Set(songs.map(s => s.album).filter(Boolean))].sort((a,b) => a.localeCompare(b));
    const years = [...new Set(songs.map(yearOf).filter(Boolean))].sort((a,b) => b-a);
    els.album.insertAdjacentHTML('beforeend', albums.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join(''));
    els.year.insertAdjacentHTML('beforeend', years.map(y => `<option value="${y}">${y}</option>`).join(''));
  }

  function getFiltered() {
    const q = els.search.value.trim().toLowerCase();
    let result = songs.filter(song => {
      const haystack = `${song.song} ${song.artist} ${song.album} ${song.genres}`.toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (els.album.value !== 'all' && song.album !== els.album.value) return false;
      if (els.year.value !== 'all' && yearOf(song) !== Number(els.year.value)) return false;
      if (els.explicit.checked && String(song.explicit).toLowerCase() === 'yes') return false;
      return true;
    });

    const sorter = els.sort.value;
    result.sort((a,b) => {
      if (sorter === 'popularity') return b.popularity - a.popularity || a.rank - b.rank;
      if (sorter === 'newest') return yearOf(b) - yearOf(a) || b.popularity - a.popularity;
      if (sorter === 'oldest') return yearOf(a) - yearOf(b) || a.rank - b.rank;
      if (sorter === 'title') return a.song.localeCompare(b.song);
      if (sorter === 'energy') return b.energy - a.energy;
      if (sorter === 'dance') return b.dance - a.dance;
      if (sorter === 'bpm') return b.bpm - a.bpm;
      return a.rank - b.rank;
    });
    return result;
  }

  function render() {
    const filtered = getFiltered();
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    currentPage = Math.min(currentPage, totalPages);
    const start = (currentPage - 1) * PAGE_SIZE;
    const page = filtered.slice(start, start + PAGE_SIZE);
    els.filteredCount.textContent = filtered.length.toLocaleString();
    els.emptyState.hidden = filtered.length !== 0;

    els.trackList.innerHTML = page.map((song, i) => `
      <button class="track-row" type="button" data-index="${songs.indexOf(song)}" aria-label="Open details for ${esc(song.song)}">
        <span class="track-number">${String(start + i + 1).padStart(2,'0')}</span>
        <span class="track-main">
          <span class="track-title">${esc(song.song)}${String(song.explicit).toLowerCase()==='yes' ? '<span class="explicit-badge">E</span>' : ''}</span>
          <span class="track-artist">${esc(song.artist)}</span>
        </span>
        <span class="track-album">${esc(song.album)}</span>
        <span class="track-year">${yearOf(song) || '—'}</span>
        <span class="track-pop">${song.popularity}<span class="pop-bar"><i style="width:${Math.max(0, Math.min(100, song.popularity))}%"></i></span></span>
        <span class="track-time">${esc(song.duration)}</span>
      </button>`).join('');

    els.trackList.querySelectorAll('.track-row').forEach(row => row.addEventListener('click', () => openTrack(songs[Number(row.dataset.index)])));
    renderPagination(totalPages);
  }

  function renderPagination(totalPages) {
    if (totalPages <= 1) { els.pagination.innerHTML = ''; return; }
    const pages = new Set([1, totalPages, currentPage, currentPage-1, currentPage+1].filter(p => p >= 1 && p <= totalPages));
    const sorted = [...pages].sort((a,b)=>a-b);
    const parts = [`<button class="page-btn" data-page="${currentPage-1}" ${currentPage===1?'disabled':''} aria-label="Previous page">←</button>`];
    let prev = 0;
    sorted.forEach(p => {
      if (prev && p - prev > 1) parts.push('<span class="page-gap">…</span>');
      parts.push(`<button class="page-btn ${p===currentPage?'active':''}" data-page="${p}">${p}</button>`);
      prev = p;
    });
    parts.push(`<button class="page-btn" data-page="${currentPage+1}" ${currentPage===totalPages?'disabled':''} aria-label="Next page">→</button>`);
    els.pagination.innerHTML = parts.join('');
    els.pagination.querySelectorAll('button[data-page]').forEach(btn => btn.addEventListener('click', () => {
      const p = Number(btn.dataset.page); if (p < 1 || p > totalPages) return; currentPage = p; render();
      document.querySelector('.table-wrap').scrollIntoView({behavior:'smooth', block:'start'});
    }));
  }

  function featureBar(name, value) {
    const n = Math.max(0, Math.min(100, Number(value) || 0));
    return `<div class="feature-row"><span>${name}</span><span class="feature-track"><i style="width:${n}%"></i></span><b>${n}</b></div>`;
  }

  function openTrack(song) {
    if (!song) return;
    const spotify = song.spotifyTrackId ? `https://open.spotify.com/track/${encodeURIComponent(song.spotifyTrackId)}` : '';
    els.modalContent.innerHTML = `
      <article class="modal-body">
        <div class="modal-kicker">TRACK FILE // ${String(song.rank).padStart(3,'0')}</div>
        <h3>${esc(song.song)}</h3>
        <p class="modal-artist">${esc(song.artist)}</p>
        <div class="modal-meta">
          <div><span>Release</span><b>${esc(song.album)}</b></div>
          <div><span>Date</span><b>${esc(song.albumDate)}</b></div>
          <div><span>BPM / Key</span><b>${song.bpm} · ${esc(song.key)}</b></div>
          <div><span>Duration</span><b>${esc(song.duration)}</b></div>
        </div>
        <div class="feature-bars">
          ${featureBar('Popularity', song.popularity)}
          ${featureBar('Energy', song.energy)}
          ${featureBar('Dance', song.dance)}
          ${featureBar('Valence', song.valence)}
          ${featureBar('Acoustic', song.acoustic)}
        </div>
        ${spotify ? `<a class="spotify-link" href="${spotify}" target="_blank" rel="noopener">Open on Spotify ↗</a>` : ''}
        <div class="modal-foot">
          ${esc(song.genres || 'Genre not listed')}<br>
          ${esc(song.label || '')}${song.isrc ? ` · ISRC ${esc(song.isrc)}` : ''}
        </div>
      </article>`;
    els.modal.showModal();
  }

  function resetFilters() {
    els.search.value=''; els.album.value='all'; els.year.value='all'; els.sort.value='rank'; els.explicit.checked=false; currentPage=1; render();
  }

  function bindEvents() {
    [els.search, els.album, els.year, els.sort, els.explicit].forEach(el => el.addEventListener(el === els.search ? 'input' : 'change', () => { currentPage=1; render(); }));
    els.clear.addEventListener('click', resetFilters);
    els.randomTrack.addEventListener('click', () => openTrack(songs[Math.floor(Math.random()*songs.length)]));
    els.modalClose.addEventListener('click', () => els.modal.close());
    els.modal.addEventListener('click', (e) => { if (e.target === els.modal) els.modal.close(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && !els.modal.open) { e.preventDefault(); els.search.focus(); }
      if (e.key === 'Escape' && els.modal.open) els.modal.close();
    });
  }

  function initReveal() {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
    }), {threshold:.08});
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  }

  initStats();
  initSpotlights();
  initFilters();
  bindEvents();
  render();
  initReveal();
})();
