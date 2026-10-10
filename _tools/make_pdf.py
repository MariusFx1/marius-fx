"""Generează downloads/jurnal-tranzactionare-marius-fx.pdf (A4 landscape) prin HTML + Chrome headless."""
import subprocess, pathlib
FONT = "file:///usr/share/fonts/truetype/sand-box/google/Manrope/Manrope-VariableFont_wght.ttf"
OUT = "/workspace/forex-ms/downloads/jurnal-tranzactionare-marius-fx.pdf"
ROWS = 13
FACES = "\n".join("@font-face {{ font-family: 'Manrope'; src: url('file:///workspace/forex-ms-tools/fonts/Manrope-%d.ttf'); font-weight: %d; }}".replace("{{","{").replace("}}","}") % (w, w) for w in (400, 500, 600, 700, 800))
# (antet, lățime mm, indiciu pentru încercuit)
COLS = [("Nr.", 7, ""), ("Data", 15, ""), ("Pereche", 16, ""), ("Direcție", 14, "Buy · Sell"),
        ("Sesiune", 17, "SY · TK · LD · NY"), ("Setup / motiv intrare", 30, ""), ("Preț intrare", 15, ""),
        ("Stop loss", 14, ""), ("Take profit", 14, ""), ("Lot", 10, ""), ("Risc %", 10, ""),
        ("Risc în bani", 14, ""), ("R:R planificat", 13, "1 :"), ("Rezultat", 16, "TP · SL · BE · M"),
        ("Rezultat în R", 13, ""), ("Am respectat planul?", 13, "Da · Nu"), ("Emoții", 20, ""),
        ("Lecție / ce îmbunătățesc", 30, "")]
CHECK = ["Am un plan clar pentru această intrare?", "Stop loss setat?", "Risc ≤ 1–2% din cont?",
         "R:R ≥ 1:2?", "Nu tranzacționez din emoție (frică, FOMO, răzbunare)?"]
colgroup = "".join(f'<col style="width:{w}mm">' for _, w, _ in COLS)
thead = "".join(f"<th>{h}</th>" for h, _, _ in COLS)
rows = ""
for i in range(1, ROWS + 1):
    tds = "".join(f'<td>{"<span class=n>%d</span>" % i if k == 0 else (f"<span class=hint>{hint}</span>" if hint else "")}</td>'
                  for k, (_, _, hint) in enumerate(COLS))
    rows += f"<tr>{tds}</tr>"
