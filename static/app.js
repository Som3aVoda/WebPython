(() => {
  // Preserve existing admin filtering.
  const adminFilter = document.getElementById('adminFilter');
  if (adminFilter) adminFilter.addEventListener('input', () => {
    const q = adminFilter.value.trim().toLowerCase();
    document.querySelectorAll('#adminRows tr').forEach(row => row.hidden = !row.dataset.title.includes(q));
  });
  const relationshipSearch = document.getElementById('relationshipSearch');
  const relationshipList = document.getElementById('relationshipList');
  const relationshipCount = document.getElementById('relationshipCount');
  if (relationshipList) {
    const updateCount = () => {
      const count = relationshipList.querySelectorAll('input[type="checkbox"]:checked').length;
      if (relationshipCount) relationshipCount.textContent = `${count} selected`;
    };
    relationshipList.addEventListener('change', updateCount);
    relationshipSearch?.addEventListener('input', () => {
      const q = relationshipSearch.value.trim().toLowerCase();
      relationshipList.querySelectorAll('.relationship-option').forEach(item => item.hidden = !item.dataset.title.includes(q));
    });
    updateCount();
  }

  const KEY = 'tvhome_continue_watching_v1', LIMIT = 12;
  const read = () => { try { const a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (_) { return []; } };
  const write = a => { try { localStorage.setItem(KEY, JSON.stringify(a.slice(0, LIMIT))); } catch (_) {} };
  const save = item => { if (!item || !item.id) return; const a = read().filter(x => String(x.id) !== String(item.id)); a.unshift({...item, updatedAt:Date.now()}); write(a); };
  const remove = id => write(read().filter(x => String(x.id) !== String(id)));

  // Render Continue Watching on homepage.
  const section = document.getElementById('continue-watching'), list = document.getElementById('continueWatchingList');
  if (section && list) {
    const history = read();
    history.forEach(item => {
      const card = document.createElement('article'); card.className = 'continue-card';
      const poster = document.createElement('a'); poster.className = 'continue-poster'; poster.href = item.page || '#';
      if (item.poster) { const img = document.createElement('img'); img.src = item.poster; img.alt = ''; img.loading = 'lazy'; img.onerror = () => { img.remove(); poster.classList.add('poster-no-image'); }; poster.appendChild(img); }
      else { poster.classList.add('poster-no-image'); const initial = document.createElement('span'); initial.textContent = (item.title || 'T').slice(0,1).toUpperCase(); poster.appendChild(initial); }
      const play = document.createElement('span'); play.className = 'continue-play'; play.textContent = '▶'; poster.appendChild(play);
      const info = document.createElement('div'); info.className = 'continue-info';
      const title = document.createElement('a'); title.className = 'continue-title'; title.href = item.page || '#'; title.textContent = item.title || 'Untitled';
      const meta = document.createElement('p'); meta.className = 'continue-meta';
      const ep = []; if (item.season) ep.push(`Season ${item.season}`); if (item.episode) ep.push(`Episode ${item.episode}`);
      meta.textContent = ep.length ? ep.join(' · ') : (item.position > 0 ? `${Math.floor(item.position/60)} min watched` : 'Recently opened');
      const progress = document.createElement('div'); progress.className = 'continue-progress';
      if (item.duration > 0 && item.position > 0) { const bar = document.createElement('span'); bar.style.width = `${Math.min(100,item.position/item.duration*100)}%`; progress.appendChild(bar); }
      else progress.classList.add('progress-unknown');
      const actions = document.createElement('div'); actions.className = 'continue-actions';
      const resume = document.createElement('a'); resume.className = 'continue-resume'; resume.href = item.page || '#'; resume.textContent = 'Continue';
      const del = document.createElement('button'); del.type = 'button'; del.className = 'continue-remove'; del.textContent = 'Remove';
      del.addEventListener('click', () => { remove(item.id); card.remove(); if (!list.children.length) section.hidden = true; });
      actions.append(resume, del); info.append(title, meta, progress, actions); card.append(poster, info); list.appendChild(card);
    });
    if (history.length) section.hidden = false;
    document.getElementById('clearWatchHistory')?.addEventListener('click', () => { try { localStorage.removeItem(KEY); } catch (_) {} list.replaceChildren(); section.hidden = true; });
  }

  // Player page. Exact time tracking works only for direct video files.
  const watch = document.getElementById('watch-section');
  if (watch) {
    const iframe = document.getElementById('video-player'), video = document.getElementById('tvhome-video-player');
    const note = document.getElementById('watchProgressNote'), buttons = [...document.querySelectorAll('.server-button')];
    const item = {id:watch.dataset.watchId,title:watch.dataset.watchTitle,poster:watch.dataset.watchPoster,page:watch.dataset.watchPage,media:watch.dataset.watchMedia,season:watch.dataset.watchSeason,episode:watch.dataset.watchEpisode,position:0,duration:0,mode:'embed'};
    const saved = () => read().find(x => String(x.id) === String(item.id));
    const direct = u => { try { return /\.(mp4|webm|ogv|ogg)$/i.test(new URL(u,location.href).pathname); } catch (_) { return false; } };
    const savePosition = () => { if (video && !video.hidden && Number.isFinite(video.currentTime)) { item.position = Math.floor(video.currentTime || 0); item.duration = Math.floor(video.duration || 0); item.mode = 'direct'; } save(item); };
    const activate = url => {
      if (!url) return;
      const prior = saved();
      if (direct(url) && video) {
        if (iframe) { iframe.hidden = true; iframe.src = 'about:blank'; }
        video.hidden = false;
        if (video.src !== new URL(url,location.href).href) { video.src = url; video.load(); }
        item.mode = 'direct';
        if (note) note.textContent = 'Playback position is saved automatically on this browser.';
        const pos = prior && prior.mode === 'direct' ? Number(prior.position) || 0 : 0;
        if (pos > 5) video.addEventListener('loadedmetadata', () => { if (video.duration && pos < video.duration - 10) video.currentTime = pos; }, {once:true});
        save(item);
      } else {
        if (video) { video.pause(); video.hidden = true; video.removeAttribute('src'); video.load(); }
        if (iframe) { iframe.hidden = false; iframe.src = url; }
        item.mode = 'embed'; item.position = 0; item.duration = 0; save(item);
        if (note) note.textContent = 'This is an embedded player. TVhome can remember this episode, but cannot read its exact playback time unless the provider supplies a player API.';
      }
    };
    if (video) {
      video.addEventListener('timeupdate', () => { if (!video.paused && video.duration) savePosition(); });
      video.addEventListener('pause', savePosition);
      video.addEventListener('ended', () => remove(item.id));
      window.addEventListener('pagehide', savePosition);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') savePosition(); });
    }
    window.changeServer = button => {
      buttons.forEach(b => { b.classList.remove('button-primary'); b.classList.add('button-ghost'); });
      button.classList.remove('button-ghost'); button.classList.add('button-primary'); item.serverUrl = button.dataset.serverUrl; activate(button.dataset.serverUrl);
    };
    const first = buttons[0];
    if (first) {
      const prior = saved();
      const selected = buttons.find(b => prior && prior.serverUrl === b.dataset.serverUrl) || first;
      item.serverUrl = selected.dataset.serverUrl; activate(selected.dataset.serverUrl);
    }
  }
})();
