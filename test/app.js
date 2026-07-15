import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
  // 시청자 페이지와 같은 값으로 바꾸세요.
  const SUPABASE_URL='https://bxceghrdlmkiyoigycwb.supabase.co', SUPABASE_ANON_KEY='sb_publishable_pJdG6nCDAkOa2QoNxao3RQ_vUcfoQ1S';
  const configured=!SUPABASE_URL.startsWith('YOUR_')&&!SUPABASE_ANON_KEY.startsWith('YOUR_'); const supabase=configured?createClient(SUPABASE_URL,SUPABASE_ANON_KEY):null; const $=s=>document.querySelector(s);
  let songs=[]; let genres=[]; let selectedGenres=new Set(); let editingSongId=null; let editingGenreId=null; let selectedSongIds=new Set(); let bulkGenres=new Set(); let songSearchQuery=''; let genreSearchQuery=''; let songSortMode='manual'; let pageSettings=null; let songPage=1; const SONGS_PER_PAGE=10;
  const toast=m=>{const e=$('#toast');e.textContent=m;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),1900)};const e=(t,c,x)=>{const n=document.createElement(t);if(c)n.className=c;if(x!==undefined)n.textContent=x;return n};
  function songGenres(s){return (s.genres&&s.genres.length)?s.genres:(s.genre?[s.genre]:[]);}
  function manualSongs(){return [...songs].sort((a,b)=>{const aOrder=typeof a.sort_order==='number'?a.sort_order:Number.MAX_SAFE_INTEGER;const bOrder=typeof b.sort_order==='number'?b.sort_order:Number.MAX_SAFE_INTEGER;return aOrder-bOrder||String(a.created_at||'').localeCompare(String(b.created_at||''))})}
  function item(song){const gs=songGenres(song);const card=e('article','song');const check=document.createElement('input');check.type='checkbox';check.className='song-check';check.checked=selectedSongIds.has(song.id);check.onchange=()=>{if(check.checked)selectedSongIds.add(song.id);else selectedSongIds.delete(song.id);renderBulkBar();syncSelectAll()};const sym=e('div','symbol',gs.includes('피아노연주곡')?'🎹':'🎵'),info=e('div','info'),title=e('div','title',song.title),meta=e('div','meta',song.artist||'가수 미입력'),actions=e('div','request-actions'),editBtn=e('button','mini','수정'),del=e('button','mini delete','삭제');gs.forEach(g=>meta.append(e('span','admin-genre-tag',g)));if(songSortMode==='manual'){const ordered=manualSongs();const songIndex=ordered.findIndex(item=>item.id===song.id);const upBtn=e('button','mini','↑');upBtn.type='button';upBtn.title='위로 이동';upBtn.disabled=Boolean(songSearchQuery.trim())||songIndex<=0;upBtn.onclick=()=>moveSong(song,-1);const downBtn=e('button','mini','↓');downBtn.type='button';downBtn.title='아래로 이동';downBtn.disabled=Boolean(songSearchQuery.trim())||songIndex<0||songIndex>=ordered.length-1;downBtn.onclick=()=>moveSong(song,1);actions.append(upBtn,downBtn)}editBtn.onclick=()=>startEdit(song);del.onclick=()=>deleteSong(song);actions.append(editBtn,del);info.append(title,meta);card.append(check,sym,info,actions);return card}
  function filteredSongs(){const q=songSearchQuery.trim().toLowerCase();let visible=q?songs.filter(s=>[s.title,s.artist].filter(Boolean).join(' ').toLowerCase().includes(q)):[...songs];if(songSortMode==='latest')visible.sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));else if(songSortMode==='alpha')visible.sort((a,b)=>String(a.title||'').localeCompare(String(b.title||''),'ko',{numeric:true,sensitivity:'base'})||String(a.artist||'').localeCompare(String(b.artist||''),'ko',{numeric:true,sensitivity:'base'}));else{const order=new Map(manualSongs().map((song,index)=>[song.id,index]));visible.sort((a,b)=>(order.get(a.id)??Number.MAX_SAFE_INTEGER)-(order.get(b.id)??Number.MAX_SAFE_INTEGER))}return visible}
  function renderSongSortMenu(){const box=$('#songSortMenu');box.replaceChildren();[['latest','최신순'],['alpha','가나다순']].forEach(([key,label])=>{const button=e('button','song-sort-button'+(songSortMode===key?' active':''),label);button.type='button';button.onclick=()=>{songSortMode=songSortMode===key?'manual':key;songPage=1;renderSongSortMenu();render()};box.append(button)})}
  function filteredGenres(){const q=genreSearchQuery.trim().toLowerCase();if(!q)return genres;return genres.filter(g=>(g.name||'').toLowerCase().includes(q))}
  function syncSelectAll(){const cb=$('#selectAllCheckbox');if(!cb)return;const visible=filteredSongs();cb.checked=visible.length>0&&visible.every(s=>selectedSongIds.has(s.id))}
  function renderBulkGenreChooser(){const box=$('#bulkGenreChooser');box.replaceChildren();genres.forEach(g=>{const chip=e('button','genre-chip'+(bulkGenres.has(g.name)?' active':''),g.name);chip.type='button';chip.onclick=()=>{if(bulkGenres.has(g.name))bulkGenres.delete(g.name);else bulkGenres.add(g.name);renderBulkGenreChooser()};box.append(chip)})}
  function renderBulkBar(){const bar=$('#bulkBar');const n=selectedSongIds.size;bar.hidden=n===0;$('#bulkCount').textContent=n+'곡 선택됨'}
  function renderPagination(total){const box=$('#songPagination');const totalPages=Math.ceil(total/SONGS_PER_PAGE);box.replaceChildren();if(totalPages<=1)return;const add=(label,page,active=false,arrow=false)=>{const b=e('button','page-btn'+(active?' active':'')+(arrow?' page-arrow':''),label);b.type='button';b.setAttribute('aria-label',arrow?(label==='‹'?'이전 페이지':'다음 페이지'):(page+'페이지'));b.onclick=()=>{songPage=page;render();document.querySelector('.songs-card').scrollIntoView({behavior:'smooth',block:'start'})};box.append(b)};const start=Math.floor((songPage-1)/10)*10+1;const end=Math.min(totalPages,start+9);if(songPage>1)add('‹',songPage-1,false,true);for(let p=start;p<=end;p++)add(String(p),p,p===songPage);if(songPage<totalPages)add('›',songPage+1,false,true)}
  function render(){const songBox=$('#songs');const visible=filteredSongs();const totalPages=Math.max(1,Math.ceil(visible.length/SONGS_PER_PAGE));songPage=Math.min(Math.max(1,songPage),totalPages);const pageSongs=visible.slice((songPage-1)*SONGS_PER_PAGE,songPage*SONGS_PER_PAGE);songBox.replaceChildren(...pageSongs.map(item));if(!songs.length)songBox.append(e('div','empty','아직 등록된 노래가 없어요.'));else if(!visible.length)songBox.append(e('div','empty','검색 결과가 없어요. 다른 곡명이나 가수명으로 찾아보세요.'));$('#songCount').textContent=songs.length+'곡';const summary=$('#searchSummary');if(summary)summary.textContent=songSearchQuery?('검색 결과 '+visible.length+'곡 / 전체 '+songs.length+'곡'):'전체 '+songs.length+'곡을 표시 중입니다.';renderPagination(visible.length);renderBulkBar();syncSelectAll()}
  async function fetchAllSongs(){const batchSize=1000;let all=[];for(let from=0;;from+=batchSize){const {data,error}=await supabase.from('songs').select('*').order('created_at').range(from,from+batchSize-1);if(error)return {data:null,error};all.push(...(data||[]));if(!data||data.length<batchSize)break;}return {data:all,error:null}}
  async function load(){const {data,error}=await fetchAllSongs();if(error){toast('데이터를 불러오지 못했어요');return}songs=data||[];renderSongSortMenu();render()}
  async function moveSong(song,direction){const ordered=manualSongs();const currentIndex=ordered.findIndex(item=>item.id===song.id);const targetIndex=currentIndex+direction;if(currentIndex<0||targetIndex<0||targetIndex>=ordered.length)return;const target=ordered[targetIndex];if(typeof song.sort_order!=='number'||typeof target.sort_order!=='number'){toast('먼저 노래 순서 설정 SQL을 실행해 주세요');return}const currentOrder=song.sort_order;const targetOrder=target.sort_order;const numericOrders=ordered.map(item=>item.sort_order).filter(Number.isFinite);const temporaryOrder=Math.min(0,...numericOrders)-1;let {error}=await supabase.from('songs').update({sort_order:temporaryOrder}).eq('id',song.id);if(error){toast('노래 순서를 변경하지 못했어요');return}({error}=await supabase.from('songs').update({sort_order:currentOrder}).eq('id',target.id));if(error){await supabase.from('songs').update({sort_order:currentOrder}).eq('id',song.id);toast('노래 순서를 변경하지 못했어요');await load();return}({error}=await supabase.from('songs').update({sort_order:targetOrder}).eq('id',song.id));if(error){await supabase.from('songs').update({sort_order:targetOrder}).eq('id',target.id);await supabase.from('songs').update({sort_order:currentOrder}).eq('id',song.id);toast('노래 순서를 변경하지 못했어요');await load();return}await load();toast('노래 순서를 변경했어요')}
  function renderGenreChooser(){const box=$('#genreChooser');box.replaceChildren();genres.forEach(g=>{const chip=e('button','genre-chip'+(selectedGenres.has(g.name)?' active':''),g.name);chip.type='button';chip.onclick=()=>{if(selectedGenres.has(g.name))selectedGenres.delete(g.name);else selectedGenres.add(g.name);renderGenreChooser()};box.append(chip)})}
  function renderGenreManage(){const box=$('#genreList');const visible=filteredGenres();box.replaceChildren();$('#genreCount').textContent=genres.length+'개';const summary=$('#genreSearchSummary');if(summary)summary.textContent=genreSearchQuery?('검색 결과 '+visible.length+'개 / 전체 '+genres.length+'개'):'전체 '+genres.length+'개를 표시 중입니다.';if(!genres.length)box.append(e('div','empty','등록된 카테고리가 없어요.'));else if(!visible.length)box.append(e('div','empty','검색 결과가 없어요. 다른 카테고리 이름으로 찾아보세요.'));visible.forEach(g=>{const row=e('div','genre-row');if(editingGenreId===g.id){const input=document.createElement('input');input.value=g.name;const save=e('button','mini','저장');save.onclick=()=>saveGenreName(g,input.value.trim());const cancel=e('button','mini','취소');cancel.onclick=()=>{editingGenreId=null;renderGenreManage()};row.append(input,save,cancel);}else{const genreIndex=genres.findIndex(item=>item.id===g.id);const name=e('div','info category-name',g.name);const upBtn=e('button','mini','↑');upBtn.type='button';upBtn.title='위로 이동';upBtn.disabled=genreIndex<=0;upBtn.onclick=()=>moveGenre(g,-1);const downBtn=e('button','mini','↓');downBtn.type='button';downBtn.title='아래로 이동';downBtn.disabled=genreIndex<0||genreIndex>=genres.length-1;downBtn.onclick=()=>moveGenre(g,1);const editBtn=e('button','mini','수정');editBtn.onclick=()=>{editingGenreId=g.id;renderGenreManage()};const delBtn=e('button','mini delete','삭제');delBtn.onclick=()=>deleteGenre(g);row.append(name,upBtn,downBtn,editBtn,delBtn);}box.append(row)})}
  async function moveGenre(g,direction){const currentIndex=genres.findIndex(item=>item.id===g.id);const targetIndex=currentIndex+direction;if(currentIndex<0||targetIndex<0||targetIndex>=genres.length)return;const target=genres[targetIndex];const currentOrder=Number.isFinite(Number(g.sort_order))?Number(g.sort_order):currentIndex;const targetOrder=Number.isFinite(Number(target.sort_order))?Number(target.sort_order):targetIndex;const numericOrders=genres.map(item=>Number(item.sort_order)).filter(Number.isFinite);const temporaryOrder=Math.min(0,...numericOrders)-1;let {error}=await supabase.from('genres').update({sort_order:temporaryOrder}).eq('id',g.id);if(error){toast('카테고리 순서를 변경하지 못했어요');return}({error}=await supabase.from('genres').update({sort_order:currentOrder}).eq('id',target.id));if(error){await supabase.from('genres').update({sort_order:currentOrder}).eq('id',g.id);toast('카테고리 순서를 변경하지 못했어요');await loadGenres();return}({error}=await supabase.from('genres').update({sort_order:targetOrder}).eq('id',g.id));if(error){await supabase.from('genres').update({sort_order:targetOrder}).eq('id',target.id);await supabase.from('genres').update({sort_order:currentOrder}).eq('id',g.id);toast('카테고리 순서를 변경하지 못했어요');await loadGenres();return}await loadGenres();toast('카테고리 순서를 변경했어요')}
  async function loadGenres(){const {data,error}=await supabase.from('genres').select('*').order('sort_order');if(error){toast('카테고리를 불러오지 못했어요');return}genres=data||[];renderGenreChooser();renderGenreManage();renderBulkGenreChooser()}
  async function addGenre(){const name=$('#newGenreInput').value.trim();if(!name){toast('카테고리 이름을 입력해 주세요');return}const maxOrder=genres.length?Math.max(...genres.map(g=>g.sort_order)):-1;const {error}=await supabase.from('genres').insert({name,sort_order:maxOrder+1});if(error){toast('이미 있는 이름이거나 추가 권한이 없어요');return}$('#newGenreInput').value='';await loadGenres()}
  async function saveGenreName(g,newName){if(!newName){toast('이름을 입력해 주세요');return}if(newName===g.name){editingGenreId=null;renderGenreManage();return}const oldName=g.name;const {error}=await supabase.from('genres').update({name:newName}).eq('id',g.id);if(error){toast('이미 있는 이름이거나 수정 권한이 없어요');return}const affected=songs.filter(s=>songGenres(s).includes(oldName));for(const s of affected){const updated=[...new Set(songGenres(s).map(x=>x===oldName?newName:x))];const {error:updateError}=await supabase.from('songs').update({genres:updated}).eq('id',s.id);if(updateError){toast('카테고리명은 변경됐지만 일부 곡 반영에 실패했어요');break}}if(selectedGenres.delete(oldName))selectedGenres.add(newName);if(bulkGenres.delete(oldName))bulkGenres.add(newName);editingGenreId=null;await loadGenres();await load();toast('카테고리 이름을 수정했어요')}
  async function deleteGenre(g){if(!confirm('"'+g.name+'" 카테고리를 삭제할까요? 이 태그가 붙은 곡에서도 함께 사라져요.'))return;const affected=songs.filter(s=>songGenres(s).includes(g.name));for(const s of affected){const updated=songGenres(s).filter(x=>x!==g.name);const {error:updateError}=await supabase.from('songs').update({genres:updated}).eq('id',s.id);if(updateError){toast('곡에서 카테고리를 제거하지 못했어요');return}}const {error}=await supabase.from('genres').delete().eq('id',g.id);if(error){toast('삭제할 권한이 없어요');return}selectedGenres.delete(g.name);bulkGenres.delete(g.name);await loadGenres();await load();toast('카테고리를 삭제했어요')}
  function startEdit(song){editingSongId=song.id;$('#titleInput').value=song.title;$('#artistInput').value=song.artist||'';selectedGenres=new Set(songGenres(song));renderGenreChooser();$('#addButton').textContent='저장';$('#cancelEditButton').hidden=false;$('#titleInput').scrollIntoView({behavior:'smooth',block:'center'})}
  function resetForm(){editingSongId=null;$('#titleInput').value='';$('#artistInput').value='';selectedGenres=new Set();renderGenreChooser();$('#addButton').textContent='추가';$('#cancelEditButton').hidden=true}
  async function addSong(){const title=$('#titleInput').value.trim(),artist=$('#artistInput').value.trim(),genresArr=[...selectedGenres];if(!title){toast('곡명을 입력해 주세요');return}if(editingSongId){const {error}=await supabase.from('songs').update({title,artist,genres:genresArr}).eq('id',editingSongId);if(error){toast('수정할 권한이 없어요');return}toast('수정했어요')}else{const {data,error}=await supabase.from('songs').insert({title,artist,genres:genresArr}).select().single();if(error){toast('곡을 추가할 권한이 없어요');return}if(data&&Object.prototype.hasOwnProperty.call(data,'sort_order')){const numericOrders=songs.map(song=>song.sort_order).filter(Number.isFinite);const nextOrder=numericOrders.length?Math.max(...numericOrders)+1:0;await supabase.from('songs').update({sort_order:nextOrder}).eq('id',data.id)}}resetForm();await load()}
  async function deleteSong(song){if(!confirm('“'+song.title+'”을(를) 노래책에서 삭제할까요?'))return;const {error}=await supabase.from('songs').delete().eq('id',song.id);if(error){toast('삭제할 권한이 없어요');return}selectedSongIds.delete(song.id);if(editingSongId===song.id)resetForm();await load()}
  async function bulkApply(mode){if(!selectedSongIds.size){toast('선택된 곡이 없어요');return}if(!bulkGenres.size){toast('적용할 카테고리를 선택해 주세요');return}const targets=songs.filter(s=>selectedSongIds.has(s.id));for(const s of targets){const current=songGenres(s);let updated;if(mode==='add')updated=[...new Set([...current,...bulkGenres])];else if(mode==='remove')updated=current.filter(g=>!bulkGenres.has(g));else updated=[...bulkGenres];const {error}=await supabase.from('songs').update({genres:updated}).eq('id',s.id);if(error){toast('일부 곡은 수정 권한이 없어요');return}}toast('일괄 적용했어요');selectedSongIds.clear();bulkGenres.clear();renderBulkGenreChooser();await load()}
  

  // 데이터 관리: 파싱 결과와 복원 여부를 모달이 닫힐 때까지 보관합니다.
  let pendingImport=null;
  const IMPORT_BATCH_SIZE=200;

  function importKey(title,artist){return (String(title).trim()+'\u0000'+String(artist).trim()).normalize('NFKC').toLocaleLowerCase('ko-KR')}
  function splitGenres(value){return [...new Set(String(value??'').split(',').map(name=>name.trim()).filter(Boolean))]}
  function setImportProgress(percent,label){const value=Math.max(0,Math.min(100,Math.round(percent)));$('#importProgressBar').style.width=value+'%';$('#importProgressText').textContent=label||value+'%'}
  function describeImportError(error){const message=String(error?.message||error||'');if(/Failed to fetch|NetworkError|fetch/i.test(message))return '인터넷 연결을 확인해 주세요.';if(/컬럼이 없습니다|빈 파일|지원하지 않는 파일|파일을 읽을 수 없습니다/.test(message))return message;return 'Supabase 오류: '+(message||'요청을 처리하지 못했습니다.')}

  // SheetJS로 첫 번째 시트를 읽고 한글 헤더를 내부 필드로 변환합니다.
  async function parseExcel(file){
    const ext=(file.name.split('.').pop()||'').toLowerCase();
    if(!['xlsx','csv'].includes(ext))throw new Error('지원하지 않는 파일입니다. xlsx 또는 csv 파일을 선택해 주세요.');
    if(!file.size)throw new Error('빈 파일입니다.');
    if(!window.XLSX)throw new Error('인터넷 오류: 엑셀 라이브러리를 불러오지 못했습니다.');
    let workbook;
    try{workbook=window.XLSX.read(await file.arrayBuffer(),{type:'array'})}catch(error){throw new Error('파일을 읽을 수 없습니다. 올바른 xlsx 또는 csv 파일인지 확인해 주세요.')}
    const sheet=workbook.Sheets[workbook.SheetNames[0]];
    if(!sheet)throw new Error('빈 파일입니다.');
    const rows=window.XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:false,blankrows:false});
    if(!rows.length)throw new Error('빈 파일입니다.');
    // 문서 제목이나 빈 줄이 위에 있어도 처음 10개 행 안에서 실제 헤더를 찾습니다.
    const aliases={title:['제목','곡명','노래제목','title'],artist:['가수','가수명','아티스트','artist'],genre:['장르','카테고리','genre','genres']};
    const normalizeHeader=value=>String(value??'').trim().replace(/^\uFEFF/,'').replace(/\s+/g,'').toLocaleLowerCase('ko-KR');
    const findHeaderIndex=(headers,names)=>headers.findIndex(header=>names.includes(header));
    let headerRowIndex=-1,headers=[],titleIndex=-1,artistIndex=-1,genreIndex=-1;
    for(let index=0;index<Math.min(rows.length,10);index++){
      const candidate=rows[index].map(normalizeHeader);
      const candidateTitle=findHeaderIndex(candidate,aliases.title),candidateArtist=findHeaderIndex(candidate,aliases.artist),candidateGenre=findHeaderIndex(candidate,aliases.genre);
      if(candidateTitle>=0&&candidateArtist>=0&&candidateGenre>=0){headerRowIndex=index;headers=candidate;titleIndex=candidateTitle;artistIndex=candidateArtist;genreIndex=candidateGenre;break}
      if(index===0)headers=candidate;
    }
    if(headerRowIndex<0){
      const found=headers.filter(Boolean).join(', ')||'인식 가능한 헤더 없음';
      const missing=[];
      if(findHeaderIndex(headers,aliases.title)<0)missing.push('제목');
      if(findHeaderIndex(headers,aliases.artist)<0)missing.push('가수');
      if(findHeaderIndex(headers,aliases.genre)<0)missing.push('장르');
      throw new Error(missing.join(', ')+' 컬럼이 없습니다.\n발견된 첫 행: '+found);
    }
    const parsed=rows.slice(headerRowIndex+1).map((row,index)=>({title:String(row[titleIndex]??'').trim(),artist:String(row[artistIndex]??'').trim(),genres:splitGenres(row[genreIndex]),rowNumber:headerRowIndex+index+2})).filter(song=>song.title||song.artist||song.genres.length);
    if(!parsed.length)throw new Error('빈 파일입니다.');
    return validateSongs(parsed);
  }

  // 제목과 가수는 모든 데이터 행에 필요합니다. 파일 내부 중복도 한 번만 저장합니다.
  function validateSongs(parsed){
    const invalid=parsed.find(song=>!song.title||!song.artist);
    if(invalid)throw new Error(invalid.rowNumber+'행의 '+(!invalid.title?'제목':'가수')+' 값이 비어 있습니다.');
    const unique=[],seen=new Set();let fileDuplicates=0;
    parsed.forEach(song=>{const key=importKey(song.title,song.artist);if(seen.has(key)){fileDuplicates++;return}seen.add(key);unique.push(song)});
    return {songs:unique,fileDuplicates,total:parsed.length};
  }

  // 현재 DB 데이터와 비교해 신규 곡, 중복 곡, 새 카테고리를 계산합니다.
  async function previewImport(file,isRestore=false){
    const parsed=await parseExcel(file);
    const {data:currentSongs,error}=await fetchAllSongs();
    if(error)throw error;
    const existingKeys=new Set((currentSongs||[]).map(song=>importKey(song.title,song.artist||'')));
    const newSongs=parsed.songs.filter(song=>!existingKeys.has(importKey(song.title,song.artist)));
    const duplicateCount=parsed.total-newSongs.length;
    const existingGenres=new Set(genres.map(genre=>String(genre.name).trim()));
    const missingGenres=[...new Set(newSongs.flatMap(song=>song.genres))].filter(name=>!existingGenres.has(name));
    pendingImport={file,isRestore,newSongs,total:parsed.total,duplicateCount,missingGenres};
    $('#importModalTitle').textContent=isRestore?'데이터 복원 미리보기':'업로드 미리보기';
    $('#importFileName').textContent=file.name;
    $('#importStats').innerHTML='<div class="import-stat"><span>총 데이터</span><b>'+parsed.total+'곡</b></div><div class="import-stat"><span>신규</span><b>'+newSongs.length+'곡</b></div><div class="import-stat"><span>중복</span><b>'+duplicateCount+'곡</b></div><div class="import-stat"><span>새 카테고리</span><b>'+missingGenres.length+'개</b></div>';
    $('#importProgress').hidden=true;$('#importError').hidden=true;$('#importStartButton').hidden=false;$('#importStartButton').disabled=false;$('#importStartButton').textContent=isRestore?'복원 시작':'업로드 시작';$('#importCancelButton').textContent='취소';$('#importModal').hidden=false;
  }

  // genres 테이블에 없는 이름만 한 번에 생성합니다.
  async function createMissingGenres(names){
    if(!names.length)return 0;
    const orders=genres.map(genre=>Number(genre.sort_order)).filter(Number.isFinite);let nextOrder=orders.length?Math.max(...orders)+1:0;
    const payload=names.map(name=>({name,sort_order:nextOrder++}));
    const {error}=await supabase.from('genres').insert(payload);
    if(error)throw error;
    return payload.length;
  }

  // 브라우저와 Supabase에 부담을 주지 않도록 200곡씩 나누어 저장합니다.
  async function batchInsertSongs(importSongs,onProgress){
    if(!importSongs.length){onProgress?.(100);return 0}
    const supportsSortOrder=songs.some(song=>Object.prototype.hasOwnProperty.call(song,'sort_order'));
    const orders=songs.map(song=>Number(song.sort_order)).filter(Number.isFinite);let nextOrder=orders.length?Math.max(...orders)+1:0,inserted=0;
    for(let i=0;i<importSongs.length;i+=IMPORT_BATCH_SIZE){
      const batch=importSongs.slice(i,i+IMPORT_BATCH_SIZE).map(song=>{const payload={title:song.title,artist:song.artist,genres:song.genres};if(supportsSortOrder)payload.sort_order=nextOrder++;return payload});
      const {error}=await supabase.from('songs').insert(batch);
      if(error)throw error;
      inserted+=batch.length;onProgress?.(inserted/importSongs.length*100);
    }
    return inserted;
  }

  async function startPendingImport(){
    if(!pendingImport)return;
    const started=performance.now(),button=$('#importStartButton');button.disabled=true;$('#importCancelButton').disabled=true;$('#importProgress').hidden=false;$('#importError').hidden=true;setImportProgress(0,'준비 중...');
    try{
      const categoryCount=await createMissingGenres(pendingImport.missingGenres);setImportProgress(5,'카테고리 확인 완료');
      const addedCount=await batchInsertSongs(pendingImport.newSongs,percent=>setImportProgress(5+percent*.95));
      await loadGenres();await load();
      showImportResult({addedCount,duplicateCount:pendingImport.duplicateCount,categoryCount,elapsed:(performance.now()-started)/1000,isRestore:pendingImport.isRestore});
    }catch(error){$('#importError').textContent=describeImportError(error);$('#importError').hidden=false;button.disabled=false;$('#importCancelButton').disabled=false;setImportProgress(0,'처리 중 오류가 발생했습니다.');}
  }

  function showImportResult(result){
    $('#importModalTitle').textContent=result.isRestore?'복원 완료':'업로드 완료';
    $('#importStats').innerHTML='<div class="import-stat"><span>추가된 곡</span><b>'+result.addedCount+'곡</b></div><div class="import-stat"><span>중복 건너뜀</span><b>'+result.duplicateCount+'곡</b></div><div class="import-stat"><span>새 카테고리</span><b>'+result.categoryCount+'개</b></div><div class="import-stat"><span>업로드 시간</span><b>'+result.elapsed.toFixed(1)+'초</b></div>';
    setImportProgress(100,'100%');$('#importStartButton').hidden=true;$('#importCancelButton').disabled=false;$('#importCancelButton').textContent='확인';pendingImport=null;$('#excelFileInput').value='';
  }

  // 현재 songs 전체를 복원 가능한 동일한 3열 형식으로 내려받습니다.
  async function downloadSongs(){
    const button=$('#excelDownloadButton');button.disabled=true;
    try{const {data,error}=await fetchAllSongs();if(error)throw error;const rows=(data||[]).map(song=>({'제목':song.title||'','가수':song.artist||'','장르':songGenres(song).join(',')}));const sheet=window.XLSX.utils.json_to_sheet(rows,{header:['제목','가수','장르']});const book=window.XLSX.utils.book_new();window.XLSX.utils.book_append_sheet(book,sheet,'노래목록');const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date());window.XLSX.writeFile(book,'노래목록_'+date+'.xlsx');toast('엑셀 백업을 저장했어요')}catch(error){toast(describeImportError(error))}finally{button.disabled=false}
  }

  function restoreSongs(){openExcelPicker(true)}
  function openExcelPicker(isRestore=false){const input=$('#excelFileInput');input.dataset.restore=String(isRestore);input.value='';input.click()}
  async function handleExcelFile(file,isRestore=false){if(!file)return;try{await previewImport(file,isRestore)}catch(error){toast(describeImportError(error))}}


  function renderImagePreview(selector,url,round=false){
    const box=$(selector);
    box.replaceChildren();
    if(!url){box.textContent='등록된 이미지가 없습니다.';return}
    const img=document.createElement('img');
    img.src=url;
    img.alt='이미지 미리보기';
    if(round)img.style.borderRadius='50%';
    img.onerror=()=>{box.textContent='이미지를 불러오지 못했어요.'};
    box.append(img);
  }

  const defaultPageSettings={
    id:1,
    eyebrow:'SPOON RADIO SONGBOOK',
    title:'은교의 노래책',
    description:'관리자가 등록한 곡을 검색하고 확인할 수 있어요.',
    hero_image_url:'',
    profile_image_url:'',
    notice_enabled:false,
    notice_text:'',
    background_color:'#fff5f8',
    accent_color:'#f584ad',
    spoon_url:'',
    youtube_url:'',
    instagram_url:'',
    support_url:'',
    request_url:'',
    request_button_text:'신청곡 보내기',hero_feather:0,hero_radius:24,hero_height:260,hero_fit:'cover',hero_position:'top',profile_position:'header',notice_position:'below_header',links_position:'below_header',content_align:'left'
  };

  async function loadPageSettings(){
    const {data,error}=await supabase.from('page_settings').select('*').eq('id',1).maybeSingle();
    if(error){toast('페이지 설정을 불러오지 못했어요');return}
    pageSettings={...defaultPageSettings,...(data||{})};
    $('#eyebrowInput').value=pageSettings.eyebrow||'';
    $('#mainTitleInput').value=pageSettings.title||'';
    $('#descriptionInput').value=pageSettings.description||'';
    $('#backgroundColorInput').value=pageSettings.background_color||'#fff5f8';
    $('#accentColorInput').value=pageSettings.accent_color||'#f584ad';
    $('#noticeEnabledInput').checked=pageSettings.notice_enabled===true;
    $('#noticeTextInput').value=pageSettings.notice_text||'';
    $('#spoonUrlInput').value=pageSettings.spoon_url||'';
    $('#youtubeUrlInput').value=pageSettings.youtube_url||'';
    $('#instagramUrlInput').value=pageSettings.instagram_url||'';
    $('#supportUrlInput').value=pageSettings.support_url||'';
    $('#requestUrlInput').value=pageSettings.request_url||'';
    $('#requestButtonTextInput').value=pageSettings.request_button_text||'신청곡 보내기';$('#heroFeatherInput').value=pageSettings.hero_feather??0;$('#heroFeatherValue').textContent=(pageSettings.hero_feather??0)+'%';$('#heroRadiusInput').value=pageSettings.hero_radius??24;$('#heroRadiusValue').textContent=(pageSettings.hero_radius??24)+'px';$('#heroHeightInput').value=pageSettings.hero_height??260;$('#heroHeightValue').textContent=(pageSettings.hero_height??260)+'px';$('#heroFitInput').value=pageSettings.hero_fit||'cover';$('#heroPositionInput').value=pageSettings.hero_position||'top';$('#profilePositionInput').value=pageSettings.profile_position||'header';$('#noticePositionInput').value=pageSettings.notice_position||'below_header';$('#linksPositionInput').value=pageSettings.links_position||'below_header';$('#contentAlignInput').value=pageSettings.content_align||'left';
    renderImagePreview('#heroImagePreview',pageSettings.hero_image_url||'');
    renderImagePreview('#profileImagePreview',pageSettings.profile_image_url||'',true);
  }

  async function uploadImage(file,prefix){
    if(!file)return '';
    if(!file.type.startsWith('image/'))throw new Error('이미지 파일만 업로드할 수 있어요');
    if(file.size>5*1024*1024)throw new Error('이미지는 5MB 이하만 업로드할 수 있어요');
    const ext=(file.name.split('.').pop()||'jpg').toLowerCase();
    const path=prefix+'/'+prefix+'-'+Date.now()+'.'+ext;
    const {error}=await supabase.storage.from('songbook-images').upload(path,file,{upsert:true});
    if(error)throw error;
    const {data}=supabase.storage.from('songbook-images').getPublicUrl(path);
    return data.publicUrl;
  }

  function validUrlOrEmpty(value){
    const v=value.trim();
    if(!v)return '';
    try{return new URL(v).toString()}catch(e){throw new Error('링크 주소는 https:// 형식으로 입력해 주세요')}
  }

  async function savePageSettings(){
    const button=$('#savePageSettingsButton');
    button.disabled=true;
    try{
      const heroFile=$('#heroImageInput').files[0];
      const profileFile=$('#profileImageInput').files[0];
      let heroImageUrl=pageSettings?.hero_image_url||'';
      let profileImageUrl=pageSettings?.profile_image_url||'';
      if(heroFile)heroImageUrl=await uploadImage(heroFile,'hero');
      if(profileFile)profileImageUrl=await uploadImage(profileFile,'profile');

      const payload={
        id:1,
        eyebrow:$('#eyebrowInput').value.trim(),
        title:$('#mainTitleInput').value.trim(),
        description:$('#descriptionInput').value.trim(),
        hero_image_url:heroImageUrl,
        profile_image_url:profileImageUrl,
        notice_enabled:$('#noticeEnabledInput').checked,
        notice_text:$('#noticeTextInput').value.trim(),
        background_color:$('#backgroundColorInput').value,
        accent_color:$('#accentColorInput').value,
        spoon_url:validUrlOrEmpty($('#spoonUrlInput').value),
        youtube_url:validUrlOrEmpty($('#youtubeUrlInput').value),
        instagram_url:validUrlOrEmpty($('#instagramUrlInput').value),
        support_url:validUrlOrEmpty($('#supportUrlInput').value),
        request_url:validUrlOrEmpty($('#requestUrlInput').value),
        request_button_text:$('#requestButtonTextInput').value.trim()||'신청곡 보내기',hero_feather:Number($('#heroFeatherInput').value),hero_radius:Number($('#heroRadiusInput').value),hero_height:Number($('#heroHeightInput').value),hero_fit:$('#heroFitInput').value,hero_position:$('#heroPositionInput').value,profile_position:$('#profilePositionInput').value,notice_position:$('#noticePositionInput').value,links_position:$('#linksPositionInput').value,content_align:$('#contentAlignInput').value,
        updated_at:new Date().toISOString()
      };

      const {error}=await supabase.from('page_settings').upsert(payload,{onConflict:'id'});
      if(error)throw error;
      pageSettings=payload;
      $('#heroImageInput').value='';
      $('#profileImageInput').value='';
      renderImagePreview('#heroImagePreview',heroImageUrl);
      renderImagePreview('#profileImagePreview',profileImageUrl,true);
      toast('페이지 설정을 저장했어요');
    }catch(err){
      toast(err.message||'페이지 설정 저장에 실패했어요');
    }finally{
      button.disabled=false;
    }
  }

  async function updateImageField(field){
    const label=field==='hero_image_url'?'대표 이미지':'프로필 이미지';
    if(!confirm('등록된 '+label+'를 삭제할까요?'))return;
    const payload={...defaultPageSettings,...pageSettings,[field]:'',updated_at:new Date().toISOString()};
    const {error}=await supabase.from('page_settings').upsert(payload,{onConflict:'id'});
    if(error){toast(label+'를 삭제하지 못했어요');return}
    pageSettings=payload;
    if(field==='hero_image_url'){
      $('#heroImageInput').value='';
      renderImagePreview('#heroImagePreview','');
    }else{
      $('#profileImageInput').value='';
      renderImagePreview('#profileImagePreview','',true);
    }
    toast(label+'를 삭제했어요');
  }

