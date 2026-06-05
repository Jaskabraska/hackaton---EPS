# Grid Pulse — koncept aplikace (DEMO / validace)

**Město:** Voltava City (fiktivní) · **Scénář:** zimní pracovní den, 18:00, večerní špička
**Data:** vymyšlená, ilustrativní. Typově ale odpovídají reálnému load-flow snapshotu (uzly, vedení, transformátory, toky, limity), takže ukazují, jak by aplikace fungovala nad ostrými daty z ČEPS.

Tento dokument patří ke třem souborům:

- `grid_pulse_city_demo.html` — interaktivní mockup dispečinku (mapa města + alerty + AI summary)
- `grid_state.json` — ukázkový síťový stav
- `alerts.json` — ukázkové alerty s doporučeními

---

## 1. Jak se počítá „maximální zatížení"

Zatížení vždy znamená **poměr aktuální hodnoty k limitu prvku**, vyjádřený v procentech. Sto procent = prvek je na své mezi. „Maximální zatížení" sítě je pak to nejvíc vytížené místo — protože soustava je tak silná, jak silný je její nejslabší prvek. Počítá se na třech úrovních.

### Úroveň vedení (linka)

```
zatížení_vedení [%] = I_aktuální / I_max × 100
```

`I_max` je teplotní (proudový) limit vodiče. V demu to schováváme za `loading_pct` u každého vedení. Příklad z dat: koridor **L02 (Sever↔Centrum)** veze 98 MW při kapacitě 120 MW → **82 %**. To je vysoké, ale ještě v normě.

### Úroveň transformátoru

Stejný princip, jen místo proudu se sleduje zdánlivý výkon proti jmenovitému:

```
zatížení_trafo [%] = S_aktuální / S_jmenovitý × 100
```

Příklad: **Rozvodna Centrum** má dva transformátory 63 MVA. T1 je v plánované údržbě, takže celé Centrum nese **T2 = 91 %**. To je v našem scénáři **úzké hrdlo celého města** — limitujícím prvkem není vedení, ale transformátor.

### Úroveň uzlu

Uzel sám má dva typy limitu:

1. **Napětí** musí zůstat v pásmu (v demu 0,95–1,05 p.u.). Příliš nízké = riziko kolapsu, příliš vysoké = riziko poškození. V Centru je 0,985 p.u. — OK, ale blízko spodního konce kvůli importu zdaleka.
2. **Saldo uzlu** = výroba − spotřeba v daném uzlu. Záporné = uzel si bere výkon ze sítě, kladné = dodává.

```
saldo_uzlu [MW] = Σ výroba_v_uzlu − Σ spotřeba_v_uzlu
```

### Úroveň regionu

Region je skupina uzlů. Jeho bilance:

```
bilance_regionu [MW] = výroba_regionu − spotřeba_regionu
```

V demu: **Sever** −38 MW (deficit), **Centrum** −80 MW (velký deficit), **Přístav** +10 MW (přebytek). Deficitní regiony musí dovážet přes hraniční uzly a mezir­egionální koridory.

### Úroveň napříč regiony (mezir­egionální toky)

Regiony spojují **koridory** (tie-lines). „Zatížení napříč regiony" = kolik teče po koridorech vůči součtu jejich kapacit:

```
zatížení_koridoru [%] = tok_po_koridoru / kapacita_koridoru × 100
```

Příklad: koridor Sever↔Centrum (L02) je na 82 %, koridor Přístav↔Centrum (L09) jen na 28 %. To je důležité: **mezi Centrem a Přístavem je volná kapacita**, kterou jde využít — viz výpomoc regionů níže.

### Co vlastně „limituje" (interpretace)

Aplikace nehledá jen nejvyšší číslo, ale i **typ** úzkého hrdla, protože každý se řeší jinak:

| Limitující prvek | Co to znamená | Jak se řeší |
|---|---|---|
| Vedení (teplotní) | linka veze moc proudu | přesměrování toku, redispečink, snížení odběru za vedením |
| Transformátor | málo dostupných strojů na výkon | redispečink, lokální výroba/baterie pod trafem, ukončení údržby |
| Uzel (napětí) | napětí mimo pásmo | regulace jalového výkonu, zapnutí/odstavení zdroje poblíž |
| Bilance regionu | region nemá dost vlastních zdrojů | import přes koridory, výpomoc sousedního regionu |

V našem scénáři je binding constraint **transformátor T2 (91 %)** a hned za ním **koridor L02 (82 %)**.

---

## 2. N-1 — co to v demu znamená

N-1 je pravidlo bezpečnosti: **soustava musí přežít výpadek libovolného jednoho prvku** bez přetížení zbytku. V demu to zjednodušujeme na otázku „co se stane, když vypadne ten nejdůležitější prvek".

