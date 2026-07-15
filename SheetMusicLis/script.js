(() => {
  "use strict";

  const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.metadata.readonly";
  const CLIENT_ID_KEY = "score-organizer-google-client-id";
  const FOLDER_MIME = "application/vnd.google-apps.folder";
  const PAGE_SIZE = 200;
  const BASE_GENRES = ["미분류", "발라드", "댄스", "록", "OST", "트로트", "POP", "J-POP", "애니", "CCM", "재즈", "기타"];

  const $ = (selector) => document.querySelector(selector);
  const els = {
    accountText: $("#accountText"), disconnectBtn: $("#disconnectBtn"), connectBtn: $("#connectBtn"),
    sampleBtn: $("#sampleBtn"), setupPanel: $("#setupPanel"), clientIdInput: $("#clientIdInput"),
    saveClientBtn: $("#saveClientBtn"), status: $("#status"), totalCount: $("#totalCount"),
    selectedCount: $("#selectedCount"), genreCount: $("#genreCount"), searchInput: $("#searchInput"),
    downloadBtn: $("#downloadBtn"), emptyState: $("#emptyState"), tableWrap: $("#tableWrap"),
    songTableBody: $("#songTableBody"), genreDbInput: $("#genreDbInput"), dbInfo: $("#dbInfo"),
    genreOptions: $("#genreOptions"), genreFilter: $("#genreFilter"), bulkGenreInput: $("#bulkGenreInput"),
    applyBulkGenreBtn: $("#applyBulkGenreBtn"), selectVisibleBtn: $("#selectVisibleBtn"), pager: $("#pager"),
    prevPageBtn: $("#prevPageBtn"), nextPageBtn: $("#nextPageBtn"), pageInfo: $("#pageInfo")
  };

  let tokenClient = null;
  let accessToken = "";
  let songs = [];
  let nextId = 1;
  let currentPage = 1;
  const genreDb = new Map();
  const knownGenres = new Set(BASE_GENRES);

  const sampleSongs = [
    { artist: "아이유", title: "밤편지", fileName: "아이유 - 밤편지.pdf", fileGenre: "미분류", folderGenre: "발라드" },
    { artist: "윤하", title: "사건의 지평선", fileName: "윤하 - 사건의 지평선 [록].pdf", fileGenre: "록", folderGenre: "미분류" },
    { artist: "임영웅", title: "사랑은 늘 도망가", fileName: "임영웅 - 사랑은 늘 도망가.pdf", fileGenre: "미분류", folderGenre: "트로트" }
  ];

  function setStatus(message, type = "info") {
    els.status.textContent = message;
    els.status.dataset.type = type;
  }

  function normalizeText(value) {
    return String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
  }

  function matchPart(value) {
    return normalizeText(value).toLowerCase().replace(/[\s._\-–—()[\]{}'"·]/g, "");
  }

  function songKey(artist, title) {
    return `${matchPart(artist)}|${matchPart(title)}`;
  }

  function cleanGenre(value) {
    return normalizeText(value) || "미분류";
  }

  function rememberGenre(value) {
    const genre = cleanGenre(value);
    knownGenres.add(genre);
    return genre;
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
      return els.clientIdInput.focus();
    }
    sessionStorage.setItem(CLIENT_ID_KEY, value);
    tokenClient = null;
    updateSetupVisibility();
    setStatus("OAuth 설정을 임시 저장했습니다. Google Drive를 연결하세요.", "success");
  }

  function removeExtension(fileName) {
    return fileName.replace(/\.[^.]+$/, "");
  }

  function parseFileName(fileName, folderGenre = "미분류") {
    let base = removeExtension(fileName).replace(/_+/g, " ").replace(/\s+/g, " ").trim();
    let fileGenre = "미분류";
    const bracket = base.match(/\[([^\]]+)]\s*$/);
    if (bracket) {
      fileGenre = cleanGenre(bracket[1]);
      base = normalizeText(base.slice(0, bracket.index));
    }
    const parts = base.split(/\s+-\s+/).map(normalizeText).filter(Boolean);
    let artist = "미지정";
    let title = base || "제목 없음";
    if (parts.length >= 2) {
      artist = parts.shift();
      title = parts.shift();
      if (fileGenre === "미분류" && parts.length) fileGenre = cleanGenre(parts.join(" - "));
    } else {
      const underscore = removeExtension(fileName).split("_").map(normalizeText).filter(Boolean);
      if (underscore.length >= 2) {
        artist = underscore[0];
        title = underscore[1];
        if (underscore[2]) fileGenre = cleanGenre(underscore[2]);
      }
    }
    return { artist, title, fileGenre, folderGenre: cleanGenre(folderGenre), fileName };
  }

  function resolveGenre(song) {
    const excelGenre = genreDb.get(songKey(song.artist, song.title));
    return rememberGenre(excelGenre || (song.fileGenre !== "미분류" ? song.fileGenre : "") || (song.folderGenre !== "미분류" ? song.folderGenre : "") || "미분류");
  }

  function rematchAllSongs() {
    songs.forEach((song) => { song.genre = resolveGenre(song); });
    currentPage = 1;
    render();
  }

  function addSongs(items) {
    const existing = new Set(songs.map((song) => song.driveId || `sample:${song.fileName}`));
    for (const item of items) {
      const unique = item.driveId || `sample:${item.fileName}`;
      if (existing.has(unique)) continue;
      existing.add(unique);
      const song = { id: nextId++, selected: true, fileGenre: "미분류", folderGenre: "미분류", ...item };
      song.genre = resolveGenre(song);
      songs.push(song);
    }
    currentPage = 1;
    render();
  }

  async function uploadGenreDb(file) {
    if (!file) return;
    if (!window.XLSX) return setStatus("Excel 기능을 불러오지 못했습니다.", "error");
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      if (!rows.length) throw new Error("Excel 첫 번째 시트에 데이터가 없습니다.");
      const headers = Object.keys(rows[0]).map(normalizeText);
      const required = ["아티스트", "제목", "장르"];
      if (!required.every((header) => headers.includes(header))) throw new Error("Excel 첫 행에 아티스트, 제목, 장르 열이 모두 필요합니다.");
      genreDb.clear();
      let loaded = 0;
      for (const row of rows) {
        const artist = normalizeText(row["아티스트"]);
        const title = normalizeText(row["제목"]);
        const genre = cleanGenre(row["장르"]);
        if (!artist || !title || genre === "미분류") continue;
        genreDb.set(songKey(artist, title), rememberGenre(genre));
        loaded += 1;
      }
      els.dbInfo.textContent = `${file.name} · 장르 ${loaded.toLocaleString()}곡 불러옴`;
      rematchAllSongs();
      setStatus(`장르 DB ${loaded.toLocaleString()}곡을 불러와 현재 목록에 우선 적용했습니다.`, "success");
    } catch (error) {
      setStatus(error.message || "Excel 파일을 읽지 못했습니다.", "error");
    } finally {
      els.genreDbInput.value = "";
    }
  }

  function filteredSongs() {
    const query = matchPart(els.searchInput.value);
    const filter = els.genreFilter.value;
    return songs.filter((song) => {
      const searchOk = !query || [song.artist, song.title, song.genre, song.fileName].some((value) => matchPart(value).includes(query));
      const genreOk = filter === "all" || (filter === "unclassified" ? song.genre === "미분류" : song.genre === filter);
      return searchOk && genreOk;
    });
  }

  function renderGenreControls() {
    const genres = [...knownGenres].filter(Boolean).sort((a, b) => a.localeCompare(b, "ko"));
    els.genreOptions.replaceChildren(...genres.map((genre) => Object.assign(document.createElement("option"), { value: genre })));
    const current = els.genreFilter.value || "all";
    const fixed = [["all", "전체"], ["unclassified", "미분류만"]];
    els.genreFilter.replaceChildren(...fixed.map(([value, text]) => Object.assign(document.createElement("option"), { value, text })));
    for (const genre of genres.filter((item) => item !== "미분류")) {
      els.genreFilter.append(Object.assign(document.createElement("option"), { value: genre, text: genre }));
    }
    els.genreFilter.value = [...els.genreFilter.options].some((option) => option.value === current) ? current : "all";
  }

  function updateStats() {
    els.totalCount.textContent = songs.length.toLocaleString();
    els.selectedCount.textContent = songs.filter((song) => song.selected).length.toLocaleString();
    els.genreCount.textContent = new Set(songs.map((song) => song.genre)).size.toLocaleString();
    els.downloadBtn.disabled = !songs.some((song) => song.selected);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function render() {
    renderGenreControls();
    const visible = filteredSongs();
    const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
    currentPage = Math.min(currentPage, pageCount);
    const pageRows = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    const fragment = document.createDocumentFragment();
    for (const song of pageRows) {
      const row = document.createElement("tr");
      row.innerHTML = `<td><input type="checkbox" data-action="select" data-id="${song.id}" ${song.selected ? "checked" : ""} aria-label="선택"></td>
        <td><input class="cell-input" data-field="artist" data-id="${song.id}" value="${escapeHtml(song.artist)}" aria-label="아티스트"></td>
        <td><input class="cell-input title-input" data-field="title" data-id="${song.id}" value="${escapeHtml(song.title)}" aria-label="제목"></td>
        <td><input class="cell-input genre-input" list="genreOptions" data-field="genre" data-id="${song.id}" value="${escapeHtml(song.genre)}" aria-label="장르"></td>
        <td class="file-name" title="${escapeHtml(song.fileName)}">${escapeHtml(song.fileName)}</td>
        <td><button class="delete-row" type="button" data-action="delete" data-id="${song.id}">삭제</button></td>`;
      fragment.append(row);
    }
    els.songTableBody.replaceChildren(fragment);
    const hasSongs = songs.length > 0;
    els.emptyState.hidden = hasSongs;
    els.tableWrap.classList.toggle("hidden", !hasSongs);
    els.pager.classList.toggle("hidden", !hasSongs || visible.length <= PAGE_SIZE);
    els.pageInfo.textContent = `${currentPage.toLocaleString()} / ${pageCount.toLocaleString()} · ${visible.length.toLocaleString()}곡`;
    els.prevPageBtn.disabled = currentPage <= 1;
    els.nextPageBtn.disabled = currentPage >= pageCount;
    updateStats();
  }

  function ensureGoogleLibrary() {
    if (!window.google?.accounts?.oauth2) throw new Error("Google 로그인 기능을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.");
  }

  function initializeTokenClient() {
    ensureGoogleLibrary();
    const clientId = getClientId();
    if (!clientId) return null;
    if (tokenClient) return tokenClient;
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId, scope: DRIVE_SCOPE,
      callback: async (response) => {
        if (response.error) return setStatus(`Google 연결에 실패했습니다: ${response.error}`, "error");
        accessToken = response.access_token;
        try { await loadDriveData(); } catch (error) { setStatus(error.message || "드라이브 파일을 불러오지 못했습니다.", "error"); }
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
      return setStatus("Google OAuth 클라이언트 ID를 먼저 입력해 주세요.", "info");
    }
    try { initializeTokenClient().requestAccessToken({ prompt: "select_account consent" }); setStatus("Google 계정을 선택해 주세요."); }
    catch (error) { setStatus(error.message, "error"); }
  }

  async function googleFetch(path) {
    const response = await fetch(`https://www.googleapis.com${path}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail?.error?.message || `Google API 오류 (${response.status})`);
    }
    return response.json();
  }

  async function listDriveFiles(query, fields) {
    const result = [];
    let pageToken = "";
    do {
      const token = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "";
      const data = await googleFetch(`/drive/v3/files?q=${encodeURIComponent(query)}&pageSize=1000&fields=nextPageToken,files(${fields})${token}`);
      result.push(...(data.files || []));
      pageToken = data.nextPageToken || "";
    } while (pageToken);
    return result;
  }

  async function loadDriveData() {
    setStatus("Google Drive에서 악보와 폴더 정보를 찾는 중입니다…");
    const [about, files, folders] = await Promise.all([
      googleFetch("/drive/v3/about?fields=user(displayName,emailAddress)"),
      listDriveFiles("trashed = false and (mimeType = 'application/pdf' or mimeType contains 'image/')", "id,name,mimeType,webViewLink,parents"),
      listDriveFiles(`trashed = false and mimeType = '${FOLDER_MIME}'`, "id,name")
    ]);
    const folderMap = new Map(folders.map((folder) => [folder.id, folder.name]));
    const parsed = files.map((file) => {
      const parentName = file.parents?.map((id) => folderMap.get(id)).find(Boolean) || "미분류";
      return { ...parseFileName(file.name, parentName), driveId: file.id, link: file.webViewLink || "" };
    });
    songs = [];
    addSongs(parsed);
    const user = about.user || {};
    els.accountText.textContent = user.displayName ? `${user.displayName}${user.emailAddress ? ` (${user.emailAddress})` : ""}` : "Google Drive 연결됨";
    els.disconnectBtn.classList.remove("hidden");
    setStatus(`${files.length.toLocaleString()}개의 악보를 불러오고 장르 우선순위를 적용했습니다.`, "success");
  }

  function disconnectDrive() {
    const finish = () => {
      accessToken = ""; tokenClient = null; songs = [];
      els.accountText.textContent = "연결된 계정 없음";
      els.disconnectBtn.classList.add("hidden");
      render(); setStatus("Google Drive 연결을 해제했습니다.", "success");
    };
    if (accessToken && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(accessToken, finish); else finish();
  }

  function loadSample() {
    addSongs(sampleSongs.map((song) => ({ ...song })));
    setStatus("샘플 3곡을 넣었습니다. 장르 DB 업로드와 일괄 변경을 테스트해 보세요.", "success");
  }

  function applyBulkGenre() {
    const genre = rememberGenre(els.bulkGenreInput.value);
    if (genre === "미분류" && !normalizeText(els.bulkGenreInput.value)) return setStatus("변경할 장르를 입력해 주세요.", "error");
    const selected = songs.filter((song) => song.selected);
    if (!selected.length) return setStatus("장르를 변경할 곡을 선택해 주세요.", "error");
    selected.forEach((song) => { song.genre = genre; genreDb.set(songKey(song.artist, song.title), genre); });
    els.bulkGenreInput.value = "";
    render(); setStatus(`선택한 ${selected.length.toLocaleString()}곡을 ${genre}(으)로 변경했습니다.`, "success");
  }

  function downloadExcel() {
    const selected = songs.filter((song) => song.selected);
    if (!selected.length) return setStatus("Excel에 넣을 악보를 선택해 주세요.", "error");
    if (!window.XLSX) return setStatus("Excel 기능을 불러오지 못했습니다.", "error");
    const rows = selected.map((song, index) => ({ 번호: index + 1, 아티스트: song.artist, 제목: song.title, 장르: song.genre, "원본 파일명": song.fileName, "Google Drive 링크": song.link || "" }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet["!cols"] = [{ wch: 7 }, { wch: 20 }, { wch: 30 }, { wch: 16 }, { wch: 44 }, { wch: 50 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "악보 목록");
    XLSX.writeFile(workbook, `${new Date().toISOString().slice(0, 10)}-악보목록.xlsx`);
    setStatus(`${selected.length.toLocaleString()}곡을 Excel로 저장했습니다. 이 파일은 다음 장르 DB로 다시 업로드할 수 있습니다.`, "success");
  }

  els.saveClientBtn.addEventListener("click", saveClientId);
  els.connectBtn.addEventListener("click", connectDrive);
  els.disconnectBtn.addEventListener("click", disconnectDrive);
  els.sampleBtn.addEventListener("click", loadSample);
  els.genreDbInput.addEventListener("change", (event) => uploadGenreDb(event.target.files?.[0]));
  els.searchInput.addEventListener("input", () => { currentPage = 1; render(); });
  els.genreFilter.addEventListener("change", () => { currentPage = 1; render(); });
  els.downloadBtn.addEventListener("click", downloadExcel);
  els.applyBulkGenreBtn.addEventListener("click", applyBulkGenre);
  els.selectVisibleBtn.addEventListener("click", () => { filteredSongs().forEach((song) => { song.selected = true; }); render(); });
  els.prevPageBtn.addEventListener("click", () => { if (currentPage > 1) { currentPage -= 1; render(); } });
  els.nextPageBtn.addEventListener("click", () => { currentPage += 1; render(); });
  els.songTableBody.addEventListener("change", (event) => {
    const target = event.target;
    const song = songs.find((item) => item.id === Number(target.dataset.id));
    if (!song) return;
    if (target.dataset.action === "select") song.selected = target.checked;
    if (target.dataset.field) {
      song[target.dataset.field] = normalizeText(target.value);
      if (target.dataset.field === "genre") { song.genre = rememberGenre(song.genre); genreDb.set(songKey(song.artist, song.title), song.genre); }
      if (target.dataset.field === "artist" || target.dataset.field === "title") song.genre = resolveGenre(song);
    }
    render();
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
