(()=>{'use strict';
// Centralize the visible release notes. Bump RELEASE_VERSION whenever you publish a named release.
const RELEASE_VERSION='10.4.2';
const RELEASE_BUILD_ID='2026.10.13-ui-polish-1';
const RELEASE_ASSET_TAG=RELEASE_VERSION+'-'+RELEASE_BUILD_ID.replace(/^(\d{4})\.(\d{2})\.(\d{2})-/, '$1$2$3-');
const RELEASE_HISTORY=[
 {version:'10.4.2',title:'Inicialização mais resiliente e erros explicados',desc:'Falhas conhecidas agora vêm com orientações claras e uma opção para tentar novamente.',icon:'shield'},
 {version:'10.4.2',title:'Armazenamento local mais seguro',desc:'Preferências do navegador não devem impedir a abertura quando o armazenamento está bloqueado.',icon:'database'},
 {version:'10.4.0',title:'Identidade visual em todo o site',desc:'Cores, ícones e componentes seguem uma linguagem visual mais consistente, sem perder personalidade.',icon:'palette'},
 {version:'10.4.0',title:'Uma experiência mais fluida',desc:'Menus, espaçamentos e áreas de toque foram ajustados para facilitar o uso no computador e no celular.',icon:'sparkles'},
 {version:'10.4.0',title:'Mais cor, com equilíbrio',desc:'Destaques coloridos ajudam a reconhecer cada área, com fundos suaves e contraste confortável.',icon:'palette'},
 {version:'10.3.1',title:'Atualizações mais discretas e roláveis',desc:'A lista de novidades agora tem rolagem própria, com cabeçalho e ação sempre acessíveis e um indicador visual neutro.'},
 {version:'10.3.1',title:'Correção da estrutura das salas',desc:'Migração específica para criar os registros diários por sala e atualizar o cache de esquema do Supabase.'},
 {version:'10.3.0',title:'Uma central para a vida pessoal',desc:'Nova tela inicial com visão do dia, atalhos para todas as áreas e resumo do planejamento, sem esconder o acompanhamento de treinos.'},
 {version:'10.3.0',title:'Metas, projetos e hábitos',desc:'Nova área de organização com criação e acompanhamento de metas e projetos, além de registro diário de hábitos.'},
 {version:'10.3.0',title:'Navegação renovada',desc:'Áreas mais claras, identidade visual consistente e uma navegação móvel ajustada para telas pequenas.'},
 {version:'10.2.0',title:'Planejador semanal e mensal',desc:'Novo módulo de tarefas com datas, prioridades, categorias, visão semanal e mensal e suporte a tarefas pessoais ou compartilhadas em salas.'},
 {version:'10.2.0',title:'Tarefas pessoais e compartilhadas',desc:'Cada tarefa tem prioridade, categoria e data opcional. Tarefas da sala ficam restritas aos participantes e a edição respeita os papéis.'},
 {version:'10.2.0',title:'Base segura para a expansão',desc:'O planejador usa rotas autenticadas, validação no servidor e migração aditiva, mantendo separados os registros de treino existentes.'},
 {version:'10.1.2',title:'Ajuda ao lado do título',desc:'O atalho de ajuda fica junto ao título superior e acompanha as instruções da página aberta.'},
 {version:'10.1.2',title:'Novidades e arquivos versionados',desc:'HTML, CSS, JavaScript e favicon usam o mesmo identificador de build; o histórico agora descreve as mudanças desta versão.'},
 {version:'10.1.2',title:'Registros separados por espaço',desc:'Após aplicar a migração de banco incluída, os registros pessoais ficam separados dos registros de cada sala.'},
 {version:'10.1.2',title:'Salas com atualização automática',desc:'A tela de sala consulta mudanças periodicamente enquanto está visível, sem exigir recarga manual.'},
 {version:'10.0.0',title:'Radar hexagonal com seis dimensões',desc:'Consistência, categorias de registro e pontuação média usam a mesma escala visual de 0 a 100.'}
];
// Capture the original asset URLs before the theme system turns the favicon into an SVG data URL.
const RELEASE_ASSET_URLS=(()=>{
 const urls=[];
 try{if(document.currentScript?.src)urls.push(new URL(document.currentScript.src,location.href).href)}catch{}
 try{urls.push(new URL(location.pathname,location.origin).href)}catch{}
 document.querySelectorAll('script[src],link[rel="stylesheet"],link[rel~="icon"]').forEach(link=>{
  try{const u=new URL(link.href||link.src,location.href);if(u.origin===location.origin&&!u.href.startsWith('data:'))urls.push(u.href)}catch{}
 });
 try{urls.push(new URL('/favicon.svg?v='+encodeURIComponent(RELEASE_ASSET_TAG),location.origin).href)}catch{}
 try{urls.push(new URL('/js/modules/planner.js?v='+encodeURIComponent(RELEASE_ASSET_TAG),location.origin).href)}catch{}
 try{urls.push(new URL('/js/modules/organizer.js?v='+encodeURIComponent(RELEASE_ASSET_TAG),location.origin).href)}catch{}
 return [...new Set(urls)];
})();
const RELEASE_SEEN_BUILD_KEY='shape_together_seen_build_v1';
const RELEASE_SEEN_VERSION_KEY='shape_together_seen_version_v1';
const LOCAL_KEY='shape_together_local_v6',THEME_KEY='shape_together_theme_v7',ACCENT_KEY='shape_together_accent_v7',START='2026-09-29',END='2026-12-31';
const DEFAULT_ACCENTS={light:'#236B4E',dark:'#B9E4C7'};
const LEGACY_DEFAULT_ACCENTS={light:'#11120F',dark:'#F5F3ED'};
function migrateDefaultAccent(value,mode){const candidate=hex(value);return !candidate||candidate===LEGACY_DEFAULT_ACCENTS[mode]?DEFAULT_ACCENTS[mode]:candidate;}
const COLORS=['#4C7DFF','#E6536F','#19A779','#8A63D2','#E6A23C','#1F9CAA','#D84B9B'];
const THEME_COLORS=[{name:'Azul',hex:'#2563EB'},{name:'Marinho',hex:'#1E40AF'},{name:'Petróleo',hex:'#0F766E'},{name:'Esmeralda',hex:'#047857'},{name:'Floresta',hex:'#166534'},{name:'Violeta',hex:'#6D28D9'},{name:'Índigo',hex:'#4338CA'},{name:'Vinho',hex:'#9F1239'},{name:'Terracota',hex:'#C2410C'},{name:'Âmbar',hex:'#B45309'},{name:'Ciano',hex:'#0E7490'},{name:'Grafite',hex:'#475569'}];
let defaultWorkspaceDraftMode=null,defaultWorkspaceDraftGroupId=null;
const STATUS={red:{label:'Não treinou',desc:'Sem treino',value:0},blue:{label:'Descanso',desc:'Descanso',value:3},orange:{label:'Treinou, mas não foi tão bom',desc:'Abaixo do esperado',value:6},green:{label:'Treinou bem',desc:'Treino bom',value:10}};
const PAGES={home:['Visão geral','Sua vida em um só lugar'],planner:['Planejador','Organize tarefas e prazos'],life:['Metas & hábitos','Construa o que importa'],calendar:['Treinos','Registre seus dias e treinos'],progress:['Progresso','Histórico e evolução'],notes:['Diário','Suas anotações'],group:['Espaços','Pessoas e colaboração']};
const NAV=[['home','Início','home'],['planner','Planejador','planner'],['life','Metas & hábitos','life'],['calendar','Treinos','calendar'],['progress','Progresso','chart'],['notes','Diário','notes'],['group','Espaços','group']];
const MOBILE_NAV_GROUPS=[['home','Início','home',['home']],['organize','Organizar','organize',['planner','life']],['training','Treino','dumbbell',['calendar','progress']],['spaces','Espaços','group',['group','notes']]];
let mobileNavGroup='home';
let online=false,googleEnabled=false,currentUser=null,state=null,page='home',workspaceMode='personal',workspaceMenuOpen=false,calendarDate=new Date(),calendarMemberId=null,selectedDate=null,selectedStatus=null,appearanceTrigger=null,compareIds=new Set(),savingDay=false,savingProfile=false,workspaceDialogMode='create',workspaceBusy=false;
const $=id=>document.getElementById(id);
// O bloqueio de localStorage em modo privado/restrito não deve derrubar toda a interface.
function storageGet(key){try{return window.localStorage.getItem(key)}catch{return null}}
function storageSet(key,value){try{window.localStorage.setItem(key,value);return true}catch{return false}}
function icon(name){const c='class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';const p={home:`<svg ${c}><path d="M3 10.8 12 3l9 7.8"/><path d="M5.5 9.5v10h13v-10"/><path d="M9.5 19.5v-6h5v6"/></svg>`,calendar:`<svg ${c}><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 9h18"/></svg>`,chart:`<svg ${c}><path d="m4 16 4-4 4 3 7-8"/><path d="M4 20h16"/></svg>`,notes:`<svg ${c}><rect x="5" y="4" width="14" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>`,group:`<svg ${c}><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3.8 19c.7-3.1 2.4-4.7 5.2-4.7s4.5 1.6 5.2 4.7"/><path d="M14.5 14.7c2.7 0 4.3 1.3 4.9 3.8"/></svg>`,planner:`<svg ${c}><rect x="4" y="5" width="16" height="16" rx="2.5"/><path d="M8 3v4M16 3v4M4 9h16M8 13h3M8 17h7"/></svg>`,life:`<svg ${c}><path d="M12 20s-7-4.2-8.5-8.4C2.3 8.1 4.5 5 7.5 5c1.9 0 3.2 1 4.5 2.5C13.3 6 14.6 5 16.5 5c3 0 5.2 3.1 4 6.6C19 15.8 12 20 12 20Z"/><path d="M8.8 12.3h2l1.2-2.2 1.5 4 1-1.8h1.7"/></svg>` ,organize:`<svg ${c}><rect x="4" y="4" width="16" height="17" rx="3"/><path d="M8 2.8v3M16 2.8v3M4 9h16M8 13h3M8 17h6"/><path d="m15.8 14.5 1.4 1.4 2.5-2.8"/></svg>`,dumbbell:`<svg ${c}><path d="M3 9v6M6 6v12M18 6v12M21 9v6M6 12h12"/><path d="M2 9h2v6H2zM20 9h2v6h-2z"/></svg>`,sparkles:`<svg ${c}><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 16 .9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9L19 16ZM5 2l.7 1.8L7.5 4.5l-1.8.7L5 7l-.7-1.8-1.8-.7 1.8-.7L5 2Z"/></svg>`,shield:`<svg ${c}><path d="M12 3 19 6v5c0 4.5-2.7 7.8-7 10-4.3-2.2-7-5.5-7-10V6l7-3Z"/><path d="m8.7 12.1 2.1 2.1 4.6-4.7"/></svg>`,database:`<svg ${c}><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/></svg>`,palette:`<svg ${c}><path d="M12 3a9 9 0 1 0 0 18h1.1a2 2 0 0 0 1.4-3.4 1.8 1.8 0 0 1 1.3-3.1H18a3 3 0 0 0 3-3c0-4.7-4-8.5-9-8.5Z"/><circle cx="7.5" cy="10" r="1"/><circle cx="10" cy="6.8" r="1"/><circle cx="15" cy="7.5" r="1"/></svg>`,search:`<svg ${c}><circle cx="10.8" cy="10.8" r="6.3"/><path d="m16 16 4.5 4.5"/></svg>`,circleHelp:`<svg ${c}><circle cx="12" cy="12" r="9"/><path d="M9.6 9a2.45 2.45 0 1 1 4.2 1.7c-1.1 1-1.8 1.4-1.8 3"/><path d="M12 17.1v.1"/></svg>`,check:`<svg ${c}><path d="m5 12 4.2 4.2L19.5 6"/></svg>`,moon:`<svg ${c}><path d="M20.2 15.3A8.4 8.4 0 0 1 8.7 3.8 8.4 8.4 0 1 0 20.2 15.3Z"/></svg>`,sun:`<svg ${c}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`,plus:`<svg ${c}><path d="M12 5v14M5 12h14"/></svg>`,image:`<svg ${c}><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="m5.5 17 4.2-4 3.2 3 2.2-2.1L20 17"/></svg>`,logout:`<svg ${c}><path d="M10 5H5v14h5"/><path d="m14 8 4 4-4 4"/><path d="M9 12h9"/></svg>`,profile:`<svg ${c}><circle cx="12" cy="8" r="3.2"/><path d="M5 20c.8-3.8 3.1-5.7 7-5.7s6.2 1.9 7 5.7"/></svg>`,appearance:`<svg ${c}><circle cx="12" cy="12" r="3.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`,account:`<svg ${c}><circle cx="12" cy="8" r="3"/><path d="M4.5 20c.7-3.7 3.2-5.5 7.5-5.5s6.8 1.8 7.5 5.5"/></svg>`,left:`<svg ${c}><path d="m15 18-6-6 6-6"/></svg>`,right:`<svg ${c}><path d="m9 18 6-6-6-6"/></svg>`};return p[name]||''}
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function iso(y,m,d){return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`}
function today(){const d=new Date();return iso(d.getFullYear(),d.getMonth(),d.getDate())}
function theme(){return document.documentElement.getAttribute('data-theme')==='dark'?'dark':'light'}
function hex(v){return /^#[0-9a-f]{6}$/i.test(v||'')?String(v).toUpperCase():null}
function rgb(v){const h=hex(v).slice(1);return {r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16)}}
function mix(a,b,t){const A=rgb(a),B=rgb(b),x=Math.max(0,Math.min(1,t));return '#'+[A.r,A.g,A.b].map((v,i)=>Math.round(v+(B[['r','g','b'][i]]-v)*x).toString(16).padStart(2,'0')).join('').toUpperCase()}
function luminance(v){const c=rgb(v);const f=x=>{x/=255;return x<=.03928?x/12.92:Math.pow((x+.055)/1.055,2.4)};const r=f(c.r),g=f(c.g),b=f(c.b);return .2126*r+.7152*g+.0722*b}
function contrastRatio(a,b){const L1=luminance(a),L2=luminance(b),hi=Math.max(L1,L2),lo=Math.min(L1,L2);return (hi+.05)/(lo+.05)}
function contrast(v){return contrastRatio(v,'#FFFFFF')>=contrastRatio(v,'#111214')?'#FFFFFF':'#111214'}
function syncThemePalette(accent){
 const a=hex(accent)||DEFAULT_ACCENTS[theme()],dark=theme()==='dark';
 const defaults=dark?{bg:'#111A15',panel:'#18241D',panel2:'#202F26',panel3:'#2B3B30',text:'#EAF3EC',muted:'#A4B6A7',line:'#2D4134',line2:'#435A49',accent:'#B9E4C7',accentStrong:'#D0F1D9',accentInk:'#10271A',accentSoft:'#233A2D',accentSoft2:'#2B4737',accentLine:'#496B54',glow:'rgba(185,228,199,.14)',glowStrong:'rgba(185,228,199,.20)'}:{bg:'#F3F7F3',panel:'#FFFFFF',panel2:'#EDF3EE',panel3:'#E3ECE5',text:'#192B20',muted:'#65766A',line:'#DCE7DE',line2:'#C7D7CA',accent:'#236B4E',accentStrong:'#1D5C42',accentInk:'#FFFFFF',accentSoft:'#E4F1E7',accentSoft2:'#D9EBDD',accentLine:'#B8D4C0',glow:'rgba(35,107,78,.13)',glowStrong:'rgba(35,107,78,.19)'};
 if(a===DEFAULT_ACCENTS[theme()]){
  Object.entries({ '--bg':defaults.bg,'--panel':defaults.panel,'--panel2':defaults.panel2,'--panel3':defaults.panel3,'--text':defaults.text,'--muted':defaults.muted,'--line':defaults.line,'--line2':defaults.line2,'--accent':defaults.accent,'--accentStrong':defaults.accentStrong,'--accentInk':defaults.accentInk,'--accentSoft':defaults.accentSoft,'--accentSoft2':defaults.accentSoft2,'--accentLine':defaults.accentLine,'--accentGlow':defaults.glow,'--accentGlowStrong':defaults.glowStrong }).forEach(([k,v])=>document.documentElement.style.setProperty(k,v));
  return;
 }
 const base=defaults.bg,panelBase=defaults.panel,panel2Base=defaults.panel2,panel3Base=defaults.panel3,textBase=defaults.text,mutedBase=defaults.muted,lineBase=defaults.line,line2Base=defaults.line2;
 const bgMix=dark?.028:.055,panelMix=dark?.038:.05,panel2Mix=dark?.07:.09,panel3Mix=dark?.09:.12,textMix=dark?.014:.025,mutedMix=dark?.035:.05,lineMix=dark?.10:.18,line2Mix=dark?.13:.22;
 document.documentElement.style.setProperty('--accent',a);
 document.documentElement.style.setProperty('--accentInk',contrast(a));
 document.documentElement.style.setProperty('--accentStrong',dark?mix(a,'#ffffff',.18):mix(a,'#111214',.12));
 document.documentElement.style.setProperty('--bg',mix(base,a,bgMix));
 document.documentElement.style.setProperty('--panel',mix(panelBase,a,panelMix));
 document.documentElement.style.setProperty('--panel2',mix(panel2Base,a,panel2Mix));
 document.documentElement.style.setProperty('--panel3',mix(panel3Base,a,panel3Mix));
 document.documentElement.style.setProperty('--text',mix(textBase,a,textMix));
 document.documentElement.style.setProperty('--muted',mix(mutedBase,a,mutedMix));
 document.documentElement.style.setProperty('--line',mix(lineBase,a,lineMix));
 document.documentElement.style.setProperty('--line2',mix(line2Base,a,line2Mix));
 document.documentElement.style.setProperty('--accentSoft',dark?mix(panelBase,a,.16):mix('#ffffff',a,.09));
 document.documentElement.style.setProperty('--accentSoft2',dark?mix(panel2Base,a,.22):mix('#ffffff',a,.14));
 document.documentElement.style.setProperty('--accentLine',dark?mix(line2Base,a,.46):mix('#b9b8b3',a,.34));
 const ar=rgb(a);document.documentElement.style.setProperty('--accentGlow',`rgba(${ar.r},${ar.g},${ar.b},${dark?.14:.11})`);document.documentElement.style.setProperty('--accentGlowStrong',`rgba(${ar.r},${ar.g},${ar.b},${dark?.20:.17})`);
}
function animateThemeShift(){if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;document.documentElement.classList.remove('theme-transition');void document.documentElement.offsetWidth;document.documentElement.classList.add('theme-transition');clearTimeout(window.__themeShiftTimer);window.__themeShiftTimer=setTimeout(()=>document.documentElement.classList.remove('theme-transition'),430)}
let lastToastMessage='',lastToastAt=0;function toast(msg){const now=Date.now();if(msg===lastToastMessage&&now-lastToastAt<1200)return;lastToastMessage=msg;lastToastAt=now;const n=document.createElement('div');n.className='toast';n.textContent=msg;$('toastWrap').appendChild(n);setTimeout(()=>n.remove(),2600)}
async function persistOnlinePreferences(){if(!online||!currentUser)return;try{await api('/api/settings',{method:'POST',body:JSON.stringify({theme:theme(),accent:hex(document.documentElement.style.getPropertyValue('--accent'))||storageGet(ACCENT_KEY)||DEFAULT_ACCENTS[theme()]})})}catch{}}
function applyTheme(t,resetAccent=true){const next=t==='dark'?'dark':'light';animateThemeShift();document.documentElement.setAttribute('data-theme',next);storageSet(THEME_KEY,next);const nextAccent=resetAccent?DEFAULT_ACCENTS[next]:(hex(storageGet(ACCENT_KEY))||DEFAULT_ACCENTS[next]);storageSet(ACCENT_KEY,nextAccent);syncThemePalette(nextAccent);updateAppearance();renderSettingsThemeState();renderAppearanceColors();if(currentUser&&online)persistOnlinePreferences()}
function applyAccent(c,persist=true){const next=hex(c)||DEFAULT_ACCENTS[theme()];animateThemeShift();if(persist)storageSet(ACCENT_KEY,next);syncThemePalette(next);updateFavicon();renderSettingsThemeState();renderAppearanceColors();if(currentUser&&online&&persist)persistOnlinePreferences()}

function updateFavicon(){
 const href='/favicon.svg?v='+encodeURIComponent(RELEASE_ASSET_TAG);
 let link=document.querySelector('link[rel~="icon"][data-st-favicon="1"]')||document.querySelector('link[rel~="icon"]');
 if(!link){link=document.createElement('link');link.rel='icon';document.head.appendChild(link)}
 link.type='image/svg+xml';link.href=href;link.sizes='any';link.setAttribute('data-st-favicon','1');
}
function updateAppearance(){const dark=theme()==='dark',ic=dark?icon('moon'):icon('sun');['authTheme','topTheme'].forEach(id=>{if($(id))$(id).innerHTML=ic});if($('sideTheme'))$('sideTheme').innerHTML=ic+'<span>Aparência</span>';if($('appearanceDark')){$('appearanceDark').innerHTML=icon('moon');$('appearanceLight').innerHTML=icon('sun');$('appearancePlus').innerHTML=icon('plus');$('appearanceDark').classList.toggle('active',dark);$('appearanceLight').classList.toggle('active',!dark)}document.querySelector('meta[name="theme-color"]').setAttribute('content',document.documentElement.style.getPropertyValue('--bg'));updateFavicon()}
function injectSettingsPolishStyles(){
 if(document.getElementById('st-settings-polish-styles'))return;
 const style=document.createElement('style');style.id='st-settings-polish-styles';style.textContent=`
 .settings-accent-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:14px}
 .settings-accent{aspect-ratio:auto;min-height:61px;border:1px solid var(--line);border-radius:13px;background:var(--panel);color:var(--text);padding:8px 5px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;box-shadow:none;transition:transform .16s,border-color .16s,background .16s,box-shadow .16s}
 .settings-accent:hover{transform:translateY(-1px);border-color:var(--accentLine)}
 .settings-accent.active{border-color:var(--accent);background:var(--accentSoft);box-shadow:inset 0 0 0 1px var(--accent)}
 .settings-accent-dot{width:21px;height:21px;border-radius:50%;display:grid;place-items:center;background:var(--sw);box-shadow:inset 0 0 0 1px rgba(255,255,255,.25);color:#fff;font-size:12px;line-height:1;font-weight:900}
 .settings-accent-name{font-size:10px;font-weight:800;line-height:1.1;text-align:center;white-space:nowrap}
 .settings-accent.default-accent .settings-accent-dot{background:linear-gradient(135deg,#161714 0 50%,#f3f0e9 50%);border:1px solid var(--line2)}
 .settings-accent.custom-accent .settings-accent-dot{font-size:18px;color:var(--accentInk)}
 .color-line{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;align-items:center;width:100%}
 .color-line .swatch{width:22px;height:22px;min-width:0;flex:initial;justify-self:center;border:2px solid var(--panel);box-shadow:0 0 0 1px var(--line2)}
 .color-line .swatch.active{box-shadow:0 0 0 2px var(--panel),0 0 0 4px var(--accent);border-color:var(--panel)}
 .workspace-default-room-picker{display:none;margin-top:11px;padding:12px;border:1px solid var(--accentLine);border-radius:13px;background:var(--panel)}
 .workspace-default-room-picker.show{display:grid;gap:9px;animation:rise .18s ease both}
 .workspace-default-room-picker label{font-size:10px;color:var(--muted);font-weight:800}
 .workspace-default-room-picker select{width:100%;min-height:42px;border:1px solid var(--line2);border-radius:10px;background:var(--panel);color:var(--text);padding:0 10px;font:inherit;font-size:12px}
 .workspace-default-room-save{min-height:40px;border:0;border-radius:10px;padding:0 13px;background:var(--accent);color:var(--accentInk);font-size:11px;font-weight:900;cursor:pointer}
 .workspace-default-room-save:disabled{opacity:.5;cursor:not-allowed}
 @media(min-width:560px){.settings-accent-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.settings-accent{min-height:65px}}
 `;document.head.appendChild(style);
}
function themeColorButton(color,active){return `<button class="swatch ${active?'active':''}" type="button" style="--sw:${color.hex}" data-color="${color.hex}" title="${esc(color.name)}" aria-label="Usar cor ${esc(color.name)}"></button>`}

function renderAppearanceColors(){
 injectSettingsPolishStyles();
 const cur=hex(document.documentElement.style.getPropertyValue('--accent'))||storageGet(ACCENT_KEY)||DEFAULT_ACCENTS[theme()],def=DEFAULT_ACCENTS[theme()];
 if(!$('appearanceColors'))return;
 $('appearanceColors').innerHTML=`<div class="appearance-panel-title">Cor do site</div><div class="appearance-help">Paletas equilibradas para manter o sistema elegante e consistente. Escolha uma cor ou personalize o tom.</div><div class="color-line"><button class="swatch default-swatch ${cur===def?'active':''}" type="button" style="--sw:${def};--default-ink:${contrast(def)}" data-color="${def}" title="Padrão" aria-label="Usar cor padrão">◐</button>${THEME_COLORS.map(c=>themeColorButton(c,cur===c.hex)).join('')}<button class="swatch custom-swatch ${THEME_COLORS.some(c=>c.hex===cur)||cur===def?'':'active'}" id="openCustomColor" type="button" aria-label="Escolher uma cor personalizada" title="Cor personalizada">+</button></div>`;
 $('appearanceColors').querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>applyAccent(b.dataset.color,true));$('openCustomColor').onclick=()=>openColorPicker(cur);
}

function renderSettingsThemeState(){
 injectSettingsPolishStyles();
 const dark=theme()==='dark',cur=hex(document.documentElement.style.getPropertyValue('--accent'))||storageGet(ACCENT_KEY)||DEFAULT_ACCENTS[theme()],def=DEFAULT_ACCENTS[theme()];
 $('settingsDark')?.classList.toggle('active',dark);$('settingsLight')?.classList.toggle('active',!dark);if($('settingsAccentPreview'))$('settingsAccentPreview').style.background=cur;
 if($('settingsAccentGrid')){
  $('settingsAccentGrid').innerHTML=`<button class="settings-accent default-accent ${cur===def?'active':''}" type="button" style="--sw:${def}" data-settings-accent="${def}" title="Padrão" aria-label="Usar cor padrão do site"><span class="settings-accent-dot">◐</span><span class="settings-accent-name">Padrão</span></button>`+THEME_COLORS.map(c=>`<button class="settings-accent ${cur===c.hex?'active':''}" type="button" style="--sw:${c.hex}" data-settings-accent="${c.hex}" title="${esc(c.name)}" aria-label="Usar cor ${esc(c.name)}"><span class="settings-accent-dot">${cur===c.hex?'✓':''}</span><span class="settings-accent-name">${esc(c.name)}</span></button>`).join('')+`<button id="openSettingsColorPicker" class="settings-accent custom-accent ${THEME_COLORS.some(c=>c.hex===cur)||cur===def?'':'active'}" type="button" style="--sw:${cur}" aria-label="Escolher uma cor personalizada" title="Personalizada"><span class="settings-accent-dot">+</span><span class="settings-accent-name">Personalizada</span></button>`;
  $('settingsAccentGrid').querySelectorAll('[data-settings-accent]').forEach(b=>b.onclick=()=>applyAccent(b.dataset.settingsAccent,true));
  $('openSettingsColorPicker')?.addEventListener('click',()=>openColorPicker(cur));
 }
}

let pickerHue=0,pickerSat=0.78,pickerLight=.56,pickerValue='#4C7DFF',pickerReturnFocus=null,pickerPointer=null;
function hslToHex(h,s,l){h=((h%360)+360)%360;s=clamp(s,0,1);l=clamp(l,0,1);const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;let r=0,g=0,b=0;if(h<60){r=c;g=x}else if(h<120){r=x;g=c}else if(h<180){g=c;b=x}else if(h<240){g=x;b=c}else if(h<300){r=x;b=c}else{r=c;b=x}return '#'+[r,g,b].map(v=>Math.round((v+m)*255).toString(16).padStart(2,'0')).join('').toUpperCase()}
function hexToHsl(v){const h=hex(v)||'#4C7DFF',c=rgb(h);let r=c.r/255,g=c.g/255,b=c.b/255,max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,l=(max+min)/2,s=0,hh=0;if(d){s=d/(1-Math.abs(2*l-1));switch(max){case r:hh=60*((g-b)/d%6);break;case g:hh=60*((b-r)/d+2);break;default:hh=60*((r-g)/d+4)}}return{h:(hh+360)%360,s,l}}
function pickerColorFromPosition(x,y){const board=$('pickerBoard');const r=board.getBoundingClientRect();pickerSat=clamp((x-r.left)/r.width,0,1);pickerLight=clamp(1-(y-r.top)/r.height,0,1);pickerValue=hslToHex(pickerHue,pickerSat,pickerLight);renderPicker()}
function pickerHueFromPosition(x){const el=$('pickerHue'),r=el.getBoundingClientRect();pickerHue=clamp((x-r.left)/r.width,0,1)*360;pickerValue=hslToHex(pickerHue,pickerSat,pickerLight);renderPicker()}
function renderPicker(){const color=pickerValue||hslToHex(pickerHue,pickerSat,pickerLight),board=$('pickerBoard'),cursor=$('pickerBoardCursor'),hc=$('pickerHue'),hcursor=$('pickerHueCursor');if(!board)return;board.style.background=`hsl(${pickerHue} 100% 50%)`;cursor.style.left=`${pickerSat*100}%`;cursor.style.top=`${(1-pickerLight)*100}%`;hcursor.style.left=`${(pickerHue/360)*100}%`;document.documentElement.style.setProperty('--picker-color',color);$('themePickerPreview').style.background=color;$('pickerValueChip').textContent=color;$('pickerHex').value=color;$('pickerHex').style.textTransform='uppercase'}
function openColorPicker(initial){const color=hex(initial)||DEFAULT_ACCENTS[theme()],h=hexToHsl(color);pickerHue=h.h;pickerSat=h.s;pickerLight=h.l;pickerValue=color;pickerReturnFocus=document.activeElement;$('themePickerBack').classList.add('show');$('themePickerBack').setAttribute('aria-hidden','false');document.body.classList.add('modal-open');document.querySelectorAll('[data-picker-preset]').forEach(b=>b.classList.toggle('active',b.dataset.pickerPreset===color));renderPicker();requestAnimationFrame(()=>{$('pickerHex')?.focus?.()})}
function closeColorPicker(){const back=$('themePickerBack');back.classList.remove('show');back.setAttribute('aria-hidden','true');if(!$('settingsBack').classList.contains('show')&&!$('cropBack').classList.contains('show'))document.body.classList.remove('modal-open');try{pickerReturnFocus?.focus?.()}catch{}pickerReturnFocus=null}
function commitPicker(){applyAccent(pickerValue,true);closeColorPicker();toast('Cor aplicada em todo o site.')}
function openAppearance(trigger){appearanceTrigger=trigger||appearanceTrigger;$('appearance').classList.add('show');$('appearance').setAttribute('aria-hidden','false');renderAppearanceColors();requestAnimationFrame(positionAppearance)}
function closeAppearance(){$('appearance').classList.remove('show','colors-open');$('appearance').setAttribute('aria-hidden','true');appearanceTrigger=null}
function toggleAppearance(btn){if($('appearance').classList.contains('show'))closeAppearance();else openAppearance(btn)}
function positionAppearance(){if(!appearanceTrigger||!$('appearance').classList.contains('show'))return;const r=appearanceTrigger.getBoundingClientRect(),el=$('appearance'),w=el.offsetWidth,h=el.offsetHeight;let left=r.left-w-8;if(left<8)left=r.right+8;left=Math.max(8,Math.min(Math.max(8,innerWidth-w-8),left));let top=r.top+(r.height-h)/2;top=Math.max(8,Math.min(Math.max(8,innerHeight-h-8),top));el.style.left=`${left}px`;el.style.top=`${top}px`}
const savedTheme=storageGet(THEME_KEY)||'light';applyTheme(savedTheme,false);applyAccent(migrateDefaultAccent(storageGet(ACCENT_KEY),savedTheme==='dark'?'dark':'light'),false);
[$('authTheme'),$('topTheme'),$('sideTheme')].forEach(b=>b&&b.addEventListener('click',e=>{e.stopPropagation();toggleAppearance(b)}));$('appearanceDark').onclick=()=>applyTheme('dark');$('appearanceLight').onclick=()=>applyTheme('light');$('appearancePlus').onclick=()=>{$('appearance').classList.toggle('colors-open');renderAppearanceColors();requestAnimationFrame(positionAppearance)};window.addEventListener('resize',positionAppearance);document.addEventListener('click',e=>{if($('appearance').classList.contains('show')&&!$('appearance').contains(e.target)&&e.target!==appearanceTrigger)closeAppearance();if(workspaceMenuOpen&&!$('workspaceMount')?.contains(e.target)){workspaceEscapeTarget();renderWorkspaceSwitcher()}});$('pickerBoard').addEventListener('pointerdown',e=>{pickerPointer='board';$('pickerBoard').setPointerCapture?.(e.pointerId);pickerColorFromPosition(e.clientX,e.clientY)});$('pickerBoard').addEventListener('pointermove',e=>{if(pickerPointer==='board')pickerColorFromPosition(e.clientX,e.clientY)});$('pickerHue').addEventListener('pointerdown',e=>{pickerPointer='hue';$('pickerHue').setPointerCapture?.(e.pointerId);pickerHueFromPosition(e.clientX)});$('pickerHue').addEventListener('pointermove',e=>{if(pickerPointer==='hue')pickerHueFromPosition(e.clientX)});['pointerup','pointercancel','pointerleave'].forEach(t=>{ $('pickerBoard').addEventListener(t,()=>{pickerPointer=null});$('pickerHue').addEventListener(t,()=>{pickerPointer=null})});$('pickerHex').addEventListener('input',e=>{const v=e.target.value.trim().toUpperCase();if(/^#[0-9A-F]{6}$/.test(v)){const h=hexToHsl(v);pickerHue=h.h;pickerSat=h.s;pickerLight=h.l;pickerValue=v;renderPicker()}});$('pickerHex').addEventListener('blur',()=>{if(!hex($('pickerHex').value))$('pickerHex').value=pickerValue});$('pickerCancel').onclick=closeColorPicker;$('pickerUse').onclick=commitPicker;$('themePickerBack').onclick=e=>{if(e.target===$('themePickerBack'))closeColorPicker();};document.querySelectorAll('[data-picker-preset]').forEach(b=>b.addEventListener('click',()=>{const h=hexToHsl(b.dataset.pickerPreset);pickerHue=h.h;pickerSat=h.s;pickerLight=h.l;pickerValue=b.dataset.pickerPreset;renderPicker();document.querySelectorAll('[data-picker-preset]').forEach(x=>x.classList.toggle('active',x===b))}));
function normalizeLocal(v){const o=v&&typeof v==='object'?v:{};o.users=Array.isArray(o.users)?o.users:[];o.days=o.days&&typeof o.days==='object'?o.days:{};if(!o.users.length)o.users=[{id:'u1',name:'Você',username:'voce',initials:'EU',color:COLORS[0]},{id:'u2',name:'Amigo 1',username:'amigo1',initials:'A1',color:COLORS[1]},{id:'u3',name:'Amigo 2',username:'amigo2',initials:'A2',color:COLORS[2]}];o.users.forEach((u,i)=>{u.color=hex(u.color)||COLORS[i%COLORS.length];u.initials=u.initials||'P';if(!u.avatar&&u.photo)u.avatar=u.photo;delete u.photo;if(!u.avatarSource&&u.avatar)u.avatarSource=u.avatar;o.days[u.id] ||= {}});return o}
function readLocal(){try{const old=storageGet(LOCAL_KEY)||storageGet('shape_together_local_v5');const data=normalizeLocal(old?JSON.parse(old):null);storageSet(LOCAL_KEY,JSON.stringify(data));return data}catch{return normalizeLocal(null)}}
function writeLocal(){state=normalizeLocal(state);storageSet(LOCAL_KEY,JSON.stringify(state))}
const API_TIMEOUT_MS=15000;
async function api(path,opts={}){
 const requestPath=path.startsWith('/api/')?path:path.replace(/^\/shape-together-api(?=\/)/,'/api');
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),API_TIMEOUT_MS);
 try{
  const requestOpts={...opts,credentials:'include',signal:controller.signal,headers:{'Content-Type':'application/json',...(opts.headers||{})}};
  const r=await fetch(requestPath,requestOpts);
  let data={};
  try{data=await r.json()}catch(error){if(controller.signal.aborted||error?.name==='AbortError')throw error}
  if(!r.ok)throw Object.assign(new Error(data.error||'O servidor não conseguiu concluir a solicitação.'),{status:r.status,code:data?.code||'',payload:data});
  return data;
 }catch(e){
  if(e?.name==='AbortError'||controller.signal.aborted)throw Object.assign(new Error('O servidor demorou para responder. Verifique a conexão e tente novamente.'),{code:'TIMEOUT'});
  if(Number.isFinite(Number(e?.status)))throw e;
  throw Object.assign(new Error('Não foi possível conectar ao servidor. Verifique a conexão e tente novamente.'),{code:'NETWORK',cause:e});
 }finally{clearTimeout(timer)}
}
function workspaceGroups(){return Array.isArray(state?.groups)?state.groups:[]}
function activeWorkspaceGroup(){return state?.group||null}
function workspaceLabel(){const g=activeWorkspaceGroup();return workspaceMode==='group'&&g?g.name:'Pessoal'}
function workspaceEscapeTarget(){workspaceMenuOpen=false;const m=$('workspaceMenu');if(m)m.classList.remove('show')}
function renderWorkspaceSwitcher(){
 const mount=$('workspaceMount');if(!mount)return;
 const groups=workspaceGroups(),g=activeWorkspaceGroup();
 mount.innerHTML=`<div class="workspace-switcher"><button id="workspaceTrigger" class="workspace-trigger" type="button" aria-expanded="${workspaceMenuOpen?'true':'false'}"><span class="workspace-trigger-icon">${workspaceMode==='group'?icon('group'):icon('profile')}</span><span class="workspace-trigger-copy"><small>Espaço</small><b>${esc(workspaceLabel())}</b></span><span class="workspace-trigger-chevron">⌄</span></button><div id="workspaceMenu" class="workspace-menu ${workspaceMenuOpen?'show':''}" role="menu"><button type="button" class="workspace-item ${workspaceMode==='personal'?'active':''}" data-workspace="personal"><span class="workspace-item-icon">${icon('profile')}</span><span><b>Pessoal</b><small>Só você</small></span><strong>${workspaceMode==='personal'?'✓':''}</strong></button>${groups.map(x=>`<button type="button" class="workspace-item ${workspaceMode==='group'&&g?.id===x.id?'active':''}" data-workspace-group="${esc(x.id)}"><span class="workspace-item-icon">${icon('group')}</span><span><b>${esc(x.name)}</b><small>${x.visibility==='private'?'Privada':'Pública'} · ${x.role==='owner'?'dona da sala':'participante'}</small></span><strong>${workspaceMode==='group'&&g?.id===x.id?'✓':''}</strong></button>`).join('')}<div class="workspace-menu-sep"></div><button id="workspaceCreate" type="button" class="workspace-menu-action">${icon('plus')}<span>Criar nova sala</span></button><button id="workspaceJoin" type="button" class="workspace-menu-action">${icon('right')}<span>Entrar com código</span></button><button id="workspaceExplore" type="button" class="workspace-menu-action">${icon('group')}<span>Explorar salas públicas</span></button></div></div>`;
 $('workspaceTrigger').onclick=e=>{e.stopPropagation();workspaceMenuOpen=!workspaceMenuOpen;const menu=$('workspaceMenu');menu?.classList.toggle('show',workspaceMenuOpen);$('workspaceTrigger')?.setAttribute('aria-expanded',workspaceMenuOpen?'true':'false')};
 document.querySelectorAll('[data-workspace="personal"]').forEach(b=>b.onclick=()=>switchWorkspace('personal'));
 document.querySelectorAll('[data-workspace-group]').forEach(b=>b.onclick=()=>switchWorkspace('group',b.dataset.workspaceGroup));
 $('workspaceCreate').onclick=()=>{workspaceEscapeTarget();openWorkspaceDialog('create')};
 $('workspaceJoin').onclick=()=>{workspaceEscapeTarget();openWorkspaceDialog('join')};
 $('workspaceExplore').onclick=()=>{workspaceEscapeTarget();openWorkspaceDialog('public')};
}
async function switchWorkspace(mode,groupId=null,quiet=false){
 if(workspaceBusy)return;
 workspaceBusy=true;workspaceEscapeTarget();
 try{
   const r=await api('/api/workspace',{method:'POST',body:JSON.stringify({mode,groupId})});
   state=r.state;currentUser=r.me||currentUser;workspaceMode=state.workspaceMode||mode;calendarMemberId=currentUser.id;compareIds.clear();state.users.filter(u=>u.id!==currentUser.id).forEach(u=>compareIds.add(u.id));
   page=mode==='group'?'group':'home';renderApp();if(!quiet)toast(workspaceMode==='group'?'Sala aberta.':'Espaço pessoal aberto.');
 }catch(e){toast(e.message||'Não foi possível trocar de espaço.')}finally{workspaceBusy=false}
}
async function refreshWorkspaceGroups(){if(!online)return;try{const r=await api('/api/groups');if(state)state.groups=r.groups||[]}catch{}}
function clearInviteFromUrl(){const clean=new URL(location.href);clean.searchParams.delete('invite');clean.searchParams.delete('auth_callback');history.replaceState({},'',clean.pathname+(clean.search?clean.search:'')+(clean.hash?clean.hash:''))}
async function processInvite(code){const invite=String(code||'').trim();if(!invite)return false;if(!online)throw new Error('Entre com Google para aceitar este convite.');const r=await api('/api/group/join',{method:'POST',body:JSON.stringify({code:invite})});state=r.state;currentUser=r.me||currentUser;workspaceMode='group';calendarMemberId=currentUser.id;compareIds.clear();state.users.filter(u=>u.id!==currentUser.id).forEach(u=>compareIds.add(u.id));await refreshWorkspaceGroups();clearInviteFromUrl();toast(`Você entrou na sala “${r.group.name}”.`);return true}
function openWorkspaceDialog(mode='create'){
 workspaceDialogMode=mode;$('workspaceDialogBack').classList.add('show');$('workspaceDialogBack').setAttribute('aria-hidden','false');document.body.classList.add('modal-open');
 $('workspaceCreatePane').classList.toggle('hidden',mode!=='create');$('workspaceJoinPane').classList.toggle('hidden',mode!=='join');$('workspacePublicPane')?.classList.toggle('hidden',mode!=='public');
 $('workspaceDialogTitle').textContent=mode==='create'?'Nova sala':mode==='public'?'Salas públicas':'Entrar em uma sala';
 $('workspaceDialogSub').textContent=mode==='create'?'Crie uma sala separada do seu espaço pessoal.':mode==='public'?'Descubra salas abertas para participação.':'Use o código recebido para entrar em uma sala.';
 $('workspaceDialogSubmit').style.display=mode==='public'?'none':'';$('workspaceDialogSubmit').textContent=mode==='create'?'Criar sala':'Entrar na sala';
 if(mode==='join')requestAnimationFrame(()=>$('workspaceCodeInput')?.focus?.());if(mode==='public')loadPublicGroups();
}
async function loadPublicGroups(){
 const list=$('publicRoomList'),status=$('publicRoomStatus');if(!list)return;list.innerHTML='<div class="room-empty">Carregando salas públicas…</div>';if(status)status.textContent='';
 try{const r=await api('/api/groups/public');const groups=Array.isArray(r.groups)?r.groups:[];
  if(!groups.length){list.innerHTML='<div class="room-empty">Nenhuma sala pública foi encontrada agora.</div>';return}
  list.innerHTML=groups.map(g=>`<article class="public-room-item"><div class="public-room-copy"><b>${esc(g.name)}</b><small>${Number(g.memberCount)||0} participante${Number(g.memberCount)===1?'':'s'}${g.isMember?' · você já participa':''}</small></div><button type="button" class="public-room-join" data-public-room="${esc(g.id)}" ${g.isMember?'disabled':''}>${g.isMember?'Já participa':'Entrar'}</button></article>`).join('');
  list.querySelectorAll('[data-public-room]').forEach(b=>b.onclick=()=>joinPublicGroup(b.dataset.publicRoom,b));
 }catch(e){list.innerHTML='<div class="room-empty">Não foi possível carregar as salas públicas. Tente novamente.</div>';if(status)status.textContent=e.message||''}
}
async function joinPublicGroup(groupId,button){
 if(workspaceBusy||!groupId)return;workspaceBusy=true;if(button)button.disabled=true;
 try{const r=await api('/api/group/join-public',{method:'POST',body:JSON.stringify({groupId})});state=r.state;currentUser=r.me||currentUser;workspaceMode='group';calendarMemberId=currentUser.id;compareIds.clear();state.users.filter(u=>u.id!==currentUser.id).forEach(u=>compareIds.add(u.id));await refreshWorkspaceGroups();closeWorkspaceDialog();renderApp();setPage('group');toast(`Você entrou na sala “${r.group.name}”.`)}catch(e){toast(e.message||'Não foi possível entrar na sala pública.');if(button)button.disabled=false}finally{workspaceBusy=false}
}
function closeWorkspaceDialog(){$('workspaceDialogBack').classList.remove('show');$('workspaceDialogBack').setAttribute('aria-hidden','true');if(!$('settingsBack').classList.contains('show')&&!$('cropBack').classList.contains('show')&&!$('themePickerBack').classList.contains('show'))document.body.classList.remove('modal-open')}
async function submitWorkspaceDialog(){if(workspaceBusy)return;workspaceBusy=true;const btn=$('workspaceDialogSubmit');btn.disabled=true;try{if(workspaceDialogMode==='create'){const name=$('workspaceNameInput').value.trim();if(!name)return toast('Dê um nome para a sala.');const visibility=$('workspaceVisibility').value==='public'?'public':'private';const r=await api('/api/group',{method:'POST',body:JSON.stringify({name,visibility})});state=r.state;currentUser=r.me||currentUser;workspaceMode='group';await refreshWorkspaceGroups();closeWorkspaceDialog();renderApp();setPage('group');toast(`Sala “${r.group.name}” criada.`);$('workspaceNameInput').value=''}else if(workspaceDialogMode==='join'){const code=$('workspaceCodeInput').value.trim();if(!code)return toast('Digite o código do convite.');await processInvite(code);closeWorkspaceDialog();renderApp();setPage('group');$('workspaceCodeInput').value=''}}catch(e){toast(e.message||'Não foi possível concluir essa ação.')}finally{workspaceBusy=false;btn.disabled=false}}
async function setDefaultWorkspace(mode,chosenGroupId=null){
 if(!currentUser)return;
 let groupId=null;
 if(mode==='group'){
  groupId=String(chosenGroupId||defaultWorkspaceDraftGroupId||currentUser.activeGroupId||activeWorkspaceGroup()?.id||workspaceGroups()[0]?.id||'');
  if(!groupId){defaultWorkspaceDraftMode='group';renderWorkspaceDefaultState();toast('Entre ou crie uma sala antes de definir o espaço inicial.');return}
 }
 try{
  const r=await api('/api/settings/workspace-default',{method:'POST',body:JSON.stringify({defaultWorkspace:mode,groupId})});
  currentUser=r.user||currentUser;
  if(mode==='group'){
   defaultWorkspaceDraftGroupId=groupId;
   await switchWorkspace('group',groupId,true);
  }else{defaultWorkspaceDraftGroupId=null;renderApp()}
  defaultWorkspaceDraftMode=null;renderWorkspaceDefaultState();renderWorkspaceSwitcher();
  toast(mode==='group'?'Sala inicial salva. Você continuará nessa sala ao entrar.':'Espaço pessoal definido como inicial.');
 }catch(e){toast(e.message||'Não foi possível salvar essa preferência.')}
}
function ensureDefaultRoomPicker(){
 let holder=$('workspaceDefaultRoomPicker');
 if(holder)return holder;
 const choice=$('workspaceDefaultGroup')?.closest('.workspace-default-choice');
 if(!choice)return null;
 holder=document.createElement('div');holder.id='workspaceDefaultRoomPicker';holder.className='workspace-default-room-picker';
 holder.innerHTML='<label for="workspaceDefaultRoomSelect">Qual sala deve abrir ao entrar?</label><select id="workspaceDefaultRoomSelect" aria-label="Selecionar sala inicial"></select><button id="workspaceDefaultRoomSave" class="workspace-default-room-save" type="button">Usar esta sala ao entrar</button>';
 choice.insertAdjacentElement('afterend',holder);
 $('workspaceDefaultRoomSelect').addEventListener('change',e=>{defaultWorkspaceDraftGroupId=e.target.value});
 $('workspaceDefaultRoomSave').addEventListener('click',()=>setDefaultWorkspace('group',$('workspaceDefaultRoomSelect')?.value||''));
 return holder;
}
function renderWorkspaceDefaultState(){
 const savedMode=currentUser?.defaultWorkspace==='group'?'group':'personal',mode=defaultWorkspaceDraftMode||savedMode;
 $('workspaceDefaultPersonal')?.classList.toggle('active',mode==='personal');$('workspaceDefaultGroup')?.classList.toggle('active',mode==='group');
 const groups=workspaceGroups().slice();const active=activeWorkspaceGroup();if(active&&!groups.some(g=>g.id===active.id))groups.unshift(active);
 const hasGroup=groups.length>0;if($('workspaceDefaultGroup'))$('workspaceDefaultGroup').disabled=!hasGroup;
 const holder=ensureDefaultRoomPicker();
 if(holder){holder.classList.toggle('show',mode==='group'&&hasGroup);const select=$('workspaceDefaultRoomSelect');const prior=defaultWorkspaceDraftGroupId||currentUser?.activeGroupId||active?.id||groups[0]?.id||'';select.innerHTML=groups.map(g=>`<option value="${esc(g.id)}">${esc(g.name)}${g.role==='owner'?' · Administradora':''}</option>`).join('');if(prior&&groups.some(g=>g.id===prior))select.value=prior;defaultWorkspaceDraftGroupId=select.value||null;$('workspaceDefaultRoomSave').disabled=!hasGroup;}
 if($('workspaceDefaultNote'))$('workspaceDefaultNote').textContent=hasGroup?(mode==='group'?'Selecione uma das suas salas e confirme para defini-la como espaço inicial.':'Essa preferência fica salva na sua conta. Você pode participar de várias salas.'):'Entre ou crie uma sala para poder escolhê-la como espaço inicial.';
}

function current(){return state?.users?.find(u=>u.id===currentUser?.id)||currentUser}
function memberColor(u,i){return hex(u?.color)||COLORS[i%COLORS.length]}
function dateOnly(d){return new Date(d.getFullYear(),d.getMonth(),d.getDate())}
function daysBetween(a,b){return Math.floor((dateOnly(b)-dateOnly(a))/86400000)}
function challenge(){const group=workspaceMode==='group'?state?.group:null;const start=group?.challengeStart||START,end=group?.challengeEnd||END;const parts=v=>String(v).split('-').map(Number);const [sy,sm,sd]=parts(start),[ey,em,ed]=parts(end);const s=new Date(sy,sm-1,sd),t=dateOnly(new Date()),e=new Date(ey,em-1,ed);const total=Math.max(1,daysBetween(s,e)+1);const elapsed=Math.max(0,Math.min(total,daysBetween(s,t)+1));return{start:s,end:e,total,elapsed,percent:Math.round(elapsed/total*100),startKey:start,endKey:end}}
function challengeDates(){const c=challenge(),arr=[];for(let i=0;i<c.elapsed;i++){const d=new Date(c.start);d.setDate(d.getDate()+i);arr.push(iso(d.getFullYear(),d.getMonth(),d.getDate()))}return arr}
function activeChallengeBounds(){const c=challenge();return{start:c.startKey,end:c.endKey}}
function weekDates(){return challengeDates().slice(-7)}
function canEdit(date,memberId){const b=activeChallengeBounds();return memberId===currentUser?.id&&date>=b.start&&date<=b.end&&date<=today()}
function progress(id){const days=state.days[id]||{},vals=challengeDates().map(d=>days[d]?.status).filter(Boolean).map(s=>STATUS[s].value);if(!vals.length)return{score:0,avg:0,registered:0};const avg=vals.reduce((a,b)=>a+b,0)/vals.length;return{score:Math.round(avg*10),avg,registered:vals.length}}
function monthStats(id){const ds=Object.values(state.days[id]||{});return{green:ds.filter(x=>x.status==='green').length,orange:ds.filter(x=>x.status==='orange').length,blue:ds.filter(x=>x.status==='blue').length,red:ds.filter(x=>x.status==='red').length}}
function getPhoto(u){const v=u?.avatar;return typeof v==='string'&&v.trim()?v.trim():''}
function avatarHTML(u,i){const photo=getPhoto(u);return `<div class="avatar${photo?' has-photo':''}" style="background:${memberColor(u,i)};overflow:hidden">${photo?`<img src="${esc(photo)}" alt="" loading="eager">`:esc(u?.initials||'P')}</div>`}
let cropSource='',cropImage=null,cropZoom=1,cropPanX=0,cropPanY=0,cropMin=1,cropMax=4,cropPointerId=null,cropStartX=0,cropStartY=0,cropStartPanX=0,cropStartPanY=0,settingsReturnFocus=null,settingsDragStartY=0,settingsDragStartX=0,settingsDragging=false;
function clamp(n,min,max){return Math.max(min,Math.min(max,n))}
function cropMetrics(){const stage=$('cropStage');if(!stage||!cropImage)return null;const size=stage.clientWidth;const base=Math.max(size/cropImage.naturalWidth,size/cropImage.naturalHeight);const scale=base*cropZoom;const iw=cropImage.naturalWidth*scale,ih=cropImage.naturalHeight*scale;const maxX=Math.max(0,(iw-size)/2),maxY=Math.max(0,(ih-size)/2);return {size,base,scale,maxX,maxY,iw,ih}}
function cropSavedInitial(me){const c=me?.avatarCrop;if(!c)return{zoom:1,x:0,y:0};return{zoom:Number(c.zoom)||1,x:Number(c.x)||0,y:Number(c.y)||0}}
function renderCrop(){const m=cropMetrics();if(!m)return;cropPanX=clamp(cropPanX,-m.maxX,m.maxX);cropPanY=clamp(cropPanY,-m.maxY,m.maxY);cropImage.style.width=`${cropImage.naturalWidth*m.scale}px`;cropImage.style.height=`${cropImage.naturalHeight*m.scale}px`;cropImage.style.transform=`translate(-50%,-50%) translate(${cropPanX}px,${cropPanY}px)`;$('cropZoom').value=cropZoom;$('cropZoomValue').textContent=`${Math.round(cropZoom*100)}%`}
function openCropper(dataUrl){if(!dataUrl)return;const me=current();cropSource=dataUrl;$('cropBack').classList.add('show');$('cropBack').setAttribute('aria-hidden','false');document.body.classList.add('modal-open');const img=new Image();img.onload=()=>{cropImage=img;$('cropImg').replaceWith(img);img.id='cropImg';img.alt='Pré-visualização da foto';const saved=cropSavedInitial(me);cropZoom=clamp(saved.zoom,cropMin,cropMax);const m=cropMetrics();cropPanX=m?clamp(saved.x*m.maxX,-m.maxX,m.maxX):0;cropPanY=m?clamp(saved.y*m.maxY,-m.maxY,m.maxY):0;renderCrop();requestAnimationFrame(renderCrop)};img.onerror=()=>{closeCropper();toast('Não foi possível abrir essa imagem.')};img.src=dataUrl}
function closeCropper(){const modal=$('cropBack');modal.classList.remove('show');modal.setAttribute('aria-hidden','true');cropSource='';cropImage=null;document.body.classList.remove('modal-open')}
function cropReset(){cropZoom=1;cropPanX=0;cropPanY=0;renderCrop()}
function applyCrop(){const m=cropMetrics();if(!m||!cropImage)return;const out=512,srcSize=m.size/m.scale;let sx=clamp(-((m.size-m.iw)/2+cropPanX)/m.scale,0,cropImage.naturalWidth-srcSize);let sy=clamp(-((m.size-m.ih)/2+cropPanY)/m.scale,0,cropImage.naturalHeight-srcSize);const maxSrc=Math.min(cropImage.naturalWidth,cropImage.naturalHeight);const sourceSize=Math.min(srcSize,maxSrc);if(srcSize>maxSrc){sx=Math.max(0,(cropImage.naturalWidth-maxSrc)/2);sy=Math.max(0,(cropImage.naturalHeight-maxSrc)/2)}const canvas=document.createElement('canvas');canvas.width=out;canvas.height=out;const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)return toast('Seu navegador não conseguiu processar a foto.');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(cropImage,sx,sy,sourceSize,sourceSize,0,0,out,out);const result=canvas.toDataURL('image/jpeg',.9);const me=current();me.avatar=result;me.avatarSource=cropSource;me.avatarCrop={zoom:cropZoom,x:m.maxX?cropPanX/m.maxX:0,y:m.maxY?cropPanY/m.maxY:0};const u=state?.users?.find(x=>x.id===me.id);if(u){u.avatar=me.avatar;u.avatarSource=me.avatarSource;u.avatarCrop=me.avatarCrop}currentUser=me;closeCropper();renderApp();openSettings('profile');updatePhotoUI();$('profileNote').textContent='Enquadramento aplicado. Toque em Salvar perfil para confirmar.';toast('Foto ajustada.')}
function updatePhotoUI(){const me=current();if(!me)return;const p=getPhoto(me);$('photoStatus').textContent=p?'Foto personalizada ativa':'Nenhuma foto escolhida';$('editPhoto').classList.toggle('hidden',!p);renderSettingsAvatar($('settingsAvatarLarge'),me);renderSettingsAvatar($('settingsAvatar'),me);renderSettingsAvatar($('settingsAccountAvatar'),me);renderTopAccount()}
function mobileGroupForPage(key){return key==='planner'||key==='life'?'organize':key==='calendar'||key==='progress'?'training':key==='group'||key==='notes'?'spaces':'home'}
function openWorkspaceMenuFromMobile(){workspaceMenuOpen=true;renderWorkspaceSwitcher();requestAnimationFrame(()=>{const menu=$('workspaceMenu');menu?.classList.add('show');$('workspaceTrigger')?.setAttribute('aria-expanded','true')})}
function updateMobileNavigation(){
 const mobile=$('mobileNav'),subnav=$('mobileSubnav');if(!mobile||!subnav)return;
 mobile.querySelectorAll('[data-mobile-group]').forEach(btn=>{const active=btn.dataset.mobileGroup===mobileNavGroup;btn.classList.toggle('active',active);if(active)btn.setAttribute('aria-current','page');else btn.removeAttribute('aria-current')});
 const group=MOBILE_NAV_GROUPS.find(item=>item[0]===mobileNavGroup)||MOBILE_NAV_GROUPS[0];
 if(group[0]==='home'){subnav.innerHTML='';subnav.classList.add('hidden');return}
 const labels={planner:'Planejar',life:'Metas',calendar:'Treinos',progress:'Progresso',group:workspaceMode==='group'&&state?.group?'Sala':'Salas',notes:'Diário'};
 subnav.innerHTML=group[3].map(key=>`<button type="button" data-subpage="${key}" data-page="${key}" class="${page===key?'active':''}" ${page===key?'aria-current="page"':''}>${icon(({planner:'planner',life:'life',calendar:'calendar',progress:'chart',group:'group',notes:'notes'})[key]||'sparkles')}<span>${labels[key]||esc(PAGES[key]?.[0]||key)}</span></button>`).join('');
 subnav.classList.remove('hidden');
 subnav.querySelectorAll('[data-subpage]').forEach(btn=>btn.addEventListener('click',()=>{const key=btn.dataset.subpage;if(key==='group'&&!(workspaceMode==='group'&&state?.group)){mobileNavGroup='spaces';updateMobileNavigation();openWorkspaceMenuFromMobile();return}setPage(key)}));
}
function selectMobileNavGroup(key){
 mobileNavGroup=key;
 if(key==='home'){setPage('home');return}
 if(key==='organize'){setPage(['planner','life'].includes(page)?page:'planner');return}
 if(key==='training'){setPage(['calendar','progress'].includes(page)?page:'calendar');return}
 if(key==='spaces'){
  if(workspaceMode==='group'&&state?.group){setPage(['group','notes'].includes(page)?page:'group');return}
  if(page!=='notes')setPage('notes');else updateMobileNavigation();
  openWorkspaceMenuFromMobile();
 }
}
function navHtml(){
 const side=$('sideNav'),mobile=$('mobileNav'),showGroup=workspaceMode==='group'&&Boolean(state?.group);
 side.innerHTML='';mobile.innerHTML='';
 const items=showGroup?NAV:NAV.filter(([key])=>key!=='group');
 items.forEach(([key,label,ic])=>{const button=document.createElement('button');button.type='button';button.dataset.page=key;button.innerHTML=icon(ic)+`<span>${label}</span>`;button.onclick=()=>setPage(key);side.appendChild(button)});
 MOBILE_NAV_GROUPS.forEach(([key,label,ic])=>{const button=document.createElement('button');button.type='button';button.dataset.mobileGroup=key;button.className='mobile-primary-tab';button.innerHTML=icon(ic)+`<span>${label}</span>`;button.onclick=()=>selectMobileNavGroup(key);mobile.appendChild(button)});
 mobile.style.gridTemplateColumns=`repeat(${MOBILE_NAV_GROUPS.length},minmax(0,1fr))`;
 const me=current();const idx=state.users.findIndex(x=>x.id===me.id);const c=memberColor(me,idx);
 $('sideUser').innerHTML=`${avatarHTML(me,idx)}<div><b>${esc(me.name)}</b><small>@${esc(me.username)}</small></div>`;
 $('topAccount').className=`top-account ${getPhoto(me)?'has-photo':''}`;$('topAccount').style.background=getPhoto(me)?'var(--panel2)':c;$('topAccount').innerHTML=getPhoto(me)?`<img src="${esc(getPhoto(me))}" alt="" loading="eager">`:esc(me.initials);
 $('sideLogout').innerHTML=icon('logout')+'<span>Sair</span>';updateAppearance();renderTopAccount();renderWorkspaceSwitcher();updateMobileNavigation();
}


const HELP_PAGE_CONTENT={
 home:{title:'Início',intro:'Seu painel conecta planejamento, metas, hábitos, treinos e espaços compartilhados.',drawers:[['Comece por aqui','Confira o registro de hoje e use os atalhos para abrir o calendário, a progressão ou as anotações. Os indicadores resumem o período; abra o calendário para ver cada dia.', 'orange'],['Espaço pessoal e sala','No espaço pessoal, você vê seus próprios registros. Em uma sala, os indicadores e os participantes pertencem àquela sala; trocar de espaço não mistura os dados.', 'blue']]},
 planner:{title:'Planejador',intro:'Organize tarefas por dia, semana, mês e ano sem misturar seu planejamento com os registros de treino.',drawers:[['Criar uma tarefa','Informe um título, uma data opcional, prioridade e categoria. Tarefas sem data ficam em uma seção separada.', 'orange'],['Dia, semana, mês e ano','Use os controles para alternar a escala. Na visão anual, escolha um mês para ver o calendário detalhado; o botão Hoje retorna ao período atual.', 'blue'],['Tarefas em salas','No espaço pessoal, as tarefas são privadas. Em uma sala, tarefas novas ficam visíveis aos participantes; apenas quem criou ou administradores da sala podem alterá-las.', 'purple'],['Primeira versão','Recorrência automática, metas, marcos e atribuição de tarefas a pessoas serão adicionados em fases futuras, após testes de compatibilidade.', 'green']]},
 life:{title:'Metas, projetos e hábitos',intro:'Use esta área para acompanhar sua organização pessoal. Os dados ficam vinculados à sua conta e separados das salas de treino.',drawers:[['Metas','Crie um objetivo, defina um prazo opcional e atualize o progresso conforme avança. Marque como concluído quando alcançar o que queria.','green'],['Projetos','Registre iniciativas com descrição, prioridade, prazo e percentual de progresso. Use “Em pausa” se precisar retomar depois.','blue'],['Hábitos','Cadastre um hábito e marque os dias em que praticou. A sequência de sete dias mostra seus registros recentes; você pode desfazer a marcação de hoje.','orange'],['Privacidade e persistência','Metas, projetos e hábitos são pessoais e ficam salvos na sua conta. A migração supabase/personal-organization.sql precisa ser executada uma vez no Supabase antes de usar este módulo.','purple']]},
 calendar:{title:'Calendário',intro:'Use o calendário para registrar como foi cada dia.',drawers:[['Registrar um dia','Toque em uma data disponível e escolha o estado. Você pode adicionar uma anotação e salvar. Datas anteriores ao início do desafio e datas futuras ficam bloqueadas.', 'orange'],['O que as cores significam','Vermelho: não treinou (0). Azul: descanso (3). Laranja: treino mediano (6). Verde: treinou bem (10). Dia vazio significa “sem registro”, não “não treinou”.','green'],['Editar ou apagar','Abra um dia já registrado para ajustar o estado ou a anotação. Use “Apagar” somente quando quiser remover aquele registro.','purple']]},
 progress:{title:'Progressão e radar',intro:'O histórico mostra os valores registrados; o radar resume a distribuição do desafio.',drawers:[['Histórico diário: 0, 3, 6 e 10','Os pontos representam o valor exato de cada dia, sem converter os valores em média. Deslize horizontalmente para ver o histórico completo; a legenda colorida identifica cada estado.', 'blue'],['Radar: escala de 0 a 100','Cada eixo usa a escala percentual comum. Consistência é a proporção de dias com registro; as quatro categorias são a proporção dos dias decorridos em cada estado; pontuação média usa os registros existentes. Dias vazios não entram em “Não treinou”.','orange'],['Os seis eixos, em detalhes','Consistência: dias com registro ÷ dias decorridos. Treinos bons, treino mediano, descanso e não treinou: proporção dos dias explicitamente marcados em cada categoria. Pontuação média: média dos valores registrados, convertida de 0–10 para 0–100. Um dia em branco não é classificado como “não treinou”.','purple'],['Comparar participantes','Marque ou desmarque nomes acima do radar. Cada pessoa recebe uma cor de linha e aparece na legenda com a foto salva no perfil, número de registros e média. Se não houver foto cadastrada, aparecem as iniciais.','green']]},
 notes:{title:'Anotações',intro:'Aqui ficam as observações adicionadas aos dias registrados.',drawers:[['No espaço pessoal','Você vê suas próprias anotações, ordenadas da mais recente para a mais antiga. Use-as para lembrar como foi o treino, descanso ou rotina.','purple'],['Dentro de uma sala','As anotações que você registra na sala podem ser vistas pelos participantes daquela sala. Evite colocar informações pessoais ou sensíveis.','blue'],['Não aparece nenhuma anotação?','Somente dias com texto de anotação entram nesta lista. Um registro de treino sem comentário continua no calendário, mas não aparece aqui.','orange']]},
 group:{title:'Sala e participantes',intro:'Uma sala organiza o acompanhamento coletivo sem misturar o espaço pessoal.',drawers:[['Convidar pessoas','Compartilhe o código ou o link de convite com quem deve participar. A pessoa precisa entrar na sala para aparecer na comparação.','orange'],['Indicadores e comparações','Os resumos usam os participantes e os registros disponíveis nessa sala. Uma pessoa sem registros pode aparecer com zero; isso não significa que a conta esteja com erro.','blue'],['Privacidade do espaço','Use o espaço pessoal para seus registros individuais. Em salas, nomes, registros e anotações associadas à sala podem ficar visíveis para os participantes.','purple']]}
};
function helpMarkup(title,body,tone,index){const marks=['circleHelp','right','sparkles','check'];return `<details class="st-help-drawer tone-${tone}" ${index===0?'open':''}><summary><span class="st-help-drawer-mark" aria-hidden="true">${icon(marks[index%marks.length])}</span><span>${esc(title)}</span><span class="st-help-chevron" aria-hidden="true">${icon('right')}</span></summary><div class="st-help-drawer-body">${esc(body)}</div></details>`}
function openHelpModal(pageKey){
 let modal=$('stHelpModal');if(!modal){modal=document.createElement('div');modal.id='stHelpModal';modal.className='st-help-backdrop';modal.innerHTML='<section class="st-help-dialog" role="dialog" aria-modal="true" aria-labelledby="stHelpTitle"><header class="st-help-head"><div><span class="st-help-kicker">CENTRAL DE AJUDA</span><h2 id="stHelpTitle">Como usar o Shape Together</h2><p id="stHelpIntro"></p></div><button type="button" class="st-help-close" aria-label="Fechar ajuda">×</button></header><label class="st-help-search-wrap"><span aria-hidden="true"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.8" cy="10.8" r="6.3"/><path d="m16 16 4.5 4.5"/></svg></span><input id="stHelpSearch" type="search" placeholder="Buscar uma dúvida…" autocomplete="off"></label><div id="stHelpDrawers" class="st-help-drawers"></div><footer class="st-help-footer"><span>Não encontrou? Limpe a busca para ver todos os tópicos.</span><button type="button" class="st-help-done">Entendi</button></footer></section>';document.body.appendChild(modal);modal.addEventListener('click',e=>{if(e.target===modal||e.target.closest('.st-help-close')||e.target.closest('.st-help-done'))closeHelpModal()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('stHelpModal')?.classList.contains('open'))closeHelpModal()});$('stHelpSearch').addEventListener('input',filterHelpDrawers)}
 const pageHelp=HELP_PAGE_CONTENT[pageKey]||HELP_PAGE_CONTENT.home;
 const common=[['Escala de cores do dia','Vermelho = não treinou (0); azul = descanso (3); laranja = treino mediano (6); verde = treinou bem (10). Um dia vazio significa que ainda não existe registro.','green'],['Foto do perfil','A legenda usa a imagem salva em Configurações → Perfil. Para mostrar sua foto real, escolha e salve uma imagem no perfil. Se nenhuma foto estiver cadastrada, o app mostra suas iniciais.','blue'],['Atualizações do aplicativo','A versão identifica as melhorias disponíveis. Se uma mudança não aparecer após publicar os arquivos, atualize a página sem usar o cache e confirme se index.html, app.js e os arquivos CSS foram publicados juntos.','purple']];
 $('stHelpTitle').textContent=`Ajuda · ${pageHelp.title}`;$('stHelpIntro').textContent=pageHelp.intro;
 $('stHelpDrawers').innerHTML=[...pageHelp.drawers,...common].map((item,i)=>helpMarkup(item[0],item[1],item[2],i)).join('');$('stHelpSearch').value='';filterHelpDrawers();modal.classList.add('open');document.body.classList.add('st-help-open');setTimeout(()=>$('stHelpSearch')?.focus({preventScroll:true}),20)
}
function filterHelpDrawers(){const q=($('stHelpSearch')?.value||'').trim().toLocaleLowerCase('pt-BR');document.querySelectorAll('#stHelpDrawers .st-help-drawer').forEach(d=>{const match=!q||d.textContent.toLocaleLowerCase('pt-BR').includes(q);d.hidden=!match;if(q&&match)d.open=true})}
function closeHelpModal(){const m=$('stHelpModal');if(m)m.classList.remove('open');document.body.classList.remove('st-help-open')}
function attachPageHelp(pageKey){const topbar=$('topHeading')||$('topTitle')?.parentElement;if(!topbar)return;let button=$('stPageHelpTrigger');if(!button){button=document.createElement('button');button.id='stPageHelpTrigger';button.className='st-help-trigger st-help-top-trigger';button.type='button';button.innerHTML='<span class="st-help-mark" aria-hidden="true">'+icon('circleHelp')+'</span>';topbar.appendChild(button)}button.setAttribute('aria-label',`Ajuda da aba ${PAGES[pageKey]?.[0]||pageKey}`);button.title=`Ajuda · ${PAGES[pageKey]?.[0]||pageKey}`;button.onclick=()=>openHelpModal(pageKey)}
function setPage(p){if(p==='group'&&!(workspaceMode==='group'&&state?.group))p='home';if(!PAGES[p])p='home';page=p;mobileNavGroup=mobileGroupForPage(p);document.querySelectorAll('.page').forEach(el=>el.classList.toggle('active',el.id==='page-'+p));document.querySelectorAll('[data-page]').forEach(el=>{const active=el.dataset.page===p;el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current')});$('topTitle').textContent=PAGES[p][0];$('topSub').textContent=workspaceMode==='group'&&state?.group?`Sala · ${state.group.name}`:PAGES[p][1];const activePage=$('page-'+p);activePage?.querySelectorAll('.card').forEach((el,i)=>el.style.setProperty('--card-i',i));attachPageHelp(p);updateMobileNavigation();window.dispatchEvent(new CustomEvent('st:pagechange',{detail:{page:p,workspaceMode,groupId:workspaceMode==='group'?state?.group?.id||null:null}}));window.scrollTo({top:0,behavior:'smooth'})}

function renderApp(){workspaceMode=state?.workspaceMode||(state?.group?'group':'personal');renderHome();renderCalendar();renderProgress();renderNotes();if(workspaceMode==='group'&&state?.group)renderGroup();else $('page-group').innerHTML='';navHtml();setPage(page)}

function renderHome(){
 const me=current(),p=progress(me.id),c=challenge(),rec=state.days[me.id]?.[today()],status=rec?STATUS[rec.status]:null,isGroup=workspaceMode==='group'&&state.group,users=state.users||[];
 const firstName=(me.name||'').trim().split(/\s+/)[0]||'por aí';
 const dateLabel=new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'numeric',month:'long'}).format(new Date());
 const best=isGroup?[...users].sort((a,b)=>progress(b.id).score-progress(a.id).score)[0]:me;
 $('page-home').innerHTML=`
 <div class="st-home-shell">
   <header class="st-home-topline"><div><span class="st-home-kicker">${isGroup?'ESPAÇO COMPARTILHADO':'SEU ESPAÇO PESSOAL'}</span><span class="st-home-date">${esc(dateLabel)}</span></div><span class="st-home-live"><i></i> Um passo de cada vez</span></header>
   <section class="st-home-hero">
     <div class="st-home-hero-copy"><div class="st-home-eyebrow"><span class="st-home-spark">✳</span> SUA CENTRAL DO DIA</div>
       <h1>Olá, ${esc(firstName)}.<br><em>Vamos fazer o dia valer.</em></h1>
       <p>Organize o que importa, avance nas suas metas e cuide de você — tudo no mesmo lugar.</p>
       <div class="st-home-hero-actions"><button id="homeQuickTask" class="st-home-primary" type="button">${icon('plus')} Planejar meu dia <span aria-hidden="true">↗</span></button><button id="homeQuickWorkout" class="st-home-secondary" type="button">${icon('calendar')} Registrar treino</button></div>
       <div class="st-home-hero-foot"><span class="st-home-avatar">${esc(me.initials||'EU')}</span><span><b>${esc(me.name||'Seu perfil')}</b><small>${isGroup?`Você está em ${esc(state.group.name)}.`:'Seu planejamento pessoal é privado.'}</small></span><span class="st-home-foot-spacer"></span><button id="homeWorkspace" type="button" class="st-home-text-button">${isGroup?'Trocar espaço':'Ver espaços'} <span>→</span></button></div>
     </div>
     <div class="st-home-hero-art" aria-hidden="true"><div class="st-home-orbit st-orbit-one"></div><div class="st-home-orbit st-orbit-two"></div><div class="st-home-orbit st-orbit-three"></div><div class="st-home-art-center"><span>ST</span><small>FOCO</small></div><div class="st-home-float st-float-one"><span>✓</span><div><b>Pequenos passos</b><small>grandes mudanças</small></div></div><div class="st-home-float st-float-two"><span>✳</span><div><b>Seu ritmo</b><small>sem comparação</small></div></div></div>
   </section>
   <section class="st-home-metrics" aria-label="Resumo pessoal">
     <article class="st-home-metric"><span class="st-home-metric-icon st-metric-tasks">${icon('planner')}</span><div><span class="st-home-metric-label">Tarefas em aberto</span><strong id="homeMetricTasks">—</strong><small id="homeMetricTasksSub">No seu planejamento</small></div><button type="button" data-home-page="planner" aria-label="Abrir tarefas">↗</button></article>
     <article class="st-home-metric"><span class="st-home-metric-icon st-metric-goals">${icon('life')}</span><div><span class="st-home-metric-label">Metas ativas</span><strong id="homeMetricGoals">—</strong><small id="homeMetricGoalsSub">O que você quer conquistar</small></div><button type="button" data-home-page="life" aria-label="Abrir metas">↗</button></article>
     <article class="st-home-metric"><span class="st-home-metric-icon st-metric-habits">${icon('chart')}</span><div><span class="st-home-metric-label">Hábitos hoje</span><strong id="homeMetricHabits">—</strong><small id="homeMetricHabitsSub">Constância, não perfeição</small></div><button type="button" data-home-page="life" aria-label="Abrir hábitos">↗</button></article>
     <article class="st-home-metric"><span class="st-home-metric-icon st-metric-training">${icon('calendar')}</span><div><span class="st-home-metric-label">Evolução nos treinos</span><strong>${p.score}<small class="st-home-out-of">/100</small></strong><small>${p.registered} dias registrados no desafio</small></div><button type="button" data-home-page="progress" aria-label="Ver progresso">↗</button></article>
   </section>
   <div class="st-home-section-heading"><div><span class="st-home-kicker">TUDO CONECTADO</span><h2>Seu espaço de possibilidades</h2><p>Entre direto na área que combina com o seu próximo passo.</p></div><span class="st-home-section-count">06 ÁREAS</span></div>
   <section class="st-home-feature-grid" aria-label="Áreas do Shape Together">
     <button type="button" class="st-home-feature st-feature-planner" data-home-page="planner"><span class="st-home-feature-top"><span class="st-home-feature-icon">${icon('planner')}</span><span class="st-home-feature-arrow">↗</span></span><span class="st-home-feature-title">Planejador</span><span class="st-home-feature-desc">Tarefas, prioridades e uma semana mais leve.</span><span class="st-home-feature-link">Organizar meu tempo <b>→</b></span></button>
     <button type="button" class="st-home-feature st-feature-life" data-home-page="life"><span class="st-home-feature-top"><span class="st-home-feature-icon">${icon('life')}</span><span class="st-home-feature-arrow">↗</span></span><span class="st-home-feature-title">Metas, projetos e hábitos</span><span class="st-home-feature-desc">Tire ideias da cabeça e transforme em progresso.</span><span class="st-home-feature-link">Construir meu caminho <b>→</b></span></button>
     <button type="button" class="st-home-feature st-feature-training" data-home-page="calendar"><span class="st-home-feature-top"><span class="st-home-feature-icon">${icon('calendar')}</span><span class="st-home-feature-arrow">↗</span></span><span class="st-home-feature-title">Treinos e rotina</span><span class="st-home-feature-desc">Registre seus dias, treino e descanso.</span><span class="st-home-feature-link">Cuidar de mim <b>→</b></span></button>
     <button type="button" class="st-home-feature st-feature-progress" data-home-page="progress"><span class="st-home-feature-top"><span class="st-home-feature-icon">${icon('chart')}</span><span class="st-home-feature-arrow">↗</span></span><span class="st-home-feature-title">Progresso</span><span class="st-home-feature-desc">Entenda sua consistência e veja a evolução.</span><span class="st-home-feature-link">Ver minha evolução <b>→</b></span></button>
     <button type="button" class="st-home-feature st-feature-notes" data-home-page="notes"><span class="st-home-feature-top"><span class="st-home-feature-icon">${icon('notes')}</span><span class="st-home-feature-arrow">↗</span></span><span class="st-home-feature-title">Diário e anotações</span><span class="st-home-feature-desc">Guarde aprendizados e o que vale lembrar.</span><span class="st-home-feature-link">Abrir meu diário <b>→</b></span></button>
     <button type="button" class="st-home-feature st-feature-spaces" id="homeFeatureSpaces"><span class="st-home-feature-top"><span class="st-home-feature-icon">${icon('group')}</span><span class="st-home-feature-arrow">↗</span></span><span class="st-home-feature-title">Espaços compartilhados</span><span class="st-home-feature-desc">Organize atividades com pessoas importantes.</span><span class="st-home-feature-link">Encontrar seu grupo <b>→</b></span></button>
   </section>
   <section class="st-home-bottom-grid">
     <article class="st-home-panel st-home-today-panel"><header class="st-home-panel-head"><div><span class="st-home-kicker">PRÓXIMOS PASSOS</span><h2>O que vem hoje</h2></div><button type="button" class="st-home-inline-link" data-home-page="planner">Ver planejamento →</button></header><div id="homeTodayTasks" class="st-home-today-list"><div class="st-home-list-loading"><span></span> Buscando suas tarefas…</div></div><button type="button" class="st-home-add-task" id="homeAddTask">${icon('plus')} Adicionar uma tarefa</button></article>
     <article class="st-home-panel st-home-training-panel"><header class="st-home-panel-head"><div><span class="st-home-kicker">SEU BEM-ESTAR</span><h2>Um hábito de cada vez</h2></div><span class="st-home-round-mark">✳</span></header><p class="st-home-training-copy">${status?`Hoje você marcou <b>${esc(status.label.toLocaleLowerCase('pt-BR'))}</b>.`: 'Seu dia ainda não tem um registro de treino.'} Seu progresso não precisa ser perfeito para ser real.</p><div class="st-home-challenge-line"><div><span>Desafio atual</span><b>${c.percent}%</b></div><div class="st-home-challenge-track"><i style="width:${c.percent}%"></i></div><small>Dia ${c.elapsed} de ${c.total}</small></div><div class="st-home-panel-actions"><button type="button" class="st-home-small-primary" id="homeTodayRecord">${status?'Editar registro de hoje':'Registrar meu dia'}</button><button type="button" class="st-home-small-secondary" data-home-page="life">Ver meus hábitos</button></div>${isGroup?`<div class="st-home-group-note"><span class="st-home-group-dot"></span><span>Agora em <b>${esc(state.group.name)}</b>${best?` · destaque da sala: ${esc(best.name.split(' ')[0])}`:''}</span></div>`:''}</article>
   </section>
   <footer class="st-home-footer"><span>SHAPE TOGETHER</span><span>Planeje com intenção. Avance no seu ritmo.</span></footer>
 </div>`;
 $('homeQuickTask').onclick=()=>{setPage('planner');window.setTimeout(()=>$('stPlannerForm')?.querySelector('[name="title"]')?.focus({preventScroll:true}),180)};
 $('homeQuickWorkout').onclick=()=>{setPage('calendar');window.setTimeout(openDayForToday,80)};
 $('homeTodayRecord').onclick=()=>{setPage('calendar');window.setTimeout(openDayForToday,80)};
 $('homeAddTask').onclick=()=>$('homeQuickTask').click();
 $('homeWorkspace').onclick=e=>{e.stopPropagation();workspaceMenuOpen=true;renderWorkspaceSwitcher()};
 $('homeFeatureSpaces').onclick=()=>{workspaceMenuOpen=true;renderWorkspaceSwitcher()};
 document.querySelectorAll('[data-home-page]').forEach(button=>button.addEventListener('click',()=>setPage(button.dataset.homePage)));
 // The organization and task metrics fill in when their authenticated summaries arrive.
}

window.addEventListener('st:planner-dashboard-summary',event=>{
 const data=event.detail||{};const tasks=Array.isArray(data.tasks)?data.tasks:[];
 const open=tasks.filter(t=>t.status==='open');
 const dueToday=open.filter(t=>t.dueDate===today()).sort((a,b)=>({high:0,normal:1,low:2}[a.priority]??1)-({high:0,normal:1,low:2}[b.priority]??1));
 const metric=$('homeMetricTasks'),sub=$('homeMetricTasksSub'),list=$('homeTodayTasks');
 if(data.error){if(metric)metric.textContent='—';if(sub)sub.textContent='Resumo indisponível';if(list)list.innerHTML='<div class="st-home-empty-list"><b>Planejamento indisponível</b><span>Abra o Planejador para tentar novamente.</span></div>';return}
 if(metric)metric.textContent=String(open.length);
 if(sub)sub.textContent=`${tasks.filter(t=>t.status==='done').length} concluída${tasks.filter(t=>t.status==='done').length===1?'':'s'} nesta semana`;
 if(!list)return;
 if(!dueToday.length){list.innerHTML='<div class="st-home-empty-list"><span class="st-home-empty-check">✓</span><b>Nenhuma tarefa com prazo para hoje.</b><span>Deixe espaço para o inesperado ou planeje seu próximo passo.</span></div>';return}
 list.innerHTML=dueToday.slice(0,4).map(task=>`<div class="st-home-task-row"><span class="st-home-task-check ${task.priority==='high'?'is-important':''}">${task.status==='done'?'✓':''}</span><span class="st-home-task-copy"><b>${esc(task.title)}</b><small>${task.priority==='high'?'Prioridade alta':task.priority==='low'?'Prioridade baixa':'Prioridade normal'}${task.category?` · ${esc(({general:'Geral',personal:'Pessoal',study:'Estudos',work:'Trabalho',training:'Treino',project:'Projeto'})[task.category]||'Geral')}`:''}</small></span><span class="st-home-task-arrow">›</span></div>`).join('')+(dueToday.length>4?`<div class="st-home-more-tasks">+ ${dueToday.length-4} tarefas adicionais</div>`:'');
});
window.addEventListener('st:organizer-dashboard-summary',event=>{
 const data=event.detail||{};const goals=$('homeMetricGoals'),goalsSub=$('homeMetricGoalsSub'),habits=$('homeMetricHabits'),habitsSub=$('homeMetricHabitsSub');
 if(data.error){if(goals)goals.textContent='—';if(habits)habits.textContent='—';if(goalsSub)goalsSub.textContent='Abra Metas & hábitos para tentar novamente';return}
 const items=Array.isArray(data.items)?data.items:[],logs=Array.isArray(data.habitLogs)?data.habitLogs:[],activeGoals=items.filter(i=>i.type==='goal'&&i.status==='active'),activeHabits=items.filter(i=>i.type==='habit'&&i.status==='active'),checked=new Set(logs.filter(l=>l.date===today()).map(l=>l.itemId));
 if(goals)goals.textContent=String(activeGoals.length);if(goalsSub)goalsSub.textContent=`${items.filter(i=>i.type==='project'&&i.status==='active').length} projeto${items.filter(i=>i.type==='project'&&i.status==='active').length===1?'':'s'} em andamento`;
 if(habits)habits.textContent=`${activeHabits.filter(i=>checked.has(i.id)).length}/${activeHabits.length}`;if(habitsSub)habitsSub.textContent=activeHabits.length?'hábitos feitos hoje':'Comece com um hábito simples';
});

function selectedCalendarMember(){return state.users.find(u=>u.id===(calendarMemberId||currentUser.id))||current()}
function renderCalendar(){const me=selectedCalendarMember(),d=new Date(calendarDate),y=d.getFullYear(),m=d.getMonth(),first=new Date(y,m,1),daysIn=new Date(y,m+1,0).getDate(),start=first.getDay();let grid=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(x=>`<div class="dow">${x}</div>`).join('');for(let i=0;i<start;i++)grid+='<div></div>';for(let n=1;n<=daysIn;n++){const date=iso(y,m,n),rec=state.days[me.id]?.[date],future=date>today(),bounds=activeChallengeBounds(),before=date<bounds.start,after=date>bounds.end,locked=before||after||future;grid+=`<button class="day ${date===today()?'today ':''}${before||after?'locked ':''}${future?'future ':''}" style="--day-i:${Math.min(n,31)}" ${locked?'disabled':''} onclick="window.__openDay('${date}')"><span class="num">${n}</span><span class="day-state">${rec?`<span class="dot ${rec.status}"></span><span>${esc(STATUS[rec.status].label)}</span>`:`<span style="color:var(--muted);font-size:9px">${before?'—':after?'Encerrado':future?'Em breve':'Adicionar'}</span>`}</span></button>`}const selectors=state.users.length>1?state.users.map((u,i)=>`<button class="map-chip" style="${u.id===me.id?`border-color:${memberColor(u,i)};color:${memberColor(u,i)}`:''}" onclick="window.__selectCalendar('${u.id}')"><i class="color-dot-lg" style="width:8px;height:8px;border-radius:50%;background:${memberColor(u,i)}"></i>${esc(u.name)}${u.id===currentUser.id?' · você':''}</button>`).join(''):'';$('page-calendar').innerHTML=`<div class="head"><div><div class="eyebrow">Calendário · ${workspaceMode==='group'?'Sala':'Pessoal'}</div><h1>${esc(me.name)}</h1><p>${me.id===currentUser.id?`Você pode editar os dias dentro do desafio (${esc(activeChallengeBounds().start.split('-').reverse().join('/'))} a ${esc(activeChallengeBounds().end.split('-').reverse().join('/'))}, incluindo dias passados.`:'Somente o dono desta conta pode editar os registros.'}</p></div></div><div class="card calendar-card">${selectors?`<div class="member-switch">${selectors}</div>`:''}<div class="calendar-top"><div><div class="month">${first.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</div><div class="calendar-note">Desafio: ${esc(activeChallengeBounds().start.split('-').reverse().join('/'))} → ${esc(activeChallengeBounds().end.split('-').reverse().join('/'))} · dias fora do período ficam bloqueados.</div></div><div class="calendar-actions"><button class="soft" onclick="window.__month(-1)">${icon('left')}</button><button class="soft" onclick="window.__today()">Hoje</button><button class="soft" onclick="window.__month(1)">${icon('right')}</button></div></div><div class="calendar-grid">${grid}</div><div class="legend"><span class="pill"><i class="dot red"></i>Não treinou</span><span class="pill"><i class="dot blue"></i>Descanso</span><span class="pill"><i class="dot orange"></i>Treinou, mas não foi tão bom</span><span class="pill"><i class="dot green"></i>Treinou bem</span></div></div>`}

function openDayForToday(){calendarMemberId=currentUser.id;openDay(today())}
function openDay(date){const target=selectedCalendarMember(),rec=state.days[target.id]?.[date],editable=canEdit(date,target.id),bounds=activeChallengeBounds(),before=date<bounds.start,after=date>bounds.end,future=date>today();selectedDate=date;selectedStatus=rec?.status||null;$('sheetTitle').textContent=`${date.split('-').reverse().join('/')} · ${target.name}`;$('sheetSub').textContent=editable?'Você pode editar este registro.':before?'Antes do início do desafio.':after?'O desafio já foi encerrado.':future?'Dia futuro.':'Visualização somente leitura.';$('sheetAvatar').textContent=target.initials;$('sheetAvatar').style.background=memberColor(target,state.users.findIndex(x=>x.id===target.id));$('dayNote').value=rec?.note||'';$('dayNote').disabled=!editable;$('saveDay').disabled=!editable;$('deleteDay').disabled=!editable;$('statusOptions').innerHTML=Object.entries(STATUS).map(([k,v])=>`<button class="status-btn ${selectedStatus===k?'active':''}" data-status="${k}" ${editable?'':'disabled'}><strong><i class="dot ${k}"></i>${v.label}</strong><small>${v.desc}</small></button>`).join('');document.querySelectorAll('.status-btn').forEach(b=>b.onclick=()=>{selectedStatus=b.dataset.status;document.querySelectorAll('.status-btn').forEach(x=>x.classList.toggle('active',x===b))});$('dayBack').classList.add('show');$('dayBack').setAttribute('aria-hidden','false')}
function closeDay(){$('dayBack').classList.remove('show');$('dayBack').setAttribute('aria-hidden','true')}
function showSaveOverlay(){const el=$('saveOverlay');if(!el)return;el.classList.add('show');el.setAttribute('aria-hidden','false');document.body.classList.add('save-lock')}
function hideSaveOverlay(){const el=$('saveOverlay');if(!el)return;el.classList.remove('show');el.setAttribute('aria-hidden','true');document.body.classList.remove('save-lock')}
function isImageDataUrl(v){return typeof v==='string'&&/^data:image\/(?:jpeg|jpg|png|webp);base64,/i.test(v)}
async function saveDay(){const target=selectedCalendarMember(),date=selectedDate,status=selectedStatus;if(savingDay||!date||!status||!canEdit(date,target.id))return;const note=$('dayNote').value.trim();const previous=state.days?.[target.id]?.[date]?{...state.days[target.id][date]}:null;savingDay=true;showSaveOverlay();const btn=$('saveDay');if(btn){btn.disabled=true;btn.textContent='Salvando…';btn.setAttribute('aria-busy','true')}state.days[target.id]||={};state.days[target.id][date]={status,note,updatedAt:new Date().toISOString()};try{if(online){const r=await api('/api/day',{method:'POST',body:JSON.stringify({date,status,note,workspaceMode:workspaceMode==='group'?'group':'personal',groupId:workspaceMode==='group'?state?.group?.id:null})});if(r.state)state=r.state;closeDay();renderApp();toast('Dia salvo.');return}writeLocal();closeDay();renderApp();toast('Dia salvo neste dispositivo.')}catch(e){state.days[target.id]||={};if(previous)state.days[target.id][date]=previous;else delete state.days[target.id][date];renderApp();toast(e.message||'Não foi possível salvar o dia.')}finally{savingDay=false;hideSaveOverlay()}}
async function deleteDay(){const target=selectedCalendarMember();if(!selectedDate||!canEdit(selectedDate,target.id))return;if(online){try{const r=await api('/api/day/'+selectedDate+'?'+new URLSearchParams({workspaceMode:workspaceMode==='group'?'group':'personal',...(workspaceMode==='group'&&state?.group?.id?{groupId:state.group.id}:{})}).toString(),{method:'DELETE'});if(r.state)state=r.state;closeDay();renderApp();toast('Registro apagado.');return}catch(e){toast(e.message);return}}delete state.days[target.id]?.[selectedDate];writeLocal();closeDay();renderApp();toast('Registro apagado.')}
function progressHistoryDates(id){
 const days=state.days[id]||{},dates=challengeDates(),registered=dates.filter(d=>Boolean(days[d]?.status));
 if(!registered.length)return[];
 const first=registered[0],last=registered[registered.length-1],start=dates.indexOf(first),end=dates.indexOf(last);
 return dates.slice(Math.max(0,start),end+1);
}
function historyPoints(id){
 const days=state.days[id]||{};return progressHistoryDates(id).map(date=>{const status=days[date]?.status||null;return{date,status,value:status?STATUS[status].value:null,registered:Boolean(status)}})
}
function weekPoints(id){
 const days=state.days[id]||{},dates=weekDates();return dates.map(date=>{const status=days[date]?.status||null;return{date,status,value:status?STATUS[status].value:null,registered:Boolean(status)}})
}
function weekStats(id){
 const points=weekPoints(id),registered=points.filter(p=>p.registered),total=registered.reduce((sum,p)=>sum+p.value,0);
 return{points,total,avg:registered.length?total/registered.length:0,registered:registered.length}
}
function drawWeekChart(container,id,otherIds){
 if(!container)return;
 const selectedIds=[...new Set([id,...(Array.isArray(otherIds)?otherIds:(typeof compareIds!=='undefined'?[...compareIds]:[]))].filter(Boolean))];
 const users=selectedIds.map(uid=>state.users.find(u=>u.id===uid)).filter(Boolean);
 if(!users.length){container.innerHTML='<div class="progress-empty"><strong>Ainda não há participantes para comparar.</strong><span>Registre seus dias no calendário para acompanhar a evolução.</span></div>';return;}
 const allDates=challengeDates(),hasAny=allDates.some(date=>users.some(u=>state.days[u.id]?.[date]?.status));
 if(!hasAny){container.innerHTML='<div class="progress-empty"><strong>Ainda não há registros suficientes.</strong><span>Marque um ou mais dias no calendário para ver a evolução e comparar participantes.</span></div>';return;}
 const activeDates=allDates.filter(date=>users.some(u=>state.days[u.id]?.[date]?.status));
 const dates=allDates.slice(allDates.indexOf(activeDates[0]),allDates.indexOf(activeDates[activeDates.length-1])+1);
 const n=dates.length,W=Math.max(920,78+(n-1)*54),H=356,ml=50,mr=28,mt=38,mb=76,plotW=W-ml-mr,plotH=H-mt-mb;
 const x=i=>n===1?ml+plotW/2:ml+plotW*i/(n-1),y=v=>mt+plotH-(Math.max(0,Math.min(10,v))/10)*plotH;
 const todayDate=today(),weekStart=new Date(todayDate+'T00:00:00');weekStart.setDate(weekStart.getDate()-6);
 const weekStartDate=iso(weekStart.getFullYear(),weekStart.getMonth(),weekStart.getDate()),inWeek=date=>date>=weekStartDate&&date<=todayDate;
 const statusColor={red:'var(--danger)',blue:'var(--rest)',orange:'var(--warn)',green:'var(--success)'};
 const series=users.map(u=>({user:u,primary:u.id===id,color:u.id===id?'var(--accent)':memberColor(u,state.users.findIndex(v=>v.id===u.id)),points:dates.map((date,index)=>{const status=state.days[u.id]?.[date]?.status||null;return{date,index,status,registered:Boolean(status),value:status?STATUS[status].value:null}})}));
 let grid='',labels='',primaryHistory='',primaryWeek='',comparisonLines='',pointsSvg='';
 [0,3,6,10].forEach(v=>{const yy=y(v);grid+=`<line x1="${ml}" y1="${yy}" x2="${W-mr}" y2="${yy}" class="week-grid"/><text x="${ml-11}" y="${yy+4}" text-anchor="end" class="week-y">${v}</text>`});
 const weekIndexes=dates.map((date,i)=>inWeek(date)?i:null).filter(i=>i!==null);
 if(weekIndexes.length){const first=weekIndexes[0],last=weekIndexes[weekIndexes.length-1],step=n===1?0:plotW/(n-1),bandX=n===1?ml-22:Math.max(ml,x(first)-step/2),bandRight=n===1?ml+22:Math.min(W-mr,x(last)+step/2);grid+=`<rect x="${bandX}" y="${mt}" width="${Math.max(0,bandRight-bandX)}" height="${plotH}" rx="14" class="week-focus-band"/><text x="${bandX+10}" y="${mt-11}" class="week-week-label">ÚLTIMOS 7 DIAS</text>`}
 const pathFor=points=>points.map((p,i)=>(i?'L':'M')+x(p.index)+','+y(p.value)).join(' ');
 series.filter(s=>!s.primary).forEach(member=>{let run=[];const flush=()=>{if(run.length>1)comparisonLines+=`<path d="${pathFor(run)}" class="week-line-comparison-user" stroke="${member.color}"/>`;run=[]};member.points.forEach(p=>{if(!p.registered){flush();return}run.push(p)});flush()});
 const main=series.find(s=>s.primary);
 if(main){let run=[];const flush=()=>{if(run.length>1)primaryHistory+=`<path d="${pathFor(run)}" class="week-line-history"/>`;run=[]};main.points.forEach(p=>{if(!p.registered){flush();return}run.push(p)});flush();run=[];const flushWeek=()=>{if(run.length>1)primaryWeek+=`<path d="${pathFor(run)}" class="week-line-week"/>`;run=[]};main.points.forEach(p=>{if(!p.registered||!inWeek(p.date)){flushWeek();return}run.push(p)});flushWeek()}
 series.filter(s=>!s.primary).concat(series.filter(s=>s.primary)).forEach(member=>member.points.forEach(p=>{if(!p.registered)return;const color=statusColor[p.status]||'var(--line2)',r=member.primary?6:4,sw=member.primary?2.8:1.7;pointsSvg+=`<circle cx="${x(p.index)}" cy="${y(p.value)}" r="${r}" fill="var(--panel)" stroke="${color}" stroke-width="${sw}" class="${member.primary?'week-point':'week-point-comparison'}"><title>${esc(member.user.name)} · ${p.date.split('-').reverse().join('/')} · ${esc(STATUS[p.status].label)} · ${p.value}/10</title></circle>`;if(member.primary)pointsSvg+=`<circle cx="${x(p.index)}" cy="${y(p.value)}" r="2.2" fill="${color}" class="week-point-core" aria-hidden="true"/>`}));
 dates.forEach((date,i)=>{const active=date===todayDate,xx=x(i);if(active)labels+=`<line x1="${xx}" y1="${mt}" x2="${xx}" y2="${mt+plotH}" class="week-today-line"/>`;const dt=new Date(date+'T00:00:00'),dow=dt.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.','').slice(0,3);labels+=`<text x="${xx}" y="${H-31}" text-anchor="middle" class="week-x ${active?'active':''}">${dow}</text><text x="${xx}" y="${H-13}" text-anchor="middle" class="week-date ${active?'active':''}">${dt.getDate()}</text>`});
 const legend=series.map(s=>`<span class="week-chart-member ${s.primary?'is-primary':''}"><i style="background:${s.color}"></i><span>${esc(s.user.name)}${s.primary?' · você':''}</span></span>`).join('');
 container.style.overflowX='auto';container.style.overflowY='hidden';
 container.innerHTML=`<div class="progress-chart-meta"><span>${dates.length} dia${dates.length===1?'':'s'} no intervalo</span><span>Todos os participantes · escala 0–10</span></div><svg class="week-chart-svg week-chart-full" viewBox="0 0 ${W} ${H}" style="width:${W}px;min-width:${W}px;height:auto" role="img" aria-label="Histórico diário comparativo dos participantes selecionados; mesma escala de zero a dez e datas alinhadas."><defs><filter id="weekPointGlowHistory"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>${grid}${comparisonLines}${primaryHistory}${primaryWeek}${labels}${pointsSvg}</svg><div class="week-chart-members" aria-label="Legenda dos participantes">${legend}</div>`;
}
function renderProgress(){
 const me=current(),others=state.users.filter(u=>u.id!==me.id),history=historyPoints(me.id),w=weekStats(me.id),c=memberColor(me,state.users.findIndex(x=>x.id===me.id));
 if(compareIds.size===0)others.forEach(u=>compareIds.add(u.id));
 const best=history.reduce((m,p)=>p.registered?Math.max(m,p.value):m,0);
 const last=history[history.length-1];
 const start=history[0];
 const rangeLabel=start&&last?`${start.date.split('-').reverse().join('/')} → ${last.date.split('-').reverse().join('/')}`:'Nenhum registro ainda';
 $('page-progress').innerHTML=`<div class="head"><div><div class="eyebrow">Progressão</div><h1>Seu progresso, dia após dia.</h1><p>Histórico diário e radar de desempenho em uma só tela.</p></div></div><div class="progress"><section class="card week-progress-card">
 <div class="week-head"><div><div class="eyebrow">Histórico diário</div><h2>Do primeiro ao último registro.</h2><p>${rangeLabel}. A semana recente fica destacada no gráfico.</p></div></div>
 <div class="week-summary"><div class="week-summary-item"><span>Dias registrados</span><b>${history.filter(p=>p.registered).length}</b></div><div class="week-summary-item"><span>Melhor resultado</span><b>${best}<small>/10</small></b></div><div class="week-summary-item"><span>Média da semana</span><b>${w.registered?w.avg.toFixed(1).replace('.',','):'—'}<small>/10</small></b></div></div>
 <div id="weekChart" class="week-chart"></div>
 <div class="week-scale" aria-label="Legenda do histórico diário"><div class="week-scale-title">Legenda do histórico diário</div><div class="week-scale-statuses"><span><i class="red"></i><b>0</b> · Não treinou</span><span><i class="blue"></i><b>3</b> · Descanso</span><span><i class="orange"></i><b>6</b> · Treino mediano</span><span><i class="green"></i><b>10</b> · Treinou bem</span></div><p class="week-scale-note">Deslize no gráfico para consultar todo o histórico.</p></div>
 </section>
 <div class="progress-top"><div class="legend-map"><span class="map-chip" style="border-color:${c};color:${c}"><i style="width:8px;height:8px;border-radius:50%;background:${c}"></i>Você</span>${others.map((u)=>{const cc=memberColor(u,state.users.findIndex(x=>x.id===u.id));return `<label class="map-chip"><input type="checkbox" data-compare="${u.id}" ${compareIds.has(u.id)?'checked':''}><i style="width:8px;height:8px;border-radius:50%;background:${cc}"></i>${esc(u.name)}</label>`}).join('')}</div></div>
 <section class="card map-box"><div class="map-box-head"><div><div class="eyebrow">Mapa do desafio</div><b>Radar de desempenho</b><small>Seis dimensões, escala de 0 a 100. Use os filtros para comparar participantes.</small></div></div><div id="mapBox"></div></section>
 </div>`;
 drawWeekChart($('weekChart'),me.id,[...compareIds]);drawMap($('mapBox'),me.id,[...compareIds]);document.querySelectorAll('[data-compare]').forEach(x=>x.onchange=()=>{x.checked?compareIds.add(x.dataset.compare):compareIds.delete(x.dataset.compare);drawWeekChart($('weekChart'),me.id,[...compareIds]);drawMap($('mapBox'),me.id,[...compareIds])})
}
function drawMap(container,primaryId,otherIds){
 if(!container)return;
 const size=640,c=320,R=200;
 const selected=Array.isArray(otherIds)?otherIds:(typeof compareIds!=='undefined'?[...compareIds]:[]);
 const axes=['Consistência','Treinos bons','Treino mediano','Descanso','Não treinou','Pontuação média'];
 const axisClasses=['radar-axis-consistency','radar-axis-good','radar-axis-moderate','radar-axis-rest','radar-axis-none','radar-axis-score'];
 const angles=axes.map((_,i)=>-Math.PI/2+i*Math.PI/3),dates=challengeDates(),elapsed=Math.max(1,dates.length),rings=[20,40,60,80,100];
 const members=[...new Set([primaryId,...selected].filter(Boolean))].map(id=>state.users.find(u=>u.id===id)).filter(Boolean);
 const primary=members.find(u=>u.id===primaryId)||current();
 if(primary&&!members.some(u=>u.id===primary.id))members.push(primary);
 const ordered=[...members.filter(u=>u.id!==primaryId),...members.filter(u=>u.id===primaryId)];
 const metrics=userId=>{const days=state.days[userId]||{},counts={red:0,blue:0,orange:0,green:0};let registered=0;dates.forEach(date=>{const status=days[date]?.status;if(status&&Object.prototype.hasOwnProperty.call(counts,status)){counts[status]++;registered++}});const pct=count=>Math.round(count/elapsed*100);return{registered,values:[Math.round(registered/elapsed*100),pct(counts.green),pct(counts.orange),pct(counts.blue),pct(counts.red),progress(userId).score]}};
 const pt=(value,angle)=>{const r=R*Math.max(0,Math.min(100,value))/100;return{x:c+r*Math.cos(angle),y:c+r*Math.sin(angle)}};
 const pointsFor=values=>values.map((value,i)=>{const p=pt(value,angles[i]);return`${p.x.toFixed(2)},${p.y.toFixed(2)}`}).join(' ');
 const gridPoints=scale=>angles.map(a=>`${(c+R*scale*Math.cos(a)).toFixed(2)},${(c+R*scale*Math.sin(a)).toFixed(2)}`).join(' ');
 let svg=`<svg class="radar-svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="Radar de desempenho com seis dimensões, cinco anéis de referência e escala de zero a cem."><defs><linearGradient id="radarPrimaryFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--accent)" stop-opacity=".25"/><stop offset="100%" stop-color="var(--accent)" stop-opacity=".045"/></linearGradient></defs>`;
 rings.forEach(level=>{svg+=`<polygon class="map-ring radar-ring" points="${gridPoints(level/100)}" fill="none" stroke="currentColor" opacity="${level===100?.25:.13}"/>`;const p=pt(level,-Math.PI/2);svg+=`<text x="${c+7}" y="${p.y+4}" class="radar-label radar-scale-label">${level}</text>`});
 angles.forEach(a=>{const p=pt(100,a);svg+=`<line x1="${c}" y1="${c}" x2="${p.x.toFixed(2)}" y2="${p.y.toFixed(2)}" class="map-axis-guide"/>`});
 axes.forEach((label,i)=>{const a=angles[i],rr=R+37,x=c+rr*Math.cos(a),y=c+rr*Math.sin(a)+3,anchor=Math.cos(a)>.35?'start':Math.cos(a)<-.35?'end':'middle';svg+=`<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" text-anchor="${anchor}" class="radar-label radar-axis-label ${axisClasses[i]}">${esc(label)}</text>`});
 ordered.forEach(user=>{const isPrimary=user.id===primaryId,userIndex=state.users.findIndex(u=>u.id===user.id),color=isPrimary?'var(--accent)':memberColor(user,userIndex),data=metrics(user.id);if(!data.registered)return;const points=pointsFor(data.values);if(isPrimary)svg+=`<polygon points="${points}" fill="url(#radarPrimaryFill)" stroke="none"/>`;svg+=`<polygon points="${points}" fill="${isPrimary?'var(--accent)':'none'}" fill-opacity="${isPrimary?.045:0}" stroke="${color}" stroke-width="${isPrimary?3.4:2.3}" stroke-linejoin="round" ${isPrimary?'':'stroke-dasharray="6 4"'} opacity="${isPrimary?1:.86}" vector-effect="non-scaling-stroke"><title>${esc(user.name)} · ${data.registered} registros</title></polygon>`;data.values.forEach((value,i)=>{const p=pt(value,angles[i]);if(value>0)svg+=`<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="${isPrimary?4.3:3.3}" fill="${color}" stroke="var(--panel)" stroke-width="1.5" vector-effect="non-scaling-stroke"><title>${esc(user.name)} · ${axes[i]}: ${value}/100</title></circle>`})});
 const anyData=ordered.some(user=>metrics(user.id).registered>0);
 if(!anyData)svg+=`<text x="320" y="304" text-anchor="middle" class="radar-empty-title">Aguardando registros</text><text x="320" y="326" text-anchor="middle" class="radar-empty-subtitle">A forma aparecerá após o primeiro registro.</text>`;
 svg+='</svg>';
 const legend=ordered.map(user=>{const isPrimary=user.id===primaryId,idx=state.users.findIndex(u=>u.id===user.id),color=isPrimary?'var(--accent)':memberColor(user,idx),data=metrics(user.id),photo=getPhoto(user),initials=esc(user.initials||String(user.name||'P').split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase());return`<article class="radar-member-key" style="--member-color:${color}"><span class="radar-member-avatar" style="background:${memberColor(user,idx)}">${photo?`<img src="${esc(photo)}" alt="" loading="lazy">`:`<span>${initials}</span>`}</span><i aria-hidden="true"></i><div class="radar-member-copy"><b>${esc(user.name)}${isPrimary?' · você':''}</b><small>${data.registered} registro${data.registered===1?'':'s'} · média ${data.values[5]}/100</small>${data.registered?'<span class="radar-member-status">Incluído no radar</span>':'<span class="radar-member-status is-empty">Sem dados para desenhar a forma</span>'}</div></article>`}).join('');
 container.innerHTML=svg+`<section class="map-chart-legend radar-chart-legend" aria-label="Legenda e interpretação do radar"><div class="radar-legend-section"><div class="radar-legend-heading"><b>Participantes comparados</b><small>Foto do perfil, registros e pontuação média.</small></div><div class="radar-members-list">${legend}</div></div><div class="radar-status-key" aria-label="Escala do histórico diário"><span class="st-status-red">0 · Não treinou</span><span class="st-status-blue">3 · Descanso</span><span class="st-status-orange">6 · Treino mediano</span><span class="st-status-green">10 · Treinou bem</span></div><p class="radar-reading-note"><b>Escala 0–100.</b> Dias sem registro não entram em “Não treinou”. Os detalhes dos seis eixos estão na ajuda desta aba.</p></section>`;
}
function renderNotes(){const all=Object.entries(state.days).flatMap(([uid,ds])=>Object.entries(ds).filter(([,v])=>v.note).map(([date,v])=>({uid,date,...v}))).sort((a,b)=>b.date.localeCompare(a.date));const isGroup=workspaceMode==='group'&&state.group;const filters=isGroup?`<div class="note-filter"><button class="soft active" data-note-filter="all">Todas</button>${state.users.map(u=>`<button class="soft" data-note-filter="${u.id}">${esc(u.name.split(' ')[0])}</button>`).join('')}</div>`:'';$('page-notes').innerHTML=`<div class="head"><div><div class="eyebrow">Anotações · ${isGroup?'Sala':'Pessoal'}</div><h1>${isGroup?'O que aconteceu na sala.':'O que aconteceu.'}</h1><p>${isGroup?'Um histórico simples das anotações compartilhadas com os participantes da sala.':'Seu histórico privado de anotações, separado das salas.'}</p></div></div><div class="card">${filters}<div id="notesList" class="notes"></div></div>`;const list=$('notesList');const draw=f=>{const notes=f==='all'?all:all.filter(n=>n.uid===f);list.innerHTML=notes.length?notes.map(n=>{const u=state.users.find(x=>x.id===n.uid);return `<article class="note"><div class="note-head"><div style="display:flex;align-items:center;gap:8px"><span class="group-avatar" style="width:27px;height:27px;background:${memberColor(u,state.users.findIndex(x=>x.id===u.id))}">${getPhoto(u)?`<img src="${esc(getPhoto(u))}" alt="" loading="eager">`:esc(u?.initials||'P')}</span><b>${esc(u?.name||'Pessoa')}</b></div><span>${esc(n.date.split('-').reverse().join('/'))}</span></div><p>${esc(n.note)}</p></article>`}).join(''):'<div style="color:var(--muted);font-size:12px;padding:8px 0">Ainda não há anotações para este espaço.</div>'};draw('all');document.querySelectorAll('[data-note-filter]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-note-filter]').forEach(x=>x.classList.toggle('active',x===b));draw(b.dataset.noteFilter)})}

function renderGroup(){const users=state.users,group=state.group;if(!group)return;const ranked=[...users].sort((a,b)=>progress(b.id).score-progress(a.id).score);const avg=users.length?Math.round(users.reduce((a,u)=>a+progress(u.id).score,0)/users.length):0;const inviteUrl=`${location.origin}/?invite=${encodeURIComponent(group.inviteCode)}`;$('page-group').innerHTML=`<div class="head"><div><div class="eyebrow">Sala · ${esc(group.visibility==='private'?'Privada':'Pública')}</div><h1>${esc(group.name)}</h1><p>Este espaço é separado do seu pessoal. Somente participantes desta sala aparecem aqui.</p></div></div><div class="invite"><div><b>Convite da sala</b><span>${esc(group.inviteCode)}</span></div><button id="copyInvite" class="soft" type="button">Copiar convite</button></div><div class="group-summary"><div class="stat"><div class="v">${users.length}</div><div class="l">participantes</div></div><div class="stat"><div class="v">${avg}</div><div class="l">média da sala</div></div><div class="stat"><div class="v">${ranked[0]?progress(ranked[0].id).score:0}</div><div class="l">maior evolução</div></div></div><div class="group-toolbar"><div><div class="eyebrow">Participantes</div><b style="font-size:13px">Todos da sala</b></div><button id="groupInviteAgain" class="soft" type="button">Compartilhar</button></div><div class="members">${users.map((u,i)=>{const p=progress(u.id),cc=memberColor(u,i),rank=ranked.findIndex(x=>x.id===u.id)+1;return `<div class="member"><div class="member-card-top"><div class="member-head"><div class="avatar" style="background:${cc};overflow:hidden">${getPhoto(u)?`<img src="${esc(getPhoto(u))}" alt="" loading="eager">`:esc(u.initials)}</div><div><div class="member-name">${esc(u.name)}${u.id===currentUser.id?' · você':''}</div><div class="member-email">${u.email?esc(u.email):'participante'}</div></div></div><span class="member-badge">#${rank}</span></div><div class="member-score">${p.score}<span style="font-size:10px;color:var(--muted);font-weight:800"> / 100</span></div><div class="bar"><i style="width:${p.score}%;background:${cc}"></i></div><div class="member-rank">${p.registered} dias registrados · ${monthStats(u.id).green} treinos bons</div></div>`}).join('')}</div>`;const copy=async()=>{try{await navigator.clipboard.writeText(inviteUrl);toast('Convite copiado.')}catch{toast(inviteUrl)}};$('copyInvite').onclick=copy;$('groupInviteAgain').onclick=copy}

function renderTopAccount(){const me=current();if(!me||!$('topAccount'))return;const p=getPhoto(me);$('topAccount').className=`top-account ${p?'has-photo':''}`;$('topAccount').style.background=p?'var(--panel2)':memberColor(me,state.users.findIndex(x=>x.id===me.id));$('topAccount').innerHTML=p?`<img src="${esc(p)}" alt="Foto de ${esc(me.name)}" loading="eager">`:esc(me.initials||'EU')}
function renderSettingsAvatar(el,me){if(!el)return;const p=getPhoto(me);el.innerHTML=p?`<span style="width:100%;height:100%;display:block;border-radius:inherit;overflow:hidden"><img src="${esc(p)}" alt="Foto do perfil" loading="eager"></span>`:esc(me.initials||'EU');el.style.background=memberColor(me,state.users.findIndex(x=>x.id===me.id))}

function openSettings(category='home'){const me=current();if(!me)return;settingsReturnFocus=document.activeElement;renderSettingsAvatar($('settingsAvatar'),me);renderSettingsAvatar($('settingsAvatarLarge'),me);renderSettingsAvatar($('settingsAccountAvatar'),me);$('settingsUserName').textContent=me.name||'Seu perfil';$('settingsUserMeta').textContent='@'+me.username;$('settingsName').value=me.name||'';$('profileNote').textContent='';$('settingsAccountName').textContent=me.name||'—';$('settingsAccountMeta').textContent='@'+(me.username||'—');$('settingsAccountInfo').innerHTML=`<div class="setting-row"><div><b>Usuário</b><small>Identificador da conta</small></div><span class="settings-value">@${esc(me.username||'—')}</span></div>${me.email?`<div class="setting-row"><div><b>E-mail</b><small>Endereço associado à conta</small></div><span class="settings-value">${esc(me.email)}</span></div>`:''}`;$('settingsBack').classList.add('show');$('settingsBack').setAttribute('aria-hidden','false');document.body.classList.add('modal-open');renderSettingsThemeState();renderWorkspaceDefaultState();selectSettings(category);updatePhotoUI()}

function closeSettings(){const backTo=settingsReturnFocus;$('settingsBack').classList.remove('show');$('settingsBack').setAttribute('aria-hidden','true');$('settingsBackBtn').classList.add('hidden');$('settingsHome').classList.remove('hidden');$('settingsDetail').classList.add('hidden');document.body.classList.remove('modal-open');settingsReturnFocus=null;try{backTo?.focus?.()}catch{}}
function selectSettings(category){if(category==='home'){ $('settingsHome').classList.remove('hidden');$('settingsDetail').classList.add('hidden');$('settingsBackBtn').classList.add('hidden');$('settingsTitle').textContent='Configurações';return}$('settingsHome').classList.add('hidden');$('settingsDetail').classList.remove('hidden');$('settingsBackBtn').classList.remove('hidden');document.querySelectorAll('.settings-section').forEach(s=>s.classList.toggle('active',s.id==='settings-'+category));const labels={profile:'Perfil',theme:'Aparência',account:'Conta'};$('settingsTitle').textContent=labels[category]||'Configurações'}
function compressImage(file,max=1400){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('Não foi possível ler a imagem.'));reader.onload=()=>{const img=new Image();img.onerror=()=>reject(new Error('Imagem inválida.'));img.onload=()=>{const scale=Math.min(1,max/Math.max(img.width,img.height));const w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale));const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{alpha:false});ctx.drawImage(img,0,0,w,h);resolve(canvas.toDataURL('image/jpeg',.9));};img.src=reader.result};reader.readAsDataURL(file)})}
async function saveProfile(){const me=current(),name=$('settingsName').value.trim();if(savingProfile)return;if(!name){$('profileNote').textContent='Digite um nome válido.';return}savingProfile=true;showSaveOverlay();const localAvatar=me.avatar,localSource=me.avatarSource,localCrop=me.avatarCrop;try{me.name=name;me.initials=name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'EU';if(state.users){const u=state.users.find(x=>x.id===me.id);if(u){u.name=me.name;u.initials=me.initials;u.avatar=me.avatar;u.avatarSource=me.avatarSource;u.avatarCrop=me.avatarCrop}}currentUser=me;if(online){const payload={name:me.name,initials:me.initials};if(isImageDataUrl(me.avatar)){payload.avatar=me.avatar;if(isImageDataUrl(me.avatarSource))payload.avatarSource=me.avatarSource;if(me.avatarCrop&&typeof me.avatarCrop==='object')payload.avatarCrop=me.avatarCrop}const r=await api('/api/settings',{method:'POST',body:JSON.stringify(payload)});if(r.state){state=r.state;const serverMe=state.users?.find(x=>x.id===me.id);if(serverMe){serverMe.avatar=serverMe.avatar||localAvatar;serverMe.avatarSource=serverMe.avatarSource||localSource;serverMe.avatarCrop=serverMe.avatarCrop||localCrop}}if(r.user)currentUser={...me,...r.user,avatar:r.user.avatar||localAvatar,avatarSource:r.user.avatarSource||localSource,avatarCrop:r.user.avatarCrop||localCrop}}else writeLocal();$('profileNote').textContent='Perfil atualizado.';renderApp();renderTopAccount();updatePhotoUI();openSettings('profile')}catch(e){$('profileNote').textContent='Não foi possível salvar o perfil na conta online.';writeLocal();renderApp();renderTopAccount();updatePhotoUI()}finally{savingProfile=false;hideSaveOverlay()}}
async function logout(){const logoutRequest=online?api('/api/logout',{method:'POST',keepalive:true}).catch(()=>{}):Promise.resolve();online=false;googleEnabled=false;currentUser=null;state=null;calendarMemberId=null;compareIds.clear();closeAppearance();showAuth();toast('Sessão encerrada.');await logoutRequest}
async function deleteAccount(){if(!online)return toast('A exclusão permanente está disponível apenas na conta online.');const first=confirm('Excluir sua conta permanentemente? Seus registros pessoais, preferências e foto serão removidos. Salas compartilhadas serão mantidas para os outros participantes. Essa ação não pode ser desfeita.');if(!first)return;const second=prompt('Para confirmar, digite EXCLUIR.');if(second!=='EXCLUIR')return toast('Exclusão cancelada.');const button=$('settingsDeleteAccount');if(button){button.disabled=true;button.textContent='Excluindo…'}try{await api('/api/account',{method:'DELETE'});online=false;googleEnabled=false;currentUser=null;state=null;calendarMemberId=null;compareIds.clear();closeSettings();closeAppearance();showAuth();toast('Conta excluída permanentemente.')}catch(e){toast(e.message||'Não foi possível excluir a conta.')}finally{if(button){button.disabled=false;button.textContent='Excluir conta'}}}
function showBoot(message='Verificando sua sessão e seus dados…',retry=false,titleText='Preparando sua conta.'){
 $('authView').classList.add('hidden');$('appView').classList.add('hidden');$('mobileNav').classList.add('hidden');$('mobileSubnav')?.classList.add('hidden');$('bootView').classList.remove('hidden');
 if($('bootTitle'))$('bootTitle').textContent=titleText;
 $('bootMessage').textContent=message;
 $('bootSpinner').classList.toggle('hidden',Boolean(retry));
 $('retryBoot').classList.toggle('hidden',!retry);
 if(retry){$('retryBoot').disabled=false;$('retryBoot').textContent='Tentar novamente';$('retryBoot').onclick=async()=>{const button=$('retryBoot');button.disabled=true;button.textContent='Tentando…';try{await boot()}finally{button.disabled=false;button.textContent='Tentar novamente'}}}
}
async function diagnoseStartupFailure(error){
 const status=Number(error?.status||0),body=error?.payload||{};
 if(body.code&&String(body.code).startsWith('MIGRATION_'))return{title:'Falta uma atualização do banco',message:body.error||error.message||'Execute a migração indicada no Supabase e tente novamente.'};
 if(body.config){const c=body.config;if(!c.url||!c.secret||!c.session)return{title:'Configuração do servidor incompleta',message:'O Worker não conseguiu acessar o banco ou criar a sessão. No Cloudflare, confira os bindings SUPABASE_URL, SUPABASE_SECRET_KEY e SESSION_SECRET. Não compartilhe os valores dessas chaves.'}}
 if(status===404)return{title:'Versão do site incompatível',message:'O servidor não reconheceu uma rota necessária. Publique juntos os arquivos HTML, JavaScript e server.js da mesma versão e atualize a página sem cache.'};
 if(status===401)return{title:'Sua sessão precisa ser renovada',message:'Entre novamente para carregar seus dados.'};
 let health=null;
 try{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),3500);try{const r=await fetch('/api/health?diagnostic='+Date.now(),{credentials:'include',cache:'no-store',signal:controller.signal});health=await r.json().catch(()=>null)}finally{clearTimeout(timer)}}catch{}
 if(health?.config){const c=health.config;if(!c.url||!c.secret||!c.session)return{title:'Configuração do servidor incompleta',message:'O Worker não está configurado para acessar o Supabase e manter a sessão. No Cloudflare, confira SUPABASE_URL, SUPABASE_SECRET_KEY e SESSION_SECRET; mantenha os valores privados.'}}
 const tables=health?.tables||{};
 if(tables.group_day_records===false)return{title:'Atualização das salas pendente',message:'O banco ainda não reconhece public.group_day_records. No SQL Editor do Supabase, execute o arquivo supabase/group-day-records.sql completo; depois recarregue esta página.'};
 if(tables.planner_tasks===false)return{title:'Atualização do Planejador pendente',message:'A tabela de tarefas não foi encontrada. No SQL Editor do Supabase, execute supabase/planner-tasks.sql e recarregue esta página.'};
 if(tables.personal_organizer_items===false||tables.personal_habit_logs===false)return{title:'Atualização de metas e hábitos pendente',message:'As tabelas de organização pessoal não foram encontradas. Execute supabase/personal-organization.sql no SQL Editor do Supabase e recarregue esta página.'};
 const core=['app_users','groups','group_members','group_invites','day_records','user_preferences'];if(core.some(name=>tables[name]===false))return{title:'Estrutura principal do banco incompleta',message:'Uma ou mais tabelas principais não foram encontradas. Confira as migrações do diretório supabase e execute apenas as que ainda faltam.'};
 if(health?.storage?.avatars===false)return{title:'Armazenamento de fotos indisponível',message:'O banco respondeu, mas o bucket avatars não foi encontrado. Confira o bucket de fotos do perfil nas configurações do Supabase.'};
 if(status===503)return{title:'Servidor temporariamente indisponível',message:body.error||'O Worker não conseguiu acessar o banco. Confira as configurações do Cloudflare e o status do Supabase.'};
 if(status>=500)return{title:'Não foi possível carregar seus dados',message:error?.message||'O servidor encontrou um erro ao carregar sua conta. Tente novamente; se continuar, confira os logs do Worker no Cloudflare.'};
 if(error?.code==='NETWORK')return{title:'Sem conexão com o servidor',message:'Não foi possível alcançar o Shape Together. Confira a conexão e tente novamente.'};
 if(error?.code==='TIMEOUT')return{title:'O servidor demorou para responder',message:'A solicitação excedeu o tempo limite. Confira a conexão e tente novamente.'};
 return{title:'Não foi possível abrir o Shape Together',message:error?.message||'Tente novamente. Se o problema continuar, confira os logs do Worker no Cloudflare.'};
}
function showAuth(){$('bootView').classList.add('hidden');$('authView').classList.remove('hidden');$('appView').classList.add('hidden');$('mobileNav').classList.add('hidden');$('mobileSubnav')?.classList.add('hidden');updateAppearance()}
function applyAccountAppearance(){const t=currentUser?.theme==='dark'?'dark':'light',accent=migrateDefaultAccent(currentUser?.accent,t);document.documentElement.setAttribute('data-theme',t);storageSet(THEME_KEY,t);storageSet(ACCENT_KEY,accent);syncThemePalette(accent);updateAppearance();renderSettingsThemeState();renderAppearanceColors()}
let groupSyncTimer=null,groupSyncRunning=false;
function startGroupSync(){if(groupSyncTimer)clearInterval(groupSyncTimer);groupSyncTimer=setInterval(async()=>{
 if(groupSyncRunning||!online||!currentUser||workspaceMode!=='group'||!state?.group||document.visibilityState==='hidden'||savingDay||savingProfile||document.body.classList.contains('modal-open')||$('dayBack')?.classList.contains('show'))return;
 groupSyncRunning=true;
 try{const params=new URLSearchParams({mode:'group',groupId:state.group.id});const payload=await api('/api/state?'+params.toString());if(payload?.state&&JSON.stringify(payload.state)!==JSON.stringify(state)){state=payload.state;currentUser=payload.me||currentUser;const activeIds=new Set((state.users||[]).map(u=>u.id));compareIds=new Set([...compareIds].filter(id=>activeIds.has(id)));state.users.filter(u=>u.id!==currentUser.id).forEach(u=>compareIds.add(u.id));renderApp()}}
 catch{}finally{groupSyncRunning=false}
 },20000)}