async function refreshAuth(){if(!configured){$('#setup').hidden=false;return}const {data:{user}}=await supabase.auth.getUser();let active=false;if(user){const {data}=await supabase.rpc('is_songbook_admin');active=data===true}$('#authCard').hidden=active;$('#dashboard').hidden=!active;$('#authButton').textContent=active?'로그아웃':'로그인';$('#userStatus').textContent=active?(user.email+' · 관리 중'):(user?'관리자 권한이 없는 계정입니다.':'관리자 계정으로 로그인해 주세요.');if(active){await loadPageSettings();await loadGenres();load()}}
  $('#loginButton').onclick=async()=>{if(!configured){toast('연결 설정이 먼저 필요해요');return}const {error}=await supabase.auth.signInWithPassword({email:$('#email').value.trim(),password:$('#password').value});if(error){toast('로그인 정보를 확인해 주세요');return}await refreshAuth();if($('#dashboard').hidden)toast('관리자 권한이 없는 계정이에요')};$('#authButton').onclick=async()=>{if(!configured)return;if((await supabase.auth.getUser()).data.user){await supabase.auth.signOut();toast('로그아웃했어요');refreshAuth()}else $('#email').focus()};
  $('#addButton').onclick=addSong;$('#cancelEditButton').onclick=resetForm;$('#titleInput').addEventListener('keydown',x=>{if(x.key==='Enter')addSong()});
  $('#adminSongSearch').addEventListener('input',ev=>{songSearchQuery=ev.target.value;songPage=1;render()});
  $('#adminGenreSearch').addEventListener('input',ev=>{genreSearchQuery=ev.target.value;renderGenreManage()});
  $('#addGenreButton').onclick=addGenre;$('#newGenreInput').addEventListener('keydown',x=>{if(x.key==='Enter')addGenre()});
  $('#selectAllCheckbox').onchange=ev=>{const visible=filteredSongs();if(ev.target.checked)visible.forEach(s=>selectedSongIds.add(s.id));else visible.forEach(s=>selectedSongIds.delete(s.id));render()};
  $('#bulkClearButton').onclick=()=>{selectedSongIds.clear();render()};
  $('#bulkAddButton').onclick=()=>bulkApply('add');
  $('#bulkRemoveButton').onclick=()=>bulkApply('remove');
  $('#bulkReplaceButton').onclick=()=>{if(confirm('선택한 곡들의 카테고리를 지금 고른 카테고리로 전부 바꿀까요? 기존 태그는 사라져요.'))bulkApply('replace')};
  $('#savePageSettingsButton').onclick=savePageSettings;
  $('#pageSettingsToggleButton').onclick=()=>{const panel=$('#pageSettingsPanel');const expanded=panel.hidden;panel.hidden=!expanded;$('#pageSettingsToggleButton').textContent=expanded?'접기':'펼치기';$('#pageSettingsToggleButton').setAttribute('aria-expanded',String(expanded))};
  $('#removeHeroImageButton').onclick=()=>updateImageField('hero_image_url');
  $('#removeProfileImageButton').onclick=()=>updateImageField('profile_image_url');
  $('#heroImageInput').addEventListener('change',ev=>{const file=ev.target.files[0];renderImagePreview('#heroImagePreview',file?URL.createObjectURL(file):(pageSettings?.hero_image_url||''));});
  $('#profileImageInput').addEventListener('change',ev=>{const file=ev.target.files[0];renderImagePreview('#profileImagePreview',file?URL.createObjectURL(file):(pageSettings?.profile_image_url||''),true);});
  $('#heroFeatherInput').addEventListener('input',ev=>$('#heroFeatherValue').textContent=ev.target.value+'%');
  $('#heroRadiusInput').addEventListener('input',ev=>$('#heroRadiusValue').textContent=ev.target.value+'px');
  $('#heroHeightInput').addEventListener('input',ev=>$('#heroHeightValue').textContent=ev.target.value+'px');
  $('#excelUploadButton').onclick=()=>openExcelPicker(false);
  $('#dataManagementToggleButton').onclick=()=>{const panel=$('#dataManagementPanel');const expanded=panel.hidden;panel.hidden=!expanded;$('#dataManagementToggleButton').textContent=expanded?'접기':'펼치기';$('#dataManagementToggleButton').setAttribute('aria-expanded',String(expanded))};
  $('#restoreButton').onclick=restoreSongs;
  $('#excelDownloadButton').onclick=downloadSongs;
  $('#excelFileInput').addEventListener('change',event=>handleExcelFile(event.target.files[0],event.target.dataset.restore==='true'));
  $('#importStartButton').onclick=startPendingImport;
  $('#importCancelButton').onclick=()=>{if($('#importCancelButton').disabled)return;$('#importModal').hidden=true;pendingImport=null;$('#excelFileInput').value=''};
  const excelDropZone=$('#excelDropZone');
  excelDropZone.onclick=()=>openExcelPicker(false);
  excelDropZone.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openExcelPicker(false)}};
  ['dragenter','dragover'].forEach(type=>excelDropZone.addEventListener(type,event=>{event.preventDefault();excelDropZone.classList.add('dragover')}));
  ['dragleave','drop'].forEach(type=>excelDropZone.addEventListener(type,event=>{event.preventDefault();excelDropZone.classList.remove('dragover')}));
  excelDropZone.addEventListener('drop',event=>handleExcelFile(event.dataTransfer.files[0],false));
  refreshAuth();if(configured){supabase.channel('songbook-admin').on('postgres_changes',{event:'*',schema:'public',table:'songs'},load).subscribe();supabase.channel('songbook-admin-genres').on('postgres_changes',{event:'*',schema:'public',table:'genres'},loadGenres).subscribe();supabase.channel('songbook-admin-settings').on('postgres_changes',{event:'*',schema:'public',table:'page_settings'},loadPageSettings).subscribe();}
