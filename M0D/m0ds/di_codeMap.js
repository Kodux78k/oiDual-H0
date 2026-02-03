
(function(){
  const frame = document.getElementById('frame');
  const uploadInput = document.getElementById('uploadHTML');
  const uploadBtn = document.getElementById('uploadComponentBtn');
  const remoteBtn = document.getElementById('remoteComponentBtn');
  const toggleDecoderBtn = document.getElementById('toggleDecoderBtn');
  const decoderBox = document.getElementById('decoderBox');
  const decodeBtn = document.getElementById('decodeBtn');
  const closeDecoder = document.getElementById('closeDecoder');
  const codeInput = document.getElementById('codeInput');
  const pulsos = document.getElementById('pulsos');

  const CODE_MAP = {
    "DUAL":"menu.html",
    "KBX":"menu-x-1.html",
    "ATVR":"render-response.html",
    "337":"KOBLLUX_MetaLux_CLEANED.html"
  };

  function logMistico(msg){
    const el = document.createElement('div');
    el.className = 'debug';
    el.textContent = '◉ ' + msg;
    pulsos.prepend(el);
    // auto-trim
    while(pulsos.children.length > 80) pulsos.removeChild(pulsos.lastChild);
  }

  // load page into main iframe (with small fade)
  function loadPage(url){
    frame.style.opacity = 0;
    setTimeout(()=> {
      frame.src = url;
      frame.onload = ()=> frame.style.opacity = 1;
    }, 220);
    logMistico('Carregando: ' + url);
  }

  // symbol bar clicks
  document.querySelectorAll('.symbol-button').forEach(b=>{
    b.addEventListener('click', e=>{
      const url = b.dataset.url || 'about:blank';
      loadPage(url);
    });
    b.addEventListener('contextmenu', e=>{
      e.preventDefault();
      const url = b.dataset.url || 'about:blank';
      const label = b.textContent || '•';
      logMistico(`Editar símbolo: ${label} -> ${url} (use editor separado)`);
    });
  });

  // upload local HTML into modal viewer
  uploadBtn.addEventListener('click', ()=> uploadInput.click());
  uploadInput.addEventListener('change', e=>{
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (!f.name.endsWith('.html')) return alert('Selecione um arquivo .html');
    const r = new FileReader();
    r.onload = ev=>{
      const blob = new Blob([ev.target.result], {type:'text/html'});
      const url = URL.createObjectURL(blob);
      const modal = document.createElement('my-frame-loader');
      modal.src = url;
      document.body.appendChild(modal);
      logMistico('Preview local: ' + f.name);
    };
    r.readAsText(f);
  });

  // remote component modal
  remoteBtn.addEventListener('click', ()=>{
    const url = prompt('URL do componente remoto:');
    if (!url) return;
    const modal = document.createElement('my-frame-loader');
    modal.src = url;
    document.body.appendChild(modal);
    logMistico('Aberto remoto: ' + url);
  });

  // decoder
  toggleDecoderBtn.addEventListener('click', ()=>{
    decoderBox.style.display = decoderBox.style.display === 'none' ? 'block' : 'none';
    decoderBox.setAttribute('aria-hidden', decoderBox.style.display === 'none');
  });
  closeDecoder.addEventListener('click', ()=> decoderBox.style.display = 'none');
  decodeBtn.addEventListener('click', ()=>{
    const code = (codeInput.value || '').trim().toUpperCase();
    if (!code) return alert('Digite o selo');
    const dest = CODE_MAP[code];
    if (dest){
      const modal = document.createElement('my-frame-loader');
      modal.src = dest;
      document.body.appendChild(modal);
      decoderBox.style.display = 'none';
      logMistico('Selo válidado: ' + code + ' → ' + dest);
    } else {
      alert('Selo desconhecido.');
      logMistico('Selo desconhecido: ' + code);
    }
  });

  // simple postMessage integration for pulses from iframe (if desired)
  window.addEventListener('message', e=>{
    if (e.data?.type === 'iframeClick'){
      const x = e.data.x, y = e.data.y;
      logMistico('Pulso do iframe em ' + x + ',' + y);
    }
  });

  // small keyboard shortcuts
  document.addEventListener('keydown', (ev)=>{
    if (ev.key === 't' && (ev.ctrlKey || ev.metaKey)){ // ctrl/cmd + t = toggle decoder
      ev.preventDefault();
      decoderBox.style.display = decoderBox.style.display === 'none' ? 'block' : 'none';
    }
  });

  // init
  (function init(){
    logMistico('Dual.Infodose LITe inicializado');
    // load saved layout (simple example)
    const last = localStorage.getItem('dual_last');
    if (last) frame.src = last;
    // save main iframe changes
    frame.addEventListener('load', ()=> localStorage.setItem('dual_last', frame.src));
  })();

})();