function enterApp(){if(!currentUser||!state){showBoot('Não foi possível carregar a conta. Tente verificar a sessão novamente.',true);return}workspaceMode=state.workspaceMode||((state.group)?'group':'personal');$('bootView').classList.add('hidden');$('authView').classList.add('hidden');$('appView').classList.remove('hidden');$('mobileNav').classList.remove('hidden');calendarMemberId=currentUser.id;compareIds.clear();state.users.filter(u=>u.id!==currentUser.id).forEach(u=>compareIds.add(u.id));applyAccountAppearance();renderApp();initReleaseNotice();startGroupSync()}

async function completeGoogleCallback(){const hash=new URLSearchParams(location.hash.replace(/^#/,'').replace(/^\?/,'').replace(/;/g,'&'));const accessToken=hash.get('access_token'),refreshToken=hash.get('refresh_token');if(!accessToken)return false;if(!refreshToken){toast('A sessão Google veio incompleta. Entre novamente.');clearInviteFromUrl();return false}try{const r=await api('/api/auth/google-session',{method:'POST',body:JSON.stringify({access_token:accessToken,refresh_token:refreshToken})});online=true;currentUser=r.user;const invite=new URLSearchParams(location.search).get('invite')||'';if(invite){await processInvite(invite)}else{const payload=await api('/api/state');state=payload.state;currentUser=payload.me||r.user}history.replaceState({},'',location.pathname);enterApp();return true}catch(e){toast(e.message||'Não foi possível concluir o login com Google.');clearInviteFromUrl();return false}}

async function boot(){showBoot();online=false;googleEnabled=false;const q=new URLSearchParams(location.search);if(q.get('auth_error')){const map={google_not_configured:'Login com Google ainda precisa ser configurado no servidor.',google_failed:'Não foi possível iniciar o login com Google.',google_state:'O convite de login expirou. Tente novamente.',session_not_configured:'A sessão persistente não está configurada no servidor.'};toast(map[q.get('auth_error')]||'Não foi possível entrar.');history.replaceState({},'',location.pathname)}try{if(q.get('auth_callback')&&await completeGoogleCallback())return;let payload=null;try{payload=await api('/api/state')}catch(e){if(e.status===401){online=true;try{const p=await api('/api/auth/providers');googleEnabled=Boolean(p.google&&p.persistentDatabase)}catch{googleEnabled=true}$('googleOption').classList.toggle('hidden',!googleEnabled);currentUser=null;state=null;showAuth();return}throw e}online=true;state=payload.state;currentUser=payload.me;workspaceMode=state.workspaceMode||'personal';$('googleOption').classList.remove('hidden');const invite=q.get('invite')||'';if(invite){try{await processInvite(invite)}catch(e){toast(e.message||'Não foi possível entrar na sala pelo convite.')}}enterApp()}catch(e){console.error('[Shape Together] Falha ao iniciar:',e);online=false;googleEnabled=false;currentUser=null;state=null;$('googleOption').classList.add('hidden');const diagnostic=await diagnoseStartupFailure(e);showBoot(diagnostic.message,true,diagnostic.title)}}

$('googleBtn').onclick=()=>{if(!online)return toast('O login com Google funciona na versão online.');if(!googleEnabled)return toast('O Google ainda não está configurado no servidor.');const invite=new URLSearchParams(location.search).get('invite')||'';location.href='/auth/google'+(invite?'?invite='+encodeURIComponent(invite):'')};
$('topAccount').onclick=()=>openSettings('home');$('workspaceDialogClose').onclick=closeWorkspaceDialog;$('workspaceDialogCancel').onclick=closeWorkspaceDialog;$('workspaceDialogBack').onclick=e=>{if(e.target===$('workspaceDialogBack'))closeWorkspaceDialog()};$('workspaceDialogSubmit').onclick=submitWorkspaceDialog;$('workspaceDefaultPersonal').onclick=()=>{defaultWorkspaceDraftMode=null;setDefaultWorkspace('personal')};$('workspaceDefaultGroup').onclick=()=>{defaultWorkspaceDraftMode='group';if(!defaultWorkspaceDraftGroupId)defaultWorkspaceDraftGroupId=currentUser?.activeGroupId||activeWorkspaceGroup()?.id||workspaceGroups()[0]?.id||null;renderWorkspaceDefaultState();$('workspaceDefaultRoomSelect')?.focus()};$('settingsClose').onclick=closeSettings;$('settingsBackBtn').onclick=()=>selectSettings('home');$('settingsBack').onclick=e=>{if(e.target===$('settingsBack'))closeSettings()};document.querySelectorAll('[data-settings]').forEach(b=>b.onclick=()=>selectSettings(b.dataset.settings));$('choosePhoto').onclick=()=>$('profilePhotoInput').click();$('profilePhotoPreview').onclick=()=>{const me=current();openCropper(me?.avatarSource||me?.avatar)};$('editPhoto').onclick=()=>{const me=current();openCropper(me?.avatarSource||me?.avatar)};$('removePhoto').onclick=()=>{const me=current();me.avatar=null;me.avatarSource=null;me.avatarCrop=null;if(state?.users){const u=state.users.find(x=>x.id===me.id);if(u){u.avatar=null;u.avatarSource=null;u.avatarCrop=null}}$('profilePhotoInput').value='';writeLocal();if(online)api('/api/settings',{method:'POST',body:JSON.stringify({avatar:null})}).catch(()=>{});renderApp();openSettings('profile');toast('Foto removida.')};$('profilePhotoInput').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;if(!file.type.startsWith('image/'))return toast('Escolha uma imagem válida.');try{const source=await compressImage(file,1400);const me=current();me.avatarSource=source;me.avatarCrop=null;openCropper(source);$('profilePhotoInput').value=''}catch(err){toast(err.message)}};$('cropClose').onclick=closeCropper;$('cropCancel').onclick=closeCropper;$('cropBack').onclick=e=>{if(e.target===$('cropBack'))closeCropper()};$('cropReset').onclick=cropReset;$('cropZoom').oninput=e=>{cropZoom=Number(e.target.value)||1;renderCrop()};$('cropZoomOut').onclick=()=>{cropZoom=clamp(Number((cropZoom-.15).toFixed(2)),1,cropMax);renderCrop()};$('cropZoomIn').onclick=()=>{cropZoom=clamp(Number((cropZoom+.15).toFixed(2)),1,cropMax);renderCrop()};$('cropSave').onclick=applyCrop;$('cropStage').addEventListener('pointerdown',e=>{if(!cropImage)return;cropPointerId=e.pointerId;cropStartX=e.clientX;cropStartY=e.clientY;cropStartPanX=cropPanX;cropStartPanY=cropPanY;$('cropStage').classList.add('dragging');$('cropStage').setPointerCapture?.(e.pointerId)});$('cropStage').addEventListener('pointermove',e=>{if(e.pointerId!==cropPointerId)return;cropPanX=cropStartPanX+(e.clientX-cropStartX);cropPanY=cropStartPanY+(e.clientY-cropStartY);renderCrop()});['pointerup','pointercancel','pointerleave'].forEach(t=>$('cropStage').addEventListener(t,e=>{if(e.pointerId===cropPointerId){cropPointerId=null;$('cropStage').classList.remove('dragging')}}));window.addEventListener('resize',()=>{if($('cropBack').classList.contains('show'))renderCrop()});$('settingsBack').addEventListener('pointerdown',e=>{if(e.target!==$('settingsBack'))return});const settingsGrabber=$('settingsBack').querySelector('.settings-grabber');settingsGrabber.addEventListener('pointerdown',e=>{settingsDragStartY=e.clientY;settingsDragStartX=e.clientX;settingsDragging=true;$('settingsPanel')?.setPointerCapture?.(e.pointerId);settingsGrabber.setPointerCapture?.(e.pointerId)});settingsGrabber.addEventListener('pointermove',e=>{if(!settingsDragging)return;const dy=Math.max(0,e.clientY-settingsDragStartY);if(dy>0)$('settingsBack').querySelector('.settings-panel').style.transform=`translateY(${dy}px)`});['pointerup','pointercancel'].forEach(t=>settingsGrabber.addEventListener(t,e=>{if(!settingsDragging)return;const dy=Math.max(0,e.clientY-settingsDragStartY);settingsDragging=false;const panel=$('settingsBack').querySelector('.settings-panel');panel.style.transform='';if(dy>90)closeSettings()}));
$('saveProfile').onclick=saveProfile;$('settingsDark').onclick=()=>applyTheme('dark',true);$('settingsLight').onclick=()=>applyTheme('light',true);$('settingsThemeAppearance').onclick=()=>{closeSettings();toggleAppearance($('topTheme'))};$('settingsLogout').onclick=()=>{closeSettings();logout()};$('settingsDeleteAccount').onclick=deleteAccount;$('sideLogout').onclick=logout;$('cancelDay').onclick=closeDay;$('deleteDay').onclick=deleteDay;$('saveDay').onclick=saveDay;$('dayBack').onclick=e=>{if(e.target===$('dayBack'))closeDay()};document.addEventListener('keydown',e=>{if(e.key==='Escape'){if($('cropBack').classList.contains('show'))closeCropper();else if($('themePickerBack').classList.contains('show'))closeColorPicker();else if($('settingsBack').classList.contains('show'))closeSettings();else if($('appearance').classList.contains('show'))closeAppearance()}});

window.__openDay=openDay;window.__selectCalendar=id=>{calendarMemberId=id;renderCalendar()};window.__month=dir=>{calendarDate=new Date(calendarDate.getFullYear(),calendarDate.getMonth()+dir,1);renderCalendar()};window.__today=()=>{calendarDate=new Date();renderCalendar()};
function releaseHash(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return 'st-'+(h>>>0).toString(16).padStart(8,'0')}
async function getReleaseBuildFingerprint(){
 if(!RELEASE_ASSET_URLS.length)return null;
 try{
  const parts=await Promise.all(RELEASE_ASSET_URLS.map(async url=>{
   try{const freshUrl=new URL(url,location.href);freshUrl.searchParams.set('_st_release_check',RELEASE_BUILD_ID);const response=await fetch(freshUrl.href,{cache:'no-store',credentials:'same-origin'});if(!response.ok)return url+'\n#unavailable';return url+'\n'+await response.text()}
   catch{return url+'\n#unavailable'}
  }));
  return releaseHash(parts.join('\n---asset---\n'));
 }catch{return null}
}
function addReleaseNoticeStyles(){
 if($('stReleaseNoticeStyles'))return;
 const style=document.createElement('style');style.id='stReleaseNoticeStyles';
 style.textContent=`
  .st-release-backdrop{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;overflow-y:auto;overscroll-behavior:contain;padding:max(12px,env(safe-area-inset-top)) 12px max(12px,env(safe-area-inset-bottom));background:rgba(16,17,15,.42);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);animation:stReleaseFade .18s ease both}
  .st-release-dialog{position:relative;display:flex;flex:0 0 auto;flex-direction:column;width:min(480px,calc(100vw - 24px));max-height:calc(100vh - 24px);max-height:min(calc(100dvh - 24px),640px);overflow:hidden;border:1px solid var(--line,#dfdcd4);border-radius:22px;background:var(--panel,#fffdf9);color:var(--text,#171815);box-shadow:0 20px 55px rgba(0,0,0,.22);animation:stReleaseRise .22s cubic-bezier(.2,.8,.2,1) both}
  .st-release-top{flex:0 0 auto;padding:19px 21px 15px;border-bottom:1px solid var(--line,rgba(0,0,0,.08));background:linear-gradient(145deg,var(--panel2,#f0eee8),var(--panel,#fffdf9) 58%)}
  .st-release-heading{display:grid;grid-template-columns:52px minmax(0,1fr);align-items:center;gap:13px}
  .st-release-mark-image{display:block;width:52px;height:52px;object-fit:cover;border-radius:14px;background:var(--panel2,#f0eee8);border:1px solid var(--line,#dfdcd4);box-shadow:none}
  .st-release-kicker{display:block;margin:0 0 5px;color:var(--muted,#77766f);font-size:9px;font-weight:850;letter-spacing:.12em;text-transform:uppercase}
  .st-release-title{display:flex;flex-wrap:wrap;align-items:center;gap:5px;margin:0;font-size:clamp(19px,4.5vw,23px);line-height:1.16;letter-spacing:-.04em;font-weight:850;color:var(--text,#171815)}
  .st-release-title-accent{color:#5578F5}
  .st-release-attention-mark{display:inline-grid;place-items:center;flex:0 0 19px;width:19px;height:19px;margin-left:2px;border:1px solid var(--line2,#cbc7bd);border-radius:50%;background:var(--panel2,#f0eee8);color:var(--muted,#77766f);font-size:11px;font-weight:750;line-height:1;vertical-align:middle}
  .st-release-subtitle{margin:6px 0 0;font-size:12px;line-height:1.45;color:var(--muted,#77766f)}
  .st-release-version{display:inline-flex;align-items:center;gap:6px;margin-top:9px;padding:4px 8px;border:1px solid color-mix(in srgb,#5578F5 24%,var(--line,#dfdcd4));border-radius:999px;background:color-mix(in srgb,#5578F5 10%,var(--panel,#fffdf9));color:var(--text,#171815);font-size:10px;font-weight:800;letter-spacing:.01em}
  .st-release-version-dot{width:6px;height:6px;border-radius:50%;background:#5578F5;box-shadow:0 0 0 3px color-mix(in srgb,#5578F5 12%,transparent)}
  .st-release-content{flex:1 1 0;min-height:96px;max-height:min(46dvh,350px);overflow-x:hidden;overflow-y:auto;padding:10px 21px 12px;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;scrollbar-width:thin;scrollbar-color:#a5a69f transparent;touch-action:pan-y;outline:none}
  .st-release-content:focus-visible{box-shadow:inset 0 0 0 2px var(--line2,#cbc7bd)}
  .st-release-content::-webkit-scrollbar{width:7px}
  .st-release-content::-webkit-scrollbar-track{background:transparent}
  .st-release-content::-webkit-scrollbar-thumb{border-radius:999px;background:#a5a69f;border:2px solid transparent;background-clip:padding-box}
  .st-release-list{display:grid;gap:9px;margin:0;padding:0;list-style:none}
  .st-release-item{display:grid;grid-template-columns:36px minmax(0,1fr);align-items:start;gap:11px;padding:12px;border:1px solid color-mix(in srgb,#5578F5 22%,var(--line));border-radius:15px;background:color-mix(in srgb,#5578F5 8%,var(--panel));scroll-margin-block:8px;animation:stReleaseItemIn .24s var(--st-ease,cubic-bezier(.2,.75,.25,1)) both}
  .st-release-item:nth-child(2){animation-delay:35ms}
  .st-release-item:nth-child(3){animation-delay:70ms}
  .st-release-item:nth-child(4){animation-delay:105ms}
  .st-release-item:nth-child(5){animation-delay:140ms}
  .st-release-item-icon{display:grid;place-items:center;width:34px;height:34px;border-radius:11px;background:color-mix(in srgb,#5578F5 15%,var(--panel));color:#5578F5}
  .st-release-item-icon .icon{width:18px;height:18px}
  .st-release-tone-1{border-color:color-mix(in srgb,#20A779 22%,var(--line));background:color-mix(in srgb,#20A779 8%,var(--panel))}
  .st-release-tone-1 .st-release-item-icon{background:color-mix(in srgb,#20A779 15%,var(--panel));color:#16875F}
  .st-release-tone-2{border-color:color-mix(in srgb,#9B63D9 22%,var(--line));background:color-mix(in srgb,#9B63D9 8%,var(--panel))}
  .st-release-tone-2 .st-release-item-icon{background:color-mix(in srgb,#9B63D9 15%,var(--panel));color:#8552C3}
  .st-release-item-version{display:inline-flex;width:max-content;margin:0 0 5px;padding:3px 7px;border-radius:999px;background:color-mix(in srgb,var(--text) 5%,var(--panel));color:var(--muted,#77766f);font-size:9px;font-weight:850;letter-spacing:.045em}
  .st-release-item-title{display:block;font-size:13px;font-weight:820;line-height:1.4;color:var(--text,#171815)}
  .st-release-item-desc{margin:4px 0 0;color:var(--muted,#77766f);font-size:11px;line-height:1.5;overflow-wrap:anywhere}
  .st-release-footer{display:flex;flex:0 0 auto;align-items:center;justify-content:space-between;gap:12px;padding:12px 21px 16px;border-top:1px solid var(--line,#dfdcd4);background:var(--panel,#fffdf9)}
  .st-release-allgood{display:flex;align-items:center;gap:8px;min-width:0}
  .st-release-check{display:grid;place-items:center;width:25px;height:25px;flex:none;border:1px solid color-mix(in srgb,#20A779 22%,var(--line,#dfdcd4));border-radius:50%;background:color-mix(in srgb,#20A779 10%,var(--panel,#fffdf9));color:#16875F;font-size:13px;font-weight:800}.st-release-check .icon{width:14px;height:14px}
  .st-release-allgood strong{display:block;margin:0 0 2px;font-size:12px;font-weight:850;color:var(--text,#171815)}
  .st-release-allgood p{margin:0;color:var(--muted,#77766f);font-size:10px;line-height:1.4}
  .st-release-continue{display:flex;align-items:center;justify-content:center;gap:8px;flex:none;min-height:40px;padding:10px 16px;border:1px solid color-mix(in srgb,#4F78F6 28%,var(--line));border-radius:12px;background:linear-gradient(125deg,#4F78F6,#7B5CE1);color:#fff;font:inherit;font-size:12px;font-weight:850;cursor:pointer;box-shadow:0 7px 18px rgba(79,120,246,.19);transition:transform .18s ease,opacity .18s ease,box-shadow .18s ease}
  .st-release-continue:hover{opacity:.97;transform:translateY(-1px);box-shadow:0 10px 24px rgba(79,120,246,.25)}
  .st-release-continue:focus-visible{outline:2px solid var(--line2,#cbc7bd);outline-offset:3px}
  .st-release-continue svg{width:15px;height:15px}
  @keyframes stReleaseFade{from{opacity:0}to{opacity:1}}
  @keyframes stReleaseRise{from{opacity:0;transform:translateY(8px) scale(.99)}to{opacity:1;transform:translateY(0) scale(1)}}
  @keyframes stReleaseItemIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
  @media(max-width:480px){.st-release-dialog{max-height:calc(100vh - 20px);max-height:calc(100dvh - 20px);border-radius:19px}.st-release-top{padding:15px 16px 12px}.st-release-heading{grid-template-columns:45px minmax(0,1fr);gap:10px}.st-release-mark-image{width:45px;height:45px;border-radius:12px}.st-release-title{font-size:20px}.st-release-content{padding:8px 16px 10px;max-height:min(44dvh,310px)}.st-release-item{padding:10px}.st-release-item-title{font-size:12px}.st-release-item-desc{font-size:10.5px}.st-release-footer{padding:11px 16px 14px;gap:8px}.st-release-continue{padding:10px 11px;font-size:11px}}
  @media(max-width:350px){.st-release-footer{align-items:stretch;flex-direction:column}.st-release-continue{width:100%}.st-release-dialog{max-height:calc(100vh - 16px);max-height:calc(100dvh - 16px)}}
  @media(prefers-reduced-motion:reduce){.st-release-backdrop,.st-release-dialog,.st-release-item{animation:none}.st-release-continue{transition:none}}
 `
 document.head.appendChild(style);
}
let releaseNoticeCheckStarted=false;
async function initReleaseNotice(){
 if(releaseNoticeCheckStarted||$('stReleaseNotice'))return;
 releaseNoticeCheckStarted=true;
 let previousBuild='',previousVersion='';
 try{previousBuild=storageGet(RELEASE_SEEN_BUILD_KEY)||'';previousVersion=storageGet(RELEASE_SEEN_VERSION_KEY)||''}catch{}
 const fingerprint=await getReleaseBuildFingerprint();
 const versionChanged=previousVersion!==RELEASE_VERSION;
 const buildChanged=Boolean(fingerprint&&fingerprint!==previousBuild);
 if(!versionChanged&&!buildChanged&&(previousBuild||previousVersion))return;
 addReleaseNoticeStyles();
 const entries=RELEASE_HISTORY.slice(0,5);
 const versionLabel=`Versão ${RELEASE_VERSION}`;
 const backdrop=document.createElement('div');backdrop.className='st-release-backdrop';backdrop.id='stReleaseNotice';
 backdrop.innerHTML=`<section class="st-release-dialog" role="dialog" aria-modal="true" aria-labelledby="stReleaseTitle" aria-describedby="stReleaseSubtitle"><header class="st-release-top"><div class="st-release-heading"><img class="st-release-mark-image" src="/favicon.svg?v=${encodeURIComponent(RELEASE_ASSET_TAG)}" alt="" width="54" height="54"><div><span class="st-release-kicker">NOVIDADES DO APLICATIVO</span><h2 class="st-release-title" id="stReleaseTitle">Novidades do <span class="st-release-title-accent">Shape Together</span><span class="st-release-attention-mark" aria-hidden="true">!</span></h2><p class="st-release-subtitle" id="stReleaseSubtitle">Novidades desde sua última visita.</p><span class="st-release-version"><i class="st-release-version-dot" aria-hidden="true"></i>${esc(versionLabel)}</span></div></div></header><div class="st-release-content" id="stReleaseContent" tabindex="0" role="region" aria-label="Lista rolável de atualizações"><ul class="st-release-list">${entries.map((item,index)=>`<li class="st-release-item st-release-tone-${index%3}"><span class="st-release-item-icon" aria-hidden="true">${icon(item.icon||'sparkles')}</span><div><span class="st-release-item-version">${esc(item.version)}</span><strong class="st-release-item-title">${esc(item.title)}</strong><p class="st-release-item-desc">${esc(item.desc)}</p></div></li>`).join('')}</ul></div><footer class="st-release-footer"><div class="st-release-allgood"><span class="st-release-check" aria-hidden="true">${icon('check')}</span><div><strong>Tudo em dia</strong><p>Confira as novidades e continue.</p></div></div><button class="st-release-continue" id="stReleaseContinue" type="button">Continuar <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></footer></section>`;
 document.body.appendChild(backdrop);
 document.body.classList.add('modal-open');
 const continueButton=$('stReleaseContinue');
 const contentScroller=$('stReleaseContent');
 const removeReleaseLock=e=>{
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();continueButton?.click();return}
  if(e.key==='Tab'){
   const active=document.activeElement;
   if(e.shiftKey&&active===contentScroller){e.preventDefault();continueButton?.focus()}
   else if(!e.shiftKey&&active===continueButton){e.preventDefault();contentScroller?.focus()}
   else if(e.shiftKey&&active!==contentScroller&&active!==continueButton){e.preventDefault();contentScroller?.focus()}
  }
 };
 document.addEventListener('keydown',removeReleaseLock,true);
 contentScroller?.focus({preventScroll:true});
 continueButton.onclick=()=>{
  try{storageSet(RELEASE_SEEN_VERSION_KEY,RELEASE_VERSION);if(fingerprint)storageSet(RELEASE_SEEN_BUILD_KEY,fingerprint)}catch{}
  document.removeEventListener('keydown',removeReleaseLock,true);
  backdrop.remove();
  document.body.classList.remove('modal-open');
 };
}
function installAccountActionSpacingFix(){
 if(document.getElementById('st-account-action-spacing-fix'))return;
 const style=document.createElement('style');
 style.id='st-account-action-spacing-fix';
 style.textContent=`
  /* Keep account actions in normal flow so they never overlap. */
  #settingsLogout,#settingsDeleteAccount{
   position:relative!important;inset:auto!important;float:none!important;clear:both!important;
   display:flex!important;box-sizing:border-box!important;width:100%!important;max-width:100%!important;
   min-height:44px!important;height:auto!important;margin:12px 0 0!important;
   transform:none;flex:0 0 auto;white-space:normal;line-height:1.35;
  }
  #settingsLogout + #settingsDeleteAccount{margin-top:12px!important}
  #settingsDeleteAccount{border-color:color-mix(in srgb,var(--danger) 38%,var(--line));}
  .account-delete-warning{display:block!important;position:relative!important;clear:both!important;
   margin:10px 0 4px!important;line-height:1.55!important;overflow-wrap:anywhere;}
  .settings-content-detail{min-width:0;box-sizing:border-box;}
  @media(max-width:520px){
   #settingsLogout,#settingsDeleteAccount{min-height:46px!important;padding:12px 14px!important;}
   .account-delete-warning{font-size:10px;}
  }
 `;
 document.head.appendChild(style);
}
$('retryBoot').onclick=boot;
installAccountActionSpacingFix();
boot();
})();
