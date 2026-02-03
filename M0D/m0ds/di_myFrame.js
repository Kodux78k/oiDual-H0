
  class MyFrameLoader extends HTMLElement {
    constructor(){
      super();
      this.attachShadow({mode:'open'});
      this.shadowRoot.innerHTML = `
        <style>
          .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999}
          .box{width:92%;height:86%;background:#071017;border-radius:12px;overflow:hidden;display:flex;flex-direction:column}
          .top{display:flex;justify-content:flex-end;padding:8px}
          button{background:transparent;border:0;color:#fff;font-size:18px;cursor:pointer;padding:6px}
          iframe{flex:1;border:0}
        </style>
        <div class="overlay">
          <div class="box">
            <div class="top"><button class="close">✖</button></div>
            <iframe></iframe>
          </div>
        </div>`;
      this.iframe = this.shadowRoot.querySelector('iframe');
      this.shadowRoot.querySelector('.close').onclick = ()=> this.remove();
    }
    set src(v){ this.iframe.src = v; }
  }
  customElements.define('my-frame-loader', MyFrameLoader);
