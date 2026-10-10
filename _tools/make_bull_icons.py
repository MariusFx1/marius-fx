# make_bull_icons.py: icoane MS Prime din taurul smarald (sursă pe negru) -> 1024 + toate mărimile
import numpy as np; from PIL import Image, ImageFilter
SRC = '/home/box/agent-data/agents/47aa51bc-c448-4da0-9232-b020e00fc79d/assets/4ec73fc165d2abe909df1217da6b6058cbd93a985db820ef28ef68baa6c88ce9.jpg'
OUT = '/workspace/forex-ms/'
a = np.asarray(Image.open(SRC).convert('RGB')).astype(float) / 255
m = a.max(2); al = np.clip((m - .04) / .5, 0, 1) ** .8
rgb = np.clip(a / np.maximum(al, 1e-3)[..., None], 0, 1)
bull = Image.fromarray((np.dstack([rgb, al]) * 255).astype('uint8'), 'RGBA')
ys, xs = np.where(al > .25); box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
bull = bull.crop(box)
def bg(n=1024):
    y, x = np.mgrid[0:n, 0:n] / n; d = np.hypot(x - .5, y - .47)
    g = np.clip(1 - d / .62, 0, 1) ** 1.8
    base = np.array([5, 7, 9]); glow = np.array([16, 70, 36])
    img = base + g[..., None] * (glow - base)
    return Image.fromarray(img.astype('uint8'), 'RGB')
def icon(frac):
    c = bg(); b = bull; s = frac * 1024 / max(b.size); b = b.resize((round(b.width * s), round(b.height * s)), Image.LANCZOS)
    c.paste(b, ((1024 - b.width) // 2, (1024 - b.height) // 2 + 10), b); return c
L = Image.LANCZOS
full = icon(.80); full.save(OUT + 'images/icon-bull-1024.png', optimize=True)
mask = icon(.62)  # diagonala ~ 0.8 din latură -> în cercul sigur (r=0.4)
full.resize((512, 512), L).save(OUT + 'icon-512.png', optimize=True)
full.resize((192, 192), L).save(OUT + 'icon-192.png', optimize=True)
full.resize((180, 180), L).save(OUT + 'apple-touch-icon.png', optimize=True)
mask.resize((512, 512), L).save(OUT + 'icon-maskable-512.png', optimize=True)
mask.resize((192, 192), L).save(OUT + 'icon-maskable-192.png', optimize=True)
# favicon: crop strâns pe capul taurului
bx, by = full.size; fav = full.crop((262, 230, 742, 710))
f = lambda n: fav.resize((n, n), L).filter(ImageFilter.UnsharpMask(1, 70, 2))
f(32).save(OUT + 'favicon.png', optimize=True); f(16).save(OUT + 'favicon-16.png', optimize=True)
f(48).save(OUT + 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
print('bull box', box, 'icon bull frac .80')
