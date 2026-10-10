#!/usr/bin/env python3
"""Aplica ao Shape Together a sincronização do favicon com o tema e a cor."""
from pathlib import Path
import shutil
import sys

ROOT = Path(__file__).resolve().parent
APP = ROOT / "Public" / "js" / "app.js"
if not APP.is_file():
    sys.exit("Erro: coloque este arquivo na raiz do repositório Treino e extraia a pasta Public junto dele.")

source = APP.read_text(encoding="utf-8")
old_appearance = "function updateAppearance(){const dark=theme()==='dark',ic=dark?icon('moon'):icon('sun');"
new_appearance = '''function updateFavicon(){
 const link=document.querySelector('link[rel~="icon"]');
 if(!link)return;
 const accent=hex(document.documentElement.style.getPropertyValue('--accent'))||hex(localStorage.getItem(ACCENT_KEY))||DEFAULT_ACCENTS[theme()];
 const foreground=contrast(accent);
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180"><rect x="4" y="4" width="172" height="172" rx="42" fill="${accent}"/><g fill="${foreground}" stroke="${foreground}" stroke-linecap="round" stroke-linejoin="round"><rect x="28" y="46" width="23" height="52" rx="7"/><rect x="50" y="55" width="13" height="34" rx="5"/><path d="M59 72H121" fill="none" stroke-width="10"/><rect x="117" y="55" width="13" height="34" rx="5"/><rect x="129" y="46" width="23" height="52" rx="7"/></g><text x="90" y="147" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="62" font-weight="900" letter-spacing="-4" fill="${foreground}">ST</text></svg>`;
 link.setAttribute('href','data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg));
}
function updateAppearance(){updateFavicon();const dark=theme()==='dark',ic=dark?icon('moon'):icon('sun');'''
old_accent = "syncThemePalette(next);renderSettingsThemeState();renderAppearanceColors();if(currentUser&&online&&persist)persistOnlinePreferences()"
new_accent = "syncThemePalette(next);updateFavicon();renderSettingsThemeState();renderAppearanceColors();if(currentUser&&online&&persist)persistOnlinePreferences()"

if source.count(old_appearance) != 1:
    sys.exit("Erro: app.js não contém o ponto esperado de updateAppearance() exatamente uma vez; nenhum arquivo foi alterado.")
if source.count(old_accent) != 1:
    sys.exit("Erro: app.js não contém o ponto esperado de applyAccent() exatamente uma vez; nenhum arquivo foi alterado.")
updated = source.replace(old_appearance, new_appearance).replace(old_accent, new_accent)
backup = APP.with_suffix(APP.suffix + ".before-favicon.bak")
if backup.exists():
    sys.exit(f"Erro: backup já existe em {backup.name}; não sobrescrevi nada. Guarde-o ou renomeie-o e tente novamente.")
shutil.copy2(APP, backup)
APP.write_text(updated, encoding="utf-8")
print("Aplicado com sucesso: favicon acompanha o tema e a cor atual.")
print(f"Backup criado em: {backup.relative_to(ROOT)}")