Postup (zjednodušený):

1. Vezmi aktuální stav.
2. Pro každý klíčový prvek (vedení, koridor, transformátor) ho „odpoj" a přepočítej, kam se jeho tok přelije.
3. Pokud by některý zbylý prvek šel přes 100 %, soustava **není N-1 bezpečná**.

Příklad z dat: T1 v Centru je v údržbě → běží jen T2 (91 %). Když by vypadl i **T2**, Centrum by ztratilo napájení a automatika by musela odlehčit ~40 MW (riziko pro Datacentrum a nemocnici). Náš ukazatel proto svítí **N-1: RIZIKO**. Cílem zásahu je vrátit se do N-1 bezpečného stavu.

> V produkci se N-1 počítá pravým load-flow (pandapower: odpojit prvek → `runpp` → zkontrolovat `loading_percent`). Dataset ČEPS to umožňuje přímo. V demu výsledek jen předpočítáváme a zobrazujeme.

---

## 3. Jak si regiony vzájemně vypomáhají

Elektřina se nedá skladovat ve velkém, takže výroba musí v každém okamžiku odpovídat spotřebě. Když má jeden region nedostatek a druhý přebytek, řeší se to čtyřmi způsoby:

**Přenos po koridorech.** Přebytkový **Přístav** (+10 MW, navíc volná kapacita v Teplárně) může poslat výkon přes koridor L09 do deficitního **Centra**. To zároveň odlehčí přetížený severní koridor L02 i transformátor T2 — řešíme dvě úzká hrdla jedním krokem.

**Redispečink.** Místo dovozu zdaleka (přes T2 a sever) navýšíme levnou regulovatelnou výrobu blízko spotřeby — Teplárnu Přístav z 80 na 95 MW. Výkon pak teče kratší, méně vytíženou cestou.

**Sdílení rezerv.** Volná kapacita zdrojů v jednom regionu slouží jako záloha pro druhý. Baterie v Centru (BESS) a headroom Teplárny tvoří společný „polštář" pro celé město.

**Lokální řešení, když jsou koridory plné.** Kdyby byly koridory na limitu, výpomoc nelze dovézt a region musí krýt spotřebu sám — vlastní výrobou, baterií nebo snížením odběru (demand response). Proto aplikace hlídá zatížení koridorů: dokud je L09 na 28 %, výpomoc Přístav→Centrum je možná.

Jádro myšlenky: **deficit jednoho regionu + přebytek druhého + volná kapacita koridoru = příležitost levně a bezpečně vyřešit úzké hrdlo.** Tohle je přesně to, co AI v aplikaci hledá automaticky.

---

## 4. Návrh obrazovky aplikace (sekce a widgety)

```
┌─────────────────────────────────────────────────────────────────────┐
│ HLAVIČKA: ⚡ Grid Pulse · Voltava City   [DEMO]   KPI dlaždice ─────► │
│   Spotřeba · Výroba · Import · Max prvek % · N-1 stav · # Alertů      │
├──────────────────────────────────────────┬──────────────────────────┤
│                                          │ WORKFLOW LIŠTA            │
│   MAPA MĚSTA (dispečerské zobrazení)     │ ①Alerty→②JSON→③Analýza→④Dop│
│   • ulice, bloky domů, řeka, 3 regiony   ├──────────────────────────┤
│   • uzly sítě s ikonami podle typu       │ 🧠 AI POWERED SUMMARY     │
│   • vedení obarvená podle zatížení,      │   stav + riziko + 1-klik  │
│     animovaný směr toku                  │   doporučení + úspora Kč   │
│   • červené prstence = prvky v alertu    ├──────────────────────────┤
│   • LEGENDA (levý horní roh)             │ 🚨 ALERTY (klik = detail) │
│   • INSPEKTOR UZLU (levý dolní roh):     │   5 polí + finanční dopad │
│     zatížení, kapacita, limity, toky,    ├──────────────────────────┤
│     stav transformátorů                  │ 🛠️ DOPORUČENÍ PRO PROVOZ  │
│                                          │   redispečink/DR/baterie  │
│                                          │   + Kč u každé akce        │
│                                          ├──────────────────────────┤
│                                          │ 🌦️ PREDICTIVE INTEGRATION │
│                                          │   počasí · družice · vítr │
│                                          │   → napojení na alerty     │
└──────────────────────────────────────────┴──────────────────────────┘
```

**Rozlišení objektů na mapě** (nejen velikostí tečky — tvarem, ikonou i stavem):

