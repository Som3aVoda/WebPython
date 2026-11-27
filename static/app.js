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
      relationshipList.querySelectorAll('.relationship-option').forEach(item => {
        item.hidden = !item.dataset.title.includes(q);
      });
    });

    updateCount();
  }

  const KEY = 'tvhome_continue_watching_v1';
  const LIMIT = 12;

  const read = () => {
    try {
      const a = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(a) ? a : [];
    } catch (_) {
      return [];
    }
  };

  const write = a => {
    try {
      localStorage.setItem(KEY, JSON.stringify(a.slice(0, LIMIT)));
    } catch (_) {}
  };

  const save = item => {
    if (!item || !item.id) return;

    const a = read().filter(x => String(x.id) !== String(item.id));
    a.unshift({ ...item, updatedAt: Date.now() });
    write(a);
  };

  const remove = id => {
    write(read().filter(x => String(x.id) !== String(id)));
  };

  // Render Continue Watching on homepage.
  const section = document.getElementById('continue-watching');
  const list = document.getElementById('continueWatchingList');

  if (section && list) {
    const history = read();

    history.forEach(item => {
      const card = document.createElement('article');
      card.className = 'continue-card';

      const poster = document.createElement('a');
      poster.className = 'continue-poster';
      poster.href = item.page || '#';

      if (item.poster) {
        const img = document.createElement('img');
        img.src = item.poster;
        img.alt = '';
        img.loading = 'lazy';

        img.onerror = () => {
          img.remove();
          poster.classList.add('poster-no-image');
        };

        poster.appendChild(img);
      } else {
        poster.classList.add('poster-no-image');

        const initial = document.createElement('span');
        initial.textContent = (item.title || 'T').slice(0, 1).toUpperCase();
        poster.appendChild(initial);
      }

      const play = document.createElement('span');
      play.className = 'continue-play';
      play.textContent = '▶';
      poster.appendChild(play);

      const info = document.createElement('div');
      info.className = 'continue-info';

      const title = document.createElement('a');
      title.className = 'continue-title';
      title.href = item.page || '#';
      title.textContent = item.title || 'Untitled';

      const meta = document.createElement('p');
      meta.className = 'continue-meta';

      const ep = [];

      if (item.season) ep.push(`Season ${item.season}`);
      if (item.episode) ep.push(`Episode ${item.episode}`);

      meta.textContent = ep.length
        ? ep.join(' · ')
        : (item.position > 0
          ? `${Math.floor(item.position / 60)} min watched`
          : 'Recently opened');

      const progress = document.createElement('div');
      progress.className = 'continue-progress';

      if (item.duration > 0 && item.position > 0) {
        const bar = document.createElement('span');
        bar.style.width = `${Math.min(100, item.position / item.duration * 100)}%`;
        progress.appendChild(bar);
      } else {
        progress.classList.add('progress-unknown');
      }

      const actions = document.createElement('div');
      actions.className = 'continue-actions';

      const resume = document.createElement('a');
      resume.className = 'continue-resume';
      resume.href = item.page || '#';
      resume.textContent = 'Continue';

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'continue-remove';
      del.textContent = 'Remove';

      del.addEventListener('click', () => {
        remove(item.id);
        card.remove();

        if (!list.children.length) section.hidden = true;
      });

      actions.append(resume, del);
      info.append(title, meta, progress, actions);
      card.append(poster, info);
      list.appendChild(card);
    });

    if (history.length) section.hidden = false;

    const clearButton = document.getElementById('clearWatchHistory');

    // Custom Clear History confirmation dialog.
    if (clearButton) {
      const style = document.createElement('style');

      style.textContent = `
        .tvhome-history-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: grid;
          place-items: center;
          padding: 20px;
          background: rgba(5, 7, 15, .76);
          -webkit-backdrop-filter: blur(8px);
          backdrop-filter: blur(8px);
        }

        .tvhome-history-dialog {
          width: min(100%, 430px);
          padding: 28px;
          border-radius: 20px;
          color: #f7f7fb;
          background: #151522;
          border: 1px solid rgba(255,255,255,.12);
          box-shadow: 0 24px 80px rgba(0,0,0,.48);
          font-family: inherit;
          animation: tvhome-dialog-in .18s ease-out;
        }

        @keyframes tvhome-dialog-in {
          from {
            opacity: 0;
            transform: translateY(8px) scale(.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .tvhome-history-icon {
          width: 46px;
          height: 46px;
          display: grid;
          place-items: center;
          margin-bottom: 18px;
          border-radius: 14px;
          color: #d5b8ff;
          background: rgba(160, 105, 235, .16);
          font-size: 22px;
        }

        .tvhome-history-dialog h2 {
          margin: 0 0 9px;
          color: inherit;
          font-size: 22px;
          line-height: 1.25;
        }

        .tvhome-history-dialog p {
          margin: 0;
          color: #aaa8ba;
          font-size: 14px;
          line-height: 1.65;
        }

        .tvhome-history-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 25px;
        }

        .tvhome-history-actions button {
          min-height: 42px;
          padding: 0 16px;
          border-radius: 10px;
          font: inherit;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: transform .15s ease, background .15s ease, border-color .15s ease;
        }

        .tvhome-history-actions button:hover {
          transform: translateY(-1px);
        }

        .tvhome-history-keep {
          color: #eeeaf7;
          background: #242333;
          border: 1px solid rgba(255,255,255,.12);
        }

        .tvhome-history-keep:hover {
          background: #302e43;
        }

        .tvhome-history-confirm {
          color: white;
          background: #8b4bd8;
          border: 1px solid #8b4bd8;
        }

        .tvhome-history-confirm:hover {
          background: #9b5be8;
        }

        .tvhome-history-confirm:focus-visible,
        .tvhome-history-keep:focus-visible {
          outline: 3px solid rgba(190,150,255,.65);
          outline-offset: 3px;
        }

        @media (max-width: 420px) {
          .tvhome-history-dialog {
            padding: 23px;
          }

          .tvhome-history-actions {
            flex-direction: column-reverse;
          }

          .tvhome-history-actions button {
            width: 100%;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .tvhome-history-dialog {
            animation: none;
          }

          .tvhome-history-actions button {
            transition: none;
          }
        }
      `;

      document.head.appendChild(style);

      let activeDialog = null;

      const closeDialog = () => {
        if (!activeDialog) return;

        const { overlay, previousFocus } = activeDialog;

        overlay.remove();
        document.body.style.overflow = activeDialog.previousOverflow;
        activeDialog = null;

        if (previousFocus && previousFocus.isConnected) {
          previousFocus.focus();
        }
      };

      const openDialog = () => {
        if (activeDialog) return;

        const previousFocus = document.activeElement;
        const previousOverflow = document.body.style.overflow;

        const overlay = document.createElement('div');
        overlay.className = 'tvhome-history-overlay';

        overlay.addEventListener('click', event => {
          if (event.target === overlay) closeDialog();
        });

        const dialog = document.createElement('section');
        dialog.className = 'tvhome-history-dialog';
        dialog.setAttribute('role', 'alertdialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'tvhome-history-title');
        dialog.setAttribute('aria-describedby', 'tvhome-history-description');

        const icon = document.createElement('div');
        icon.className = 'tvhome-history-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = '↺';

        const heading = document.createElement('h2');
        heading.id = 'tvhome-history-title';
        heading.textContent = 'Clear your watch history?';

        const description = document.createElement('p');
        description.id = 'tvhome-history-description';
        description.textContent =
          'This will delete all saved Continue Watching progress from this browser. You will not be able to restore it.';

        const error = document.createElement('p');
        error.className = 'tvhome-history-error';
        error.setAttribute('role', 'alert');
        error.style.cssText =
          'display:none;margin-top:12px;color:#ff9aab;font-size:13px;';

        const actions = document.createElement('div');
        actions.className = 'tvhome-history-actions';

        const keep = document.createElement('button');
        keep.type = 'button';
        keep.className = 'tvhome-history-keep';
        keep.textContent = 'Keep history';
        keep.addEventListener('click', closeDialog);

        const confirm = document.createElement('button');
        confirm.type = 'button';
        confirm.className = 'tvhome-history-confirm';
        confirm.textContent = 'Clear history';

        confirm.addEventListener('click', () => {
          try {
            localStorage.removeItem(KEY);
            list.replaceChildren();
            section.hidden = true;
            closeDialog();
          } catch (_) {
            error.textContent =
              'History could not be cleared. Please check your browser storage settings and try again.';
            error.style.display = 'block';
          }
        });

        actions.append(keep, confirm);
        dialog.append(icon, heading, description, error, actions);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        document.body.style.overflow = 'hidden';

        activeDialog = {
          overlay,
          previousFocus,
          previousOverflow
        };

        overlay.addEventListener('keydown', event => {
          if (event.key === 'Escape') {
            event.preventDefault();
            closeDialog();
          } else if (event.key === 'Tab') {
            const focusable = [keep, confirm];
            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }
        });

        keep.focus();
      };

      clearButton.addEventListener('click', openDialog);
    }
  }

  // Player page. Exact time tracking works only for direct video files.
  const watch = document.getElementById('watch-section');

  if (watch) {
    const iframe = document.getElementById('video-player');
    const video = document.getElementById('tvhome-video-player');
    const note = document.getElementById('watchProgressNote');
    const buttons = [...document.querySelectorAll('.server-button')];

    const item = {
      id: watch.dataset.watchId,
      title: watch.dataset.watchTitle,
      poster: watch.dataset.watchPoster,
      page: watch.dataset.watchPage,
      media: watch.dataset.watchMedia,
      season: watch.dataset.watchSeason,
      episode: watch.dataset.watchEpisode,
      position: 0,
      duration: 0,
      mode: 'embed'
    };

    const saved = () => read().find(x => String(x.id) === String(item.id));

    const direct = u => {
      try {
        return /\.(mp4|webm|ogv|ogg)$/i.test(new URL(u, location.href).pathname);
      } catch (_) {
        return false;
      }
    };

    const savePosition = () => {
      if (video && !video.hidden && Number.isFinite(video.currentTime)) {
        item.position = Math.floor(video.currentTime || 0);
        item.duration = Math.floor(video.duration || 0);
        item.mode = 'direct';
      }

      save(item);
    };

    const activate = url => {
      if (!url) return;

      const prior = saved();

      if (direct(url) && video) {
        if (iframe) {
          iframe.hidden = true;
          iframe.src = 'about:blank';
        }

        video.hidden = false;

        if (video.src !== new URL(url, location.href).href) {
          video.src = url;
          video.load();
        }

        item.mode = 'direct';

        if (note) {
          note.textContent =
            'Playback position is saved automatically on this browser.';
        }

        const pos = prior && prior.mode === 'direct'
          ? Number(prior.position) || 0
          : 0;

        if (pos > 5) {
          video.addEventListener('loadedmetadata', () => {
            if (video.duration && pos < video.duration - 10) {
              video.currentTime = pos;
            }
          }, { once: true });
        }

        save(item);
      } else {
        if (video) {
          video.pause();
          video.hidden = true;
          video.removeAttribute('src');
          video.load();
        }

        if (iframe) {
          iframe.hidden = false;
          iframe.src = url;
        }

        item.mode = 'embed';
        item.position = 0;
        item.duration = 0;

        save(item);

        if (note) {
          note.textContent =
            'This is an embedded player. TVhome can remember this episode, but cannot read its exact playback time unless the provider supplies a player API.';
        }
      }
    };

    if (video) {
      video.addEventListener('timeupdate', () => {
        if (!video.paused && video.duration) savePosition();
      });

      video.addEventListener('pause', savePosition);
      video.addEventListener('ended', () => remove(item.id));
      window.addEventListener('pagehide', savePosition);

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') savePosition();
      });
    }

    window.changeServer = button => {
      buttons.forEach(b => {
        b.classList.remove('button-primary');
        b.classList.add('button-ghost');
      });

      button.classList.remove('button-ghost');
      button.classList.add('button-primary');

      item.serverUrl = button.dataset.serverUrl;
      activate(button.dataset.serverUrl);
    };

    const first = buttons[0];

    if (first) {
      const prior = saved();

      const selected = buttons.find(b =>
        prior && prior.serverUrl === b.dataset.serverUrl
      ) || first;

      item.serverUrl = selected.dataset.serverUrl;
      activate(selected.dataset.serverUrl);
    }
  }
})();
