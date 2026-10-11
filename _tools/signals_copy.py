# signals_copy.py: „Fără semnale” -> „Educație gratuită + grup VIP privat” (RO sursă; EN/ES/PT prin i18n). Idempotent.
import sys, pathlib
V = '<span class="vip-gold">VIP</span>'
R = [
 ('calendar economic. Fără semnale.', 'calendar economic. Educație gratuită + grup VIP privat.'),
 ('Educație, fără semnale.', 'Educație gratuită + grup VIP privat.'),
 ('managementul riscului. Fără semnale.', 'managementul riscului. Educație gratuită + grup VIP privat.'),
 ('<span class="stat-label">semnale, doar educație și disciplină</span>', f'<span class="stat-label">costuri pentru educație · semnalele, în grupul {V}</span>'),
 ('Lecții și instrumente gratuite, ca să înveți un proces, nu să urmezi semnale.', f'Lecții și instrumente gratuite, ca să înveți un proces. Educație gratuită + grup {V} privat.'),
 ('Nu. MS Prime înseamnă doar educație: nu dau semnale, nu administrez conturi și nu fac consultanță de investiții personalizată. Vreau să înveți',
  'Educația de pe MS Prime este gratuită. Pentru semnale există un grup VIP privat, cu abonament lunar; ceri acces din comunitatea de Telegram. Semnalele nu sunt sfaturi de investiții, iar eu nu administrez conturi și nu fac consultanță personalizată. Chiar și cu semnale, vreau să înveți'),
 ('Acolo vorbim despre educație, disciplină și managementul riscului, nu despre semnale.', 'Acolo vorbim despre educație, disciplină și managementul riscului. Semnalele sunt doar în grupul VIP privat, cu abonament lunar.'),
 ('<p class="fineprint">Nu ofer semnale, administrare de conturi sau consultanță de investiții personalizată.</p>',
  f'<p class="fineprint">Educația de pe site e gratuită. Pentru semnale există un grup {V} privat, cu abonament lunar. Nu administrez conturi și nu ofer consultanță de investiții personalizată.</p>'),
]
for f in sys.argv[1:]:
    p = pathlib.Path(f); s = p.read_text(); n = s
    for a, b in R: n = n.replace(a, b)
    if n != s: p.write_text(n); print('updated', f)
