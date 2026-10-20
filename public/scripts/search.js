const form = document.querySelector('#search-form');
  const input = document.querySelector('#search-input');
  const status = document.querySelector('#search-status');
  const list = document.querySelector('#search-results');
  let generation = 0;
  let timer;
  // The generated module is loaded from the final static artifact, not bundled by Vite.
  const indexUrl = form.dataset.indexUrl;
  let engine;
  async function search() {
    const current = ++generation;
    const term = input.value.trim();
    const url = new URL(location.href); term ? url.searchParams.set('q', term) : url.searchParams.delete('q'); history.replaceState(null, '', url);
    list.replaceChildren();
    if (form.dataset.dev === 'true') { status.textContent = '검색은 npm run build 후 정적 미리보기에서 확인해 주세요.'; return; }
    if (!Number(form.dataset.count)) { status.textContent = '아직 게시된 글이 없습니다.'; return; }
    if (!term) { status.textContent = '검색어를 입력해 주세요.'; return; }
    status.textContent = '검색 중입니다…';
    try {
      engine ??= import(indexUrl);
      const pagefind = await engine;
      await pagefind.options({ baseUrl: form.dataset.baseUrl });
      const result = await pagefind.search(term);
      const items = await Promise.all(result.results.map((item) => item.data()));
      if (current !== generation) return;
      for (const item of items) {
        const row = document.createElement('li'); const heading = document.createElement('h2'); const link = document.createElement('a');
        link.href = item.url; link.textContent = item.meta.title || '제목 없는 글'; heading.append(link);
        const summary = document.createElement('p'); summary.textContent = item.meta.description || '';
        row.append(heading, summary); list.append(row);
      }
      status.textContent = items.length ? `${items.length}개의 기록을 찾았습니다.` : '일치하는 글이 없습니다.';
    } catch (error) {
      console.error('검색 인덱스를 읽지 못했습니다.', error);
      if (current !== generation) return;
      engine = undefined; status.textContent = '검색을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
    }
  }
  form.addEventListener('submit', event => { event.preventDefault(); clearTimeout(timer); void search(); });
  input.addEventListener('input', () => { ++generation; clearTimeout(timer); timer = setTimeout(search, 250); });
  input.value = new URL(location.href).searchParams.get('q') || '';
  if (input.value) void search();