- **Odběrné místo** (jen spotřeba) = tvar domu, modrá, odznak **▼** (odebírá).
- **Kritický odběr** (nemocnice, datacentrum) = dům s **+**, červená.
- **Výrobna / prosumer** (dodává) = ikona podle typu (teplárna s komíny, solár-diamant, vrtule větru, baterie), žlutá záře + odznak **▲** (dodává). Prosumer = dům se sluníčkem (spotřeba i malá výroba).
- **Rozvodna** = modrý čtverec se symbolem transformátoru.
- **Import / hraniční uzel** = fialový šestiúhelník (⇄).
- **Region** se pozná barevným prstencem kolem uzlu (Sever modrá, Centrum zelená, Přístav oranžová) — takže každý uzel nese dvě informace: *co dělá* (ikona) a *kde je* (prstenec).

U každého uzlu inspektor ukazuje **zatížení, kapacitu, limity a tok** — přesně dle zadání.

---

## 5. AI workflow (jak to funguje v demu)

```
Přijdou alerty  →  stáhne se JSON (grid_state + alerts)  →
  →  automatická analýza (pravidla + limity + predikce)  →
    →  okamžité doporučení „co udělat" + vyčíslení úspory
```

V mockupu to ukazuje horní **workflow lišta** a tlačítko „↻ analýza" v AI summary, které celý řetězec přehraje. Vstupem je strojově čitelný JSON, výstupem lidsky čitelné shrnutí a seznam akcí.

### Ukázkový AI Powered Summary (vygenerovaný nad JSONy)

> **Stav (18:00):** Voltava City kryje špičku 225 MW; lokální zdroje dávají 117 MW, zbylých 108 MW se dováží přes hraniční uzly. Úzkým hrdlem je **transformátor T2 v Rozvodně Centrum (91 %)** — T1 je v plánované údržbě, takže soustava právě **není N-1 bezpečná**.
>
> **Hlavní riziko (predikce):** Studená fronta za ~2 h zvedne spotřebu o ~8 % a současně klesne vítr (VTE Sever 22 → 9 MW). Import koridor Sever↔Centrum (L02) by přesáhl 100 %.
>
> **Doporučení (1 klik):** Odlehčit T2 lokální výrobou z jihu a připravit zálohy na frontu. Region **Přístav** má přebytek a volnou Teplárnu; přes nevytížený jižní koridor L09 (28 %) může pomoci deficitnímu **Centru**. Konkrétně: Teplárna 80 → 95 MW, vybíjení BESS 20 MW v Centru, přesměrování toku na L09, demand response v Průmyslové zóně −10 MW, dobití BESS před špičkou.
>
> **Ekonomika:** zásah ~81 000 Kč → vyhnutá ztráta ~4,9 mil. Kč → **čistá úspora ~4,82 mil. Kč/den** *(ilustrativní)*.

### Predictive data integration (fiktivně)

Aplikace přidává tři externí signály a ukazuje, jak se propisují do alertů:

- **Weather forecast** — pokles teploty na −6 °C → pravidlo „−1 °C ≈ +1,3 % spotřeby" → +8 % load → spouští alert ALR-002.
- **Satellite / cloud cover** — jasno zítra v poledne (oblačnost < 15 %) → FVE Jih najede 0 → 40 MW → riziko reverzního toku a přepětí → alert ALR-003.
- **Connect external signals to grid behavior** — korelační pravidla převádějí počasí/družici na očekávané chování sítě (load, výroba VTE/FVE) a tím na predikované zatížení prvků.

---

## 6. Data enrichment — stačí to takhle?

Pro **validaci konceptu stačí současná data** (topologie, stavy uzlů/vedení, toky, limity, forecast load/solar/wind) — pokrývají mapu, výpočet zatížení, alerty i AI shrnutí. V reálném datasetu ČEPS je navíc 8 760 hodinových snapshotů, takže jde počítat i trendy a pravý N-1.

Pro vyšší věrohodnost prototypu by minimálně pomohlo:

- **Plánované odstávky** prvků (v zadání zmíněné, ale v datech chybí) — bez nich nejde realisticky modelovat scénář „T1 v údržbě".
- **Ceny / náklady redispečinku** (částečně v `other/Fuel prices`) — pro vyčíslení úspor v Kč.
- **Geografie / reálné souřadnice** — dataset má jen schématický layout; pro „mapu města/země" by pomohly skutečné polohy uzlů.
- **Skutečný weather/satellite feed** — v demu fiktivní; pro produkci napojení na meteo API.

Závěr: pro demo „stačí takhle". Pro krok k produkci jsou klíčové **odstávky** a **ceny zásahů** — to jsou dvě data, bez kterých nejdou alerty a ekonomika postavit věrně.

---

*Veškeré číselné hodnoty v tomto konceptu jsou ilustrativní a slouží k ukázce funkce aplikace, nikoli jako reálná provozní data.*