checks = "".join(f'<li><i></i>{c}</li>' for c in CHECK)
html = f"""<!DOCTYPE html><html lang="ro"><head><meta charset="utf-8"><title>Jurnal de tranzacționare — Marius FX</title>
<style>
{FACES}
@page {{ size: A4 landscape; margin: 8mm 8mm 7mm; }}
* {{ box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
html, body {{ margin: 0; font-family: 'Manrope', sans-serif; color: #0f1b2d; }}
.top {{ display: flex; align-items: stretch; gap: 5mm; margin-bottom: 3.2mm; }}
.brand {{ flex: 1; background: #0b1f3a; color: #fff; border-radius: 3mm; padding: 3.2mm 5mm; display: flex; align-items: center; gap: 4mm; }}
.mark {{ width: 10mm; height: 10mm; border-radius: 2.4mm; background: rgba(34,197,94,.18); border: .3mm solid rgba(34,197,94,.6); display: grid; place-items: center; }}
.mark svg {{ width: 6.4mm; height: 6.4mm; fill: none; stroke: #22c55e; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }}
.brand .t1 {{ font-size: 7.5pt; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: #86efac; }}
.brand .t1 b {{ color: #fff; }}
.brand h1 {{ margin: .4mm 0 0; font-size: 17pt; font-weight: 800; letter-spacing: -.02em; line-height: 1.1; }}
.brand p {{ margin: .8mm 0 0; font-size: 7.6pt; color: #b9c6da; }}
.fields {{ width: 78mm; border: .3mm solid #cfd8e5; border-radius: 3mm; padding: 2.6mm 4mm; display: grid; gap: 2.3mm; align-content: center; font-size: 8pt; font-weight: 600; color: #42526b; }}
.fields div {{ display: flex; gap: 2mm; align-items: flex-end; }}
.fields span {{ flex: 1; border-bottom: .25mm solid #9fb0c7; height: 4mm; }}
.check {{ display: flex; align-items: center; gap: 4mm; border: .35mm solid #16a34a; background: #f0fdf4; border-radius: 3mm; padding: 2.2mm 4mm; margin-bottom: 3.2mm; }}
.check h2 {{ margin: 0; font-size: 8.6pt; font-weight: 800; color: #14532d; line-height: 1.2; width: 34mm; flex: none; }}
.check ul {{ list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 1.6mm 6mm; font-size: 8.2pt; font-weight: 600; color: #1f2a3c; }}
.check li {{ display: flex; align-items: center; gap: 1.8mm; }}
.check i {{ width: 3.6mm; height: 3.6mm; border: .35mm solid #16a34a; border-radius: .8mm; background: #fff; flex: none; }}
table {{ width: 100%; border-collapse: collapse; table-layout: fixed; }}
th {{ background: #0b1f3a; color: #fff; font-size: 6.6pt; font-weight: 700; line-height: 1.15; padding: 1.6mm .8mm; text-align: center; vertical-align: middle; border: .2mm solid #24395c; border-bottom: .6mm solid #16a34a; height: 10.5mm; }}
td {{ border: .2mm solid #b8c4d6; height: 9.4mm; padding: .6mm .8mm; vertical-align: bottom; text-align: center; }}
tr:nth-child(even) td {{ background: #f5f8fc; }}
td:nth-child(13), td:nth-child(15) {{ background: #eef8f1 !important; }}
.n {{ display: block; text-align: center; font-size: 7pt; font-weight: 700; color: #64748b; line-height: 8mm; }}
td:first-child {{ vertical-align: middle; }}
.hint {{ font-size: 5.6pt; color: #9aa8bc; font-weight: 600; letter-spacing: .02em; white-space: nowrap; }}
.foot {{ display: flex; justify-content: space-between; gap: 6mm; margin-top: 2.6mm; font-size: 6.8pt; color: #64748b; }}
.foot b {{ color: #0b1f3a; }}
</style></head><body>
<div class="top">
  <div class="brand">
    <div class="mark"><svg viewBox="0 0 24 24"><path d="M3 17l5-5 4 3 8-9"/><path d="M15 6h5v5"/></svg></div>
    <div><div class="t1">Marius <b>FX</b> · șablon pentru elevi</div>
      <h1>Jurnal de tranzacționare</h1>
      <p>Notează fiecare tranzacție: planul, execuția, emoțiile și lecția. Disciplina se construiește pe hârtie, nu din memorie.</p></div>
  </div>
  <div class="fields"><div>Nume:<span></span></div><div>Luna / perioada:<span></span></div><div>Cont (demo / real):<span></span></div></div>
</div>
<div class="check"><h2>Checklist înainte de a intra în tranzacție</h2><ul>{checks}</ul></div>
<table><colgroup>{colgroup}</colgroup><thead><tr>{thead}</tr></thead><tbody>{rows}</tbody></table>
<div class="foot"><span><b>Rezultat în R:</b> TP = R:R planificat · SL = −1R · BE = 0R · M = închis manual. Coloanele verzi le calculezi după închidere.</span>
<span>Conținut educațional, nu consultanță financiară. Forex și CFD-urile cu levier pot duce la pierderea rapidă a banilor. · <b>mariusfx1.github.io/marius-fx</b></span></div>
</body></html>"""
src = pathlib.Path("/workspace/forex-ms-tools/jurnal-print.html")
src.write_text(html, encoding="utf-8")
subprocess.run(["google-chrome", "--headless=new", "--no-sandbox", "--disable-gpu", "--no-pdf-header-footer",
                "--allow-file-access-from-files", f"--print-to-pdf={OUT}", src.as_uri()], check=True,
               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
print("salvat", OUT)
