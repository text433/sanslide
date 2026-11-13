# Sānslīde — Hot Slide stila HTML5 drifta spēles prompts

Šo tekstu izmanto kā galveno promptu, kad turpini būvēt vai pārtaisi spēli. Tas apraksta, kas spēlei jābūt, kādā stilā un ar kādiem tehniskiem noteikumiem.

## Loma

Tu esi spēļu izstrādātājs un tehniskais mākslinieks. Tu būvē mobilajam pārlūkam domātu 3D drifta sacīkšu spēli vienā HTML failā. Raksti pilnu, strādājošu kodu, nevis skices. Visi teksti spēlē ir latviešu valodā.

## Atsauce: kas ir Hot Slide

Hot Slide (Tapcheer, iOS un Android) ir arkādes drifta sacīkšu spēle ar 1 pret 1 dueļiem. No tās ņemam žanru un sajūtu, nevis saturu:

- Portreta ekrāns, spēlē ar vienu pirkstu. Gāze ir automātiska, spēlētājs tikai stūrē.
- Īsas sacīkstes pa līkumotu ceļu, kur drifts ir galvenā prasme.
- Augsta kamera aiz mašīnas, ceļš iet uz ekrāna augšu.
- Stilizēta low-poly grafika: plakanas šķautnes, tīras krāsas, biezi balti dūmu gabali, riepu pēdas.
- Tematiskas trases (sniegs, kanjons, ķiršu ziedi), laikapstākļi, paātrinājuma laukumi.
- Mašīnu klases ar atšķirīgu fiziku: ielas, muskuļu, bezceļa, super.
- Progress: monētas, jaunas mašīnas, līgas.

Nekopē oriģināla nosaukumu, logo, ekrānu izkārtojumu, reālu automašīnu markas un modeļus. Spēlei ir savs nosaukums (Sānslīde), savas mašīnas un sava UI valoda.

## Spēles kodols

1. Izvēlne: trases izvēle, garāža, poga BRAUKT.
2. Atskaite 3, 2, 1, AIZIET.
3. Duelis no starta līdz finišam (apmēram 1 km, 30 līdz 45 sekundes) pret datora pretinieku.
4. Rezultāti: uzvara vai zaudējums, laiks, drifta punkti, monētas, kausi, līgas progress.

Pretinieks ir dators. Nekur nesaki, ka tie ir īsti spēlētāji.

## Vadība un fizika

- Velkot pirkstu pa kreisi un pa labi jebkur ekrānā, parādās peldoša svira. Uz datora strādā bultiņas un A/D.
- Mašīnas stāvoklis: pozīcija, virziens, ātrums un sānslīdes leņķis (ātruma virziens pret mašīnas virzienu). Stūrēšana griež mašīnu, saķere pamazām pievelk ātruma virzienu.
- Stipri iestūrējot lielā ātrumā, saķere krīt un sākas drifts. Drifts nedaudz bremzē, bet uzlādē nitro trīs līmeņos. Kad drifts beidzas, nitro izšaujas pats.
- Ārpus asfalta mašīna brauc lēnāk, barjera aptur un atņem drifta lādiņu.
- Fizika rēķinās ar fiksētu soli 120 Hz, atdalīta no zīmēšanas.
- Pretinieks brauc pa trases līniju ar ātruma profilu pēc līkuma rādiusa. Grūtība aug ar kausiem. Ja spēlētājs atpaliek, pretinieks nedaudz piebremzē, ja aizbēg, nedaudz piespiež.

## Vizuālais stils

- Tikai procedurāla ģeometrija, bez ārējiem attēliem un modeļiem. Plakanas šķautnes, krāsa katram trīsstūrim, viens kopīgs materiāls.
- Reljefs kā režģis ar augstumu pēc attāluma līdz ceļam: plakana josla pie ceļa, tālāk kalni.
- Ceļš: tumšs asfalts, baltas malu līnijas, dzeltena pārtraukta viduslīnija, sarkanbaltas apmales līkumos, barjeras abās pusēs, dzeltenas bultu zīmes asos līkumos, starta un finiša arkas.
- Mašīnas būvē no šķērsgriezumu stacijām: korpuss, kabīne ar stikliem, spoileri, lukturi, joslas. Katrai klasei savs siluets.
- Efekti ir piesaistīti notikumiem: dūmi un riepu pēdas driftā (krāsa mainās ar nitro līmeni), zilas liesmas un ātruma līnijas nitro laikā, dzirksteles un ekrāna trieciens pie barjeras.
- Viena virziena gaisma ar ēnām un debess gaisma. Migla debess krāsā.
- Tēmas: sniegs (balts, zili pelēks, egles ar sniegu), kanjons (oranžs, terases, kaktusi), ķiršu kalni (zaļš, rozā koki, ziedlapiņas).

## UI un HUD

- Motīvs: slīpas sacīkšu plāksnes. Krāsas: asfalts #1d1924, karsti oranžs #ff4d1f, saules dzeltens #ffcf33, ledus zils #6fe3ff nitro signāliem, papīra balts #fff4e6.
- Virsraksti: Kanit 900 slīprakstā. Pārējais: Barlow Semi Condensed.
- HUD augšā: progresa josla ar abiem braucējiem, vieta un atstarpe metros, laiks, pauze. Apakšā: ātrums un nitro mērītājs ar trim segmentiem. Vidū tikai īsi paziņojumi.
- Skārienpogas vismaz 44 px, ievēro drošās zonas, teksts nedrīkst lēkāt, mainoties skaitļiem.

## Tehniskie noteikumi

- Viens HTML fails ar iekļautu CSS un JavaScript. Three.js r128 no cdnjs, fonti no Google Fonts.
- Mērķis ir telefons: līdz 150 zīmēšanas izsaukumiem un 300 tūkstošiem trīsstūru, instancēti rekvizīti, pikseļu attiecība ne vairāk par 2. Ja kadri krīt, spēle pati samazina izšķirtspēju un izslēdz ēnas.
- Skaņa sintezēta ar WebAudio un ieslēdzas tikai pēc pieskāriena.
- Progress glabājas localStorage ar try/catch. Spēlei jāstrādā arī bez krātuves.
- Pauze, kad cilne paslēpta. Ievēro prefers-reduced-motion.

## Pārbaude pirms nodošanas

- Bots nobrauc katru trasi ar katru mašīnu bez iestrēgšanas, un tā laiks ir salīdzināms ar pretinieka laiku.
- Konsolē nav kļūdu. Ekrānuzņēmumi 390 × 844 un platekrānā: izvēlne, garāža, atskaite, brauciens, rezultāti.
- HUD neaizsedz mašīnu un nākamo līkumu.
