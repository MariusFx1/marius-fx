# Utilitar: aplică înlocuiri exacte într-un fișier JS (fiecare trebuie să apară exact de n ori).
import sys, json
def apply(path, pairs):
    s = open(path, encoding='utf-8').read()
    for p in pairs:
        a, b = p[0], p[1]; n = p[2] if len(p) > 2 else 1
        c = s.count(a)
        if c != n: raise SystemExit(f'{path}: expected {n}x, found {c}x: {a[:90]!r}')
        s = s.replace(a, b)
    open(path, 'w', encoding='utf-8').write(s)
    print(path, 'ok', len(pairs))
