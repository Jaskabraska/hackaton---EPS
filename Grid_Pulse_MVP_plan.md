# Grid Pulse — MVP plán (max hodnota / min čas)

Cíl: za hackathonový čas postavit to, co dá nejvíc dojmu a je obhajitelné. Princip: **LLM nepočítá fyziku — jen vybírá nástroj a vysvětluje. Čísla dělá pandapower.**

## Minimální stack (jen 5 dílů)

| Díl | Nástroj | K čemu |
|---|---|---|
| Fyzika | **pandapower** | zatížení, N-1 (jádro důvěry) |
| Historie | **DuckDB** nad Parquet | rychlé dotazy do roku dat |
| Analogie | **FAISS** (feature vektory hodin) | „loni stejná situace → stalo se tohle" |
| Mozek | **LLM přes API** (Claude/GPT) + tool-calling | dotaz → nástroj → odpověď |
| Tvář | **HTML mapa** (už hotová) + alerty | vizuál pro porotu |

Backend = jeden **FastAPI** soubor. Glosář zkratek = **JSON do promptu**. Žádný trénink modelu.

## Co postavit (pořadí podle efekt/námaha)

1. **pandapower: stav + N-1** — načti snapshot, spočti zatížení, odpoj prvek, přepočti. ⭐ jádro
2. **Alerty na prahy** → napoj na mapu (loading > X %, napětí mimo pásmo). ⭐ vizuál
3. **LLM orchestrátor** — dotaz dispečera → vybere nástroj → odpoví. Glosář v promptu.
4. **Analogová predikce z historie** — FAISS najde podobné hodiny, ukáže „co se stalo za 15 min". ⭐ diferenciátor
5. **Shift summary (12 h)** — LLM shrne alerty + události za směnu. Rychlá nadstavba.

## Tři režimy běhu

- **Offline (předpočítej jednou):** feature vektory + FAISS index + agregace historie. Tady zpracuj 8 760 snapshotů jednou.
- **Online (odpovídá):** FastAPI + LLM + nástroje. Lokálně.
- **Scheduled:** sken alertů + shift summary v časech předání směny.

## Tvůj trumf: analogová predikce (levná, bez tréninku)

Každou hodinu roku popiš vektorem (spotřeba, mix výroby, počasí, zatížení klíčových vedení, čas/sezóna) → zaindexuj do FAISS. Pro aktuální stav najdi **k nejbližších minulých hodin** a podívej se, **co se stalo v jejich příští 15 min / 1 h**. Predikce typu „v 80 % podobných případů se za 15 min přetížilo L02". Vysvětlitelné (ukážeš ty konkrétní dny), porota to ocení.

## Co teď VYNECHAT (časožrouti, malý zisk)

- Vlastní/fine-tunovaný doménový LLM — nepotřeba, obecný LLM + pandapower stačí.
- RAG nad strukturovanými daty — větve/uzly řeš přímým dotazem do grafu, ne vektory. RAG jen kdyby zbyl čas (na texty/postupy).
- Reálná meteo API, MCP servery navíc, intraday forecast — „nice to have", až po MVP.
- Produkční nasazení, auth, škálování — je to demo.

## Demo příběh pro porotu (1 scénář, dotažený)

Zimní špička → alert „transformátor 91 %, N-1 riziko" → dispečer schválí analýzu → agent přes pandapower spočítá N-1 + z historie najde, co se dělo posledně → AI doporučí konkrétní akci (redispečink z přebytkového regionu) **podloženou daty a vyčíslenou v Kč** → na konci směny shrnutí pro kolegu.

> Jeden silný scénář od začátku do konce > pět polovičatých funkcí.
