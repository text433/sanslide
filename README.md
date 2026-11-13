# Sānslīde

Low-poly drifta dueļu spēle pārlūkam (HTML5 + Three.js), veidota Hot Slide žanra stilā: portreta ekrāns, viena pirksta stūrēšana, automātiska gāze, drifts uzlādē nitro.

## Kā palaist

Atver `dist/index.html` pārlūkā (vajag internetu, jo Three.js un fonti nāk no CDN).

## Uzbūve

- `src/sim.js` — trases, mašīnas fizika, pretinieks, sacīkste (bez DOM, testējams ar Node)
- `src/gfx.js` — procedurālā low-poly pasaule, mašīnu modeļi, dūmi, riepu pēdas
- `src/main.js` — spēles cilpa, kamera, ievade, skaņa, HUD, izvēlnes, progress
- `src/index.template.html` — HTML un CSS
- `build.js` — saliek visu vienā `dist/index.html`
- `prompts.md` — spēles galvenais prompts (stils, mehānikas, tehniskie noteikumi)

## Komandas

```
npm install        # three.js lokāliem testiem
npm run build      # dist/index.html
npm test           # trases ģeometrija un bota braucieni (līdzsvars)
npm run test:browser   # pilna plūsma bezgalvas Chrome (vajag playwright)
```

## Saturs

Trīs trases (Sniega pāreja, Kanjona šoseja, Ķiršu serpentīns), četras mašīnu klases (Vējš, Pērkons, Lācis, Zibens), monētas, kausi un piecas līgas. Pretiniekus vada dators.
