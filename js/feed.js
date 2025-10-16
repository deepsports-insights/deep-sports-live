
const DS = (() => {
  const esc = s => (s ?? '').toString()
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const stamp = () => new Date().toLocaleTimeString();

  async function get(url){
    const u = url + (url.includes('?') ? '&' : '?') + '_=' + Date.now();
    const r = await fetch(u, {cache:'no-store'});
    if(!r.ok) throw new Error('HTTP '+r.status);
    return r.json();
  }

  // Acepta string, objeto o array
  function normalize(payload){
    if (payload == null) return [];
    if (Array.isArray(payload)) return payload;
    if (typeof payload === 'string'){
      return [{ text: payload, time: stamp(), level: 'ok' }];
    }
    if (typeof payload === 'object'){
      return [{
        text: payload.text ?? JSON.stringify(payload),
        time: payload.time ?? stamp(),
        level: payload.level || 'ok',
        total: payload.total ?? payload.score ?? payload.totalPts ?? null,
        scored: payload.scored ?? (payload.event === 'score') || false
      }];
    }
    return [{ text: String(payload), time: stamp(), level:'ok' }];
  }

  function itemHTML(x){
    const lv = (x.level||'').toLowerCase();
    const cls = lv==='err' ? 'err' : lv==='warn' ? 'warn' : 'ok';
    return `
      <div class="msg">
        <div class="row">
          <span class="${cls}">${esc(x.text || '')}</span>
          <span class="time">${esc(x.time || '')}</span>
        </div>
      </div>`;
  }

  function render(list, el){
    const arr = normalize(list);
    if(!arr.length){
      el.innerHTML = `<div class="msg empty">Sin datos…</div>`;
      return;
    }
    const toRender = Array.isArray(list) ? list : arr;
    el.innerHTML = toRender.map(itemHTML).join('');
  }

  // ---------- Detección de anotación ----------
  function parseZPCTotalQuarter(text){
    const str = String(text || '');
    const lines = str.split(/\r?\n/);

    for (const line of lines){
      if (line.includes('🆚')){
        const pts = line.match(/🧮\s*(\d{1,3})\s*pts/i);
        const vs  = line.match(/(\d{1,3})\s*🆚\s*(\d{1,3})/);
        if (pts) return +pts[1];
        if (vs)  return (+vs[1]) + (+vs[2]);
      }
    }
    const allPts = [...str.matchAll(/🧮\s*(\d{1,3})\s*pts/gi)];
    if (allPts.length) return +allPts[allPts.length - 1][1];
    return null;
  }

  let lastTotals = { L: null, R: null };

  function triggerScoreFX(which){
    const panel = document.getElementById(which === 'L' ? 'panelL' : 'panelR');
    if(!panel) return;
    panel.classList.remove('score'); void panel.offsetWidth; panel.classList.add('score');
  }

  function checkScoreEvent(side, normalized){
    const last = normalized[normalized.length - 1];
    if (!last) return;

    if (last.scored === true){ triggerScoreFX(side); return; }

    if (last.total != null && !isNaN(+last.total)){
      const t = +last.total, prev = lastTotals[side];
      if (prev == null) { lastTotals[side] = t; return; }
      if (t > prev) { triggerScoreFX(side); lastTotals[side] = t; return; }
      lastTotals[side] = t; return;
    }

    const inferred = parseZPCTotalQuarter(last.text);
    const prev = lastTotals[side];
    if (inferred != null){
      if (prev == null) { lastTotals[side] = inferred; return; }
      if (inferred > prev) { triggerScoreFX(side); lastTotals[side] = inferred; return; }
      lastTotals[side] = inferred;
    }
  }

  function initDual({url1, url2, interval}){
    const feedL = document.getElementById('feedL');
    const feedR = document.getElementById('feedR');
    const status = document.getElementById('status');

    async function tick(){
      try{
        const [a,b] = await Promise.allSettled([get(url1), get(url2)]);

        if(a.status==='fulfilled'){
          const normA = normalize(a.value);
          render(a.value, feedL);
          checkScoreEvent('L', normA);
        }
        if(b.status==='fulfilled'){
          const normB = normalize(b.value);
          render(b.value, feedR);
          checkScoreEvent('R', normB);
        }

        status.textContent = `OK • ${stamp()}`;
      }catch(e){
        status.textContent = `ERROR • ${stamp()}`;
      }finally{
        setTimeout(tick, interval);
      }
    }
    tick();
  }

  return { initDual };
})();
