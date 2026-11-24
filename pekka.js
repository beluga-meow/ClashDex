/* pekka.js black + gold theme (loaded after app.js styles) */
:root{--cx-p1:#16130c;--cx-p2:#1d180d;--cx-p3:#4a3a14;--cx-w1:#2a2312;--cx-w2:#1c170b;--cx-w3:#120f07;--cx-w4:#0b0905;
--cx-ink:#f6ecd0;--cx-ink2:#c4b07a;--cx-line:#000;--cx-n1:#ffe778;--cx-n2:#f7b823;--cx-n3:#8a5a05;
--g:#ffd21f;--g2:#f7b823;--bg:#0b0b0b;--card:#121212;--ln:#4a3a14}
html,body{background:#0b0b0b!important;color:#f6ecd0}
html.cx body{background:radial-gradient(900px 500px at 15% -5%,#2b2208,transparent 60%),#0b0b0b!important}
html.cx .season-effects,html.cx .hero-art,html.cx .cx-clouds,html.cx .cx-trees{opacity:.35}
html.cx .site-header,html.cx .site-footer,html.cx .announcement,html.cx .cx-tabbar{background:#111!important;border-color:var(--ln)!important;color:#f6ecd0}
html.cx .cx-panel,html.cx .auth-panel,html.cx .content-card,html.cx .modal,html.cx .cx-sheet{background:var(--card)!important;border:1px solid var(--ln)!important;color:#f6ecd0!important}
html.cx h1,html.cx h2,html.cx h3,html.cx h4{color:var(--g)!important;text-shadow:none!important}
html.cx p,html.cx small,html.cx label,html.cx .form-note,html.cx .section-subtitle{color:#c9bb92!important}
html.cx input,html.cx select,html.cx textarea{background:#0b0b0b!important;color:#f6ecd0!important;border:1px solid var(--ln)!important;border-radius:14px}
html.cx input::placeholder{color:#7d6f4a}
html.cx .button-green,html.cx .cx-btn.green,html.cx .button-gold,html.cx .header-cta{background:linear-gradient(#ffe778,#f7b823)!important;color:#1a1200!important;border:0!important;text-shadow:none!important;border-radius:999px;font-weight:800}
html.cx .cx-btn.blue,html.cx .small-action,html.cx .button-ghost{background:#17130a!important;color:var(--g)!important;border:1px solid var(--g)!important;border-radius:999px}
html.cx .filter-chip,html.cx .cx-chip{background:#17130a!important;color:#e9d9a4!important;border:1px solid var(--ln)!important}
html.cx .filter-chip.selected,html.cx .cx-chip.on,html.cx .cx-chip.sel{background:var(--g)!important;color:#1a1200!important}
html.cx .cx-th{background:linear-gradient(#ffe778,#f7b823)!important;border-color:#8a5a05!important}
html.cx .cx-tabbar a{color:#c9bb92}html.cx .cx-tabbar a.on{color:var(--g)}
/* shared vault components */
.v-wrap{display:grid;gap:18px}
.v-grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(250px,1fr))}
.v-card{background:var(--card);border:1px solid var(--ln);border-top:3px solid var(--g);border-radius:22px;padding:16px;display:grid;gap:12px}
.v-rank{background:var(--g);color:#1a1200;font-weight:900;border-radius:999px;padding:3px 10px;font-size:13px}
.v-head{display:flex;align-items:center;gap:10px}.v-head h3{margin:0;flex:1;font-size:19px}
.v-score{color:#c9bb92;font-weight:700}.v-score:before{content:"";display:inline-block;width:10px;height:10px;border-radius:50%;background:#ef4444;margin-right:6px}
.v-troops{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.v-troop{aspect-ratio:1;border-radius:14px;background:#0b0b0b;border:2px solid var(--ln);display:grid;place-items:center;text-align:center;font-size:26px;padding:2px}
.v-troop small{font-size:10px;line-height:1.1;color:#c9bb92!important;display:block}
.v-troop.epic{border-color:#a855f7}.v-troop.rare{border-color:#f97316}
.v-perf{background:#0b0b0b;border-radius:18px;padding:12px;display:grid;gap:10px}
.v-perf-h{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--ln);padding-bottom:8px}
.v-perf-h b{color:var(--g)}.v-ai{background:#2a2208;color:#ffd21f;border-radius:999px;padding:3px 10px;font-size:12px}
.v-row{display:flex;justify-content:space-between;font-weight:800;font-size:13px;color:#e9d9a4}
.v-bar{height:7px;border-radius:9px;background:#222;overflow:hidden;margin-top:5px}.v-bar i{display:block;height:100%;width:0;border-radius:9px;transition:width .9s cubic-bezier(.2,.9,.3,1.2)}
.v-GODLY{color:#ffd21f}.v-GREAT{color:#4ade80}.v-GOOD{color:#38bdf8}.v-MEDIOCRE{color:#fb923c}
.v-btn{justify-self:end;background:#17130a;color:var(--g);border:1px solid var(--g);border-radius:999px;padding:12px 20px;font-weight:800;cursor:pointer;font-size:15px}
.v-btn:active{transform:scale(.96)}
/* sceneries */
.v-scene{position:relative;min-height:190px;border-radius:24px;overflow:hidden;border:1px solid var(--ln);cursor:pointer;padding:0;color:#fff;text-align:left;display:flex;align-items:flex-end;transition:transform .25s,box-shadow .25s}
.v-scene:hover,.v-scene:focus-visible{transform:translateY(-4px) scale(1.02);box-shadow:0 12px 30px rgba(255,210,31,.25)}
.v-scene:active{transform:scale(.97)}
.v-scene span{position:relative;padding:14px;font:800 20px system-ui;background:linear-gradient(transparent,#000c);width:100%}
.v-scene em{position:absolute;top:12px;left:14px;font-size:44px;font-style:normal;animation:vfloat 3s ease-in-out infinite}
@keyframes vfloat{50%{transform:translateY(-8px)}}
.v-pop{position:fixed;inset:0;z-index:90;background:#000b;display:grid;place-items:center;padding:16px;animation:vfade .25s}
.v-pop>div{width:min(460px,100%);background:#121212;border:2px solid var(--g);border-radius:26px;overflow:hidden;animation:vpop .45s cubic-bezier(.2,1.4,.4,1)}
.v-pop .art{height:180px;display:grid;place-items:center;font-size:84px}.v-pop .art b{animation:vfloat 2.4s infinite}
.v-pop .bd{padding:18px;display:grid;gap:10px}
@keyframes vpop{from{transform:scale(.6) rotate(-3deg);opacity:0}}@keyframes vfade{from{opacity:0}}
/* hero pages */
.v-page{position:fixed;inset:0;z-index:80;background:#0b0b0b;overflow:auto;padding:16px 16px 90px;animation:vfade .2s}
.v-page .in{max-width:900px;margin:auto;display:grid;gap:16px}
.v-tabs{display:flex;gap:8px}.v-tabs button{flex:1;padding:12px;border-radius:999px;background:#17130a;color:#c9bb92;border:1px solid var(--ln);font-weight:800;font-size:15px}
.v-tabs button.on{background:var(--g);color:#1a1200}
.v-hero-top{display:flex;gap:14px;align-items:center;background:var(--card);border:1px solid var(--ln);border-radius:24px;padding:16px}
.v-hero-top .ic{font-size:54px}.v-eq{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}
.v-eqi{background:var(--card);border:1px solid var(--ln);border-radius:18px;padding:14px;display:flex;gap:10px;align-items:center}
.v-eqi.epic{border-color:#a855f7}.v-eqi i{font-size:28px;font-style:normal}
.v-empty{border:2px dashed var(--ln);border-radius:20px;padding:22px;text-align:center;color:#c9bb92}
/* cartoony loader */
.v-load{position:absolute;inset:0;z-index:5;background:#121212f2;border-radius:inherit;display:none;place-content:center;gap:14px;text-align:center;padding:20px}
.v-load.on{display:grid}.v-load b{color:var(--g);font:900 20px system-ui}
.v-track{width:min(280px,70vw);height:26px;border:3px solid #000;border-radius:999px;background:#2a2208;overflow:hidden;box-shadow:0 3px 0 #8a5a05;position:relative;margin:auto}
.v-track i{position:absolute;inset:0;width:40%;border-radius:999px;background:repeating-linear-gradient(-45deg,#ffe778 0 12px,#f7b823 12px 24px);animation:vslide 1.1s ease-in-out infinite alternate;border-right:3px solid #000}
@keyframes vslide{from{left:0}to{left:60%}}
.auth-panel{position:relative}
@media(prefers-reduced-motion:reduce){*{animation-duration:.01s!important;transition-duration:.01s!important}}
