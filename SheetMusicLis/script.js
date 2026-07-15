(() => {
  "use strict";

  const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.metadata.readonly";
  const CLIENT_ID_KEY = "score-organizer-google-client-id";

  const els = {
    accountText: document.querySelector("#accountText"),
    disconnectBtn: document.querySelector("#disconnectBtn"),
    connectBtn: document.querySelector("#connectBtn"),
    sampleBtn: document.querySelector("#sampleBtn"),
    setupPanel: document.querySelector("#setupPanel"),
    clientIdInput: document.querySelector("#clientIdInput"),
    saveClientBtn: document.querySelector("#saveClientBtn"),
    status: document.querySelector("#status"),
    totalCount: document.querySelector("#totalCount"),
    selectedCount: document.querySelector("#selectedCount"),
    genreCount: document.querySelector("#genreCount"),
    searchInput: document.querySelector("#searchInput"),
    downloadBtn: document.querySelector("#downloadBtn"),
    emptyState: document.querySelector("#emptyState"),
    tableWrap: document.querySelector("#tableWrap"),
    songTableBody: document.querySelector("#songTableBody")
  };

  let tokenClient = null;
  let accessToken = "";
  let songs = [];
  let nextId = 1;

  const sampleSongs = [
    { artist: "아이유", title: "밤편지", genre: "발라드", fileName: "아이유 - 밤편지 [발라드].pdf" },
    { artist: "윤하", title: "사건의 지평선", genre: "록", fileName: "윤하 - 사건의 지평선 - 록.pdf" },
    { artist: "NewJeans", title: "Ditto", genre: "팝", fileName: "NewJeans_Ditto_팝.jpg" }
  ];

  function setStatus(message, type = "info") {
    els.status.textContent = message;
    els.status.dataset.type = type;
  }

  function getClientId() {
    return sessionStorage.getItem(CLIENT_ID_KEY) || "";
  }

  function updateSetupVisibility() {
    const clientId = getClientId();
    els.clientIdInput.value = clientId;
    els.setupPanel.hidden = Boolean(clientId);
    els.setupPanel.classList.toggle("show", !clientId);
    els.connectBtn.textContent = clientId ? "Google Drive 연결" : "OAuth 설정하기";
  }

  function saveClientId() {
    const value = els.clientIdInput.value.trim();
    if (!value.endsWith(".apps.googleusercontent.com")) {
      setStatus("올바른 OAuth 클라이언트 ID를 입력해 주세요.", "error");
      els.clientIdInput.focus();
      return;
    }
    sessionStorage.setItem(CLIENT_ID_KEY, value);
    tokenClient = null;
    updateSetupVisibility();
    setStatus("OAuth 설정을 임시로 저장했습니다. 이제 Google Drive를 연결하세요.", "success");
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function removeExtension(fileName) {
    return fileName.replace(/\.[^.]+$/, "");
  }

  function parseFileName(fileName, folderGenre = "미분류") {
    let base = removeExtension(fileName)
      .replace(/[_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    let genre = folderGenre || "미분류";
    const bracketGenre = base.match(/\[([^\]]+)]\s*$/);
    if (bracketGenre) {
      genre = normalizeText(bracketGenre[1]);
      base = normalizeText(base.slice(0, bracketGenre.index));
    }

    const parts = base.split(/\s+-\s+/).map(normalizeText).filter(Boolean);
    let artist = "미지정";
    let title = base || "제목 없음";

    if (parts.length >= 2) {
      artist = parts.shift();
      title = parts.shift();
      if (parts.length && genre === "미분류") genre = parts.join(" - ");
    } else {
      const underscoreParts = removeExtension(fileName).split("_").map(normalizeText).filter(Boolean);
      if (underscoreParts.length >= 2) {
        artist = underscoreParts[0];
        title = underscoreParts[1];
        if (underscoreParts[2] && genre === "미분류") genre = underscoreParts[2];
      }
    }

    return { artist, title, genre, fileName };
  }

  function addSongs(items) {
    const existing = new Set(songs.map((song) => song.driveId || `sample:${song.fileName}`));
    items.forEach((item) => {
      const uniqueKey = item.driveId || `sample:${item.fileName}`;
      if (existing.has(uniqueKey)) return;
      existing.add(uniqueKey);
      songs.push({ id: nextId++, selected: true, ...item });
    });
    render();
  }

  function filteredSongs() {
    const query = els.searchInput.value.trim().toLowerCase();
    if (!query) return songs;
    return songs.filter((song) =>
      [song.artist, song.title, song.genre, song.fileName].some((value) =>
        String(value || "").toLowerCase().includes(query)
      )
    );
  }

  function updateStats() {
    els.totalCount.textContent = songs.length;
    els.selectedCount.textContent = songs.filter((song) => song.selected).length;
    els.genreCount.textContent = new Set(songs.map((song) => normalizeText(song.genre)).filter(Boolean)).size;
    els.downloadBtn.disabled = !songs.some((song) => song.selected);
  }

  function render() {
    const visible = filteredSongs();
    els.songTableBody.replaceChildren();

    visible.forEach((song) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><input type="checkbox" data-action="select" data-id="${song.id}" ${song.selected ? "checked" : ""} aria-label="선택"></td>
        <td><input class="cell-input" data-field="artist" data-id="${song.id}" value="${escapeHtml(song.artist)}" aria-label="아티스트"></td>
        <td><input class="cell-input" data-field="title" data-id="${song.id}" value="${escapeHtml(song.title)}" aria-label="제목"></td>
        <td><input class="cell-input" data-field="genre" data-id="${song.id}" value="${escapeHtml(song.genre)}" aria-label="장르"></td>
        <td class="file-name" title="${escapeHtml(song.fileName)}">${escapeHtml(song.fileName)}</td>
        <td><button class="delete-row" type="button" data-action="delete" data-id="${song.id}">삭제</button></td>
      `;
      els.songTableBody.append(row);
    });

    const hasSongs = songs.length > 0;
    els.emptyState.hidden = hasSongs;
    els.tableWrap.hidden = !hasSongs;
    els.tableWrap.classList.toggle("hidden", !hasSongs);
    updateStats();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function ensureGoogleLibrary() {
    if (!window.google?.accounts?.oauth2) {
      throw new Error("Google 로그인 기능을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.");
    }
  }

  function initializeTokenClient() {
    ensureGoogleLibrary();
    const clientId = getClientId();
    if (!clientId) return null;
    if (tokenClient) return tokenClient;

    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: async (response) => {
        if (response.error) {
          setStatus(`Google 연결에 실패했습니다: ${response.error}`, "error");
          return;
        }
        accessToken = response.access_token;
        try {
          await loadDriveData();
        } catch (error) {
          setStatus(error.message || "드라이브 파일을 불러오지 못했습니다.", "error");
        }
      },
      error_callback: () => setStatus("Google 로그인 창이 닫혔거나 연결이 취소되었습니다.", "error")
    });
    return tokenClient;
  }

  function connectDrive() {
    if (!getClientId()) {
      els.setupPanel.hidden = false;
      els.setupPanel.classList.add("show");
      els.clientIdInput.focus();
      setStatus("Google Cloud에서 만든 OAuth 클라이언트 ID를 먼저 입력해 주세요.", "info");
      return;
    }

    try {
      initializeTokenClient().requestAccessToken({ prompt: "select_account consent" });
      setStatus("Google 계정을 선택해 주세요.", "info");
    } catch (error) {
      setStatus(error.message, "error");
    }
  }

  async function googleFetch(path) {
    const response = await fetch(`https://www.googleapis.com${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail?.error?.message || `Google API 오류 (${response.status})`);
    }
    return response.json();
  }

  async function loadDriveData() {
    setStatus("Google Drive에서 악보 파일을 찾는 중입니다…", "info");
    const about = await googleFetch("/drive/v3/about?fields=user(displayName,emailAddress)");
    const files = [];
    let pageToken = "";
    const query = encodeURIComponent("trashed = false and (mimeType = 'application/pdf' or mimeType contains 'image/')");

    do {
      const tokenPart = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "";
      const data = await googleFetch(`/drive/v3/files?q=${query}&pageSize=1000&fields=nextPageToken,files(id,name,mimeType,webViewLink,parents)${tokenPart}`);
      files.push(...(data.files || []));
      pageToken = data.nextPageToken || "";
    } while (pageToken);

    const parsed = files.map((file) => ({
      ...parseFileName(file.name),
      driveId: file.id,
      link: file.webViewLink || ""
    }));

    songs = [];
    addSongs(parsed);
    const user = about.user || {};
    els.accountText.textContent = user.displayName
      ? `${user.displayName}${user.emailAddress ? ` (${user.emailAddress})` : ""}`
      : "Google Drive 연결됨";
    els.disconnectBtn.hidden = false;
    els.disconnectBtn.classList.remove("hidden");
    setStatus(`${files.length}개의 PDF·이미지 악보를 불러왔습니다.`, "success");
  }

  function disconnectDrive() {
    const finish = () => {
      accessToken = "";
      tokenClient = null;
      songs = [];
      els.accountText.textContent = "연결된 계정 없음";
      els.disconnectBtn.hidden = true;
      els.disconnectBtn.classList.add("hidden");
      render();
      setStatus("연결을 해제했습니다. 이 브라우저에는 악보 목록을 보관하지 않습니다.", "success");
    };

    if (accessToken && window.google?.accounts?.oauth2) {
      google.accounts.oauth2.revoke(accessToken, finish);
    } else {
      finish();
    }
  }

  function loadSample() {
    addSongs(sampleSongs.map((song) => ({ ...song })));
    setStatus("테스트용 악보 3개를 넣었습니다. 표를 수정하고 엑셀을 받아보세요.", "success");
  }

  function downloadExcel() {
    const selected = songs.filter((song) => song.selected);
    if (!selected.length) {
      setStatus("엑셀에 넣을 악보를 하나 이상 선택해 주세요.", "error");
      return;
    }
    if (!window.XLSX) {
      setStatus("엑셀 기능을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.", "error");
      return;
    }

    const rows = selected.map((song, index) => ({
      번호: index + 1,
      아티스트: song.artist,
      제목: song.title,
      장르: song.genre,
      "원본 파일명": song.fileName,
      "Google Drive 링크": song.link || ""
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet["!cols"] = [{ wch: 7 }, { wch: 20 }, { wch: 30 }, { wch: 16 }, { wch: 44 }, { wch: 50 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "악보 목록");
    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `${date}-악보목록.xlsx`);
    setStatus(`${selected.length}개의 악보를 엑셀 파일로 만들었습니다.`, "success");
  }

  els.saveClientBtn.addEventListener("click", saveClientId);
  els.connectBtn.addEventListener("click", connectDrive);
  els.disconnectBtn.addEventListener("click", disconnectDrive);
  els.sampleBtn.addEventListener("click", loadSample);
  els.searchInput.addEventListener("input", render);
  els.downloadBtn.addEventListener("click", downloadExcel);
  els.songTableBody.addEventListener("change", (event) => {
    const target = event.target;
    const id = Number(target.dataset.id);
    const song = songs.find((item) => item.id === id);
    if (!song) return;
    if (target.dataset.action === "select") song.selected = target.checked;
    if (target.dataset.field) song[target.dataset.field] = normalizeText(target.value);
    updateStats();
  });
  els.songTableBody.addEventListener("click", (event) => {
    const button = event.target.closest('[data-action="delete"]');
    if (!button) return;
    songs = songs.filter((song) => song.id !== Number(button.dataset.id));
    render();
  });

  updateSetupVisibility();
  render();
})();
