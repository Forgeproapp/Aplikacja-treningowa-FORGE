// Forge Pro – Baza wiedzy, escapowanie HTML

const WIKI_SECTIONS = [
  {
    id: 'sylwetka',
    title: 'Jak budować sylwetkę',
    cards: [
      {
        id: 'levers',
        title: 'Od czego zależy efekt',
        thesis: 'Mięśnie rosną, kiedy dajesz im powód, materiał i czas. Wszystko inne to dodatki.',
        points: [
          'Powód to coraz trudniejszy trening. Z tygodnia na tydzień próbujesz zrobić odrobinę więcej — kilogram albo powtórzenie.',
          'Powód to też wystarczająco dużo pracy. Dla większości partii dobrze działa około 12–20 ciężkich serii w tygodniu.',
          'Materiał to jedzenie. Białko w każdym posiłku i kalorie dopasowane do celu: trochę więcej na masę, trochę mniej na redukcję.',
          'Czas to sen i luźniejsze tygodnie. Mięsień rośnie po treningu, nie w jego trakcie.',
          'Jeśli ogarniesz te cztery rzeczy, suplementy i „sekretne metody” przestaną mieć znaczenie.'
        ]
      },
      {
        id: 'rir',
        title: 'Jak ciężko trenować (RIR)',
        thesis: 'RIR to liczba powtórzeń, które jeszcze zostały ci w zapasie. RIR 2 znaczy: mógłbyś zrobić jeszcze dwa, ale kończysz.',
        points: [
          'Plan w apce zaczyna spokojnie i z każdym tygodniem przykręca śrubę. Tydzień 1 to RIR 3, tydzień 2 to RIR 2, tygodnie 3–4 to RIR 1.',
          'W tygodniu 5 idziesz na RIR 0: ostatnie powtórzenie ma być naprawdę ciężkie, ale czyste. Nie „dociągasz” go na siłę.',
          'Tydzień 6 to RIR 4 — lżejszy tydzień, żeby ciało złapało oddech. Nie testuj wtedy rekordów.',
          'Przerwy rosną razem z wysiłkiem: od 1,5 min na początku do 3 min w najcięższym tygodniu. Apka odlicza je sama.',
          'Kiedy robisz górę zakresu (np. 10 powtórzeń przy „6–10”) przy zadanym RIR, następnym razem dołóż ciężar.'
        ],
        actions: [{ label: 'Otwórz edytor', tab: 'editor' }]
      },
      {
        id: 'volume',
        title: 'Ile serii na partię',
        thesis: 'Za mało serii — stoisz w miejscu. Za dużo — nie nadążasz z regeneracją. Szukasz środka.',
        points: [
          'Liczą się tylko serie robocze, czyli te naprawdę ciężkie. Rozgrzewka się nie liczy.',
          'Około 6–8 serii tygodniowo (MV) wystarczy, żeby utrzymać to, co masz.',
          'Około 8–12 serii (MEV) to rozsądny start nowego cyklu.',
          'Około 12–20 serii (MAV) to strefa, w której większość ludzi rośnie najlepiej.',
          'Powyżej 20 (MRV) zwykle zaczyna się zmęczenie, które zjada postępy. Traktuj to jak czerwoną linię, nie cel.',
          'Rozbij te serie na 2 treningi w tygodniu. Ćwiczenie, w którym partia tylko pomaga (np. triceps przy wyciskaniu), apka liczy jako pół serii.'
        ],
        actions: [{ label: 'Otwórz objętość', tab: 'stats', subtab: 'volume' }]
      },
      {
        id: 'exercises',
        title: 'Dobór ćwiczeń: zakres, napięcie, rozciągnięcie',
        thesis: 'Dobre ćwiczenie to takie, w którym mięsień, który chcesz rozbudować, jest najsłabszym ogniwem i pracuje w pełnym rozciągnięciu.',
        points: [
          'Pełny zakres ruchu. Schodź tak nisko, jak pozwala ci staw i technika. Dolna, rozciągnięta część ruchu daje najwięcej, więc nie ucinaj jej, żeby dołożyć kilogramy.',
          'Rozciągnięcie pod ciężarem. Wybieraj warianty, które mocno rozciągają mięsień: RDL zamiast samego podnoszenia z ziemi, uginanie na ławce skośnej, wyprosty nad głową na triceps, rozpiętki i wyciskanie z głębokim zejściem, uginanie nóg siedząc.',
          'Napięcie tam, gdzie trzeba. Jeśli w wiosłowaniu pierwsze odpadają ci przedramiona albo dolny odcinek pleców, to plecy nie dostają pełnego bodźca. Szukaj wersji z podparciem, na wyciągu albo na maszynie.',
          'Stabilność. Im mniej musisz balansować, tym więcej siły idzie w mięsień. Maszyny, wyciągi i ławki z podparciem to nie „gorsze” ćwiczenia.',
          'Czucie. Po serii powinieneś czuć pracę w mięśniu docelowym, nie w stawach. Kolano, bark albo łokieć bolą? Zmień wariant.',
          'Kiedy znajdziesz dobre ćwiczenie, trzymaj je przez cały cykl. Apka porównuje wyniki po nazwie ćwiczenia, więc częsta zmiana kasuje ci historię postępu.'
        ],
        actions: [{ label: 'Otwórz edytor', tab: 'editor' }]
      },
      {
        id: 'tempo',
        title: 'Tempo pracy w serii',
        thesis: 'Nie chodzi o to, żeby ruszać się wolno. Chodzi o to, żeby cały czas kontrolować ciężar.',
        points: [
          'Opuszczanie: spokojnie, mniej więcej 2–3 sekundy. Ciężar nie spada — to ty go opuszczasz.',
          'Dół ruchu: bez odbijania. Możesz zatrzymać się na chwilę w rozciągnięciu, szczególnie na maszynach i hantlach. To zabiera pęd i zostawia pracę mięśniowi.',
          'Podnoszenie: zdecydowanie, z zamiarem ruszenia ciężaru szybko. Pod koniec serii i tak zwolni samo — to znak, że się zbliżasz do limitu.',
          'Góra ruchu: nie odpoczywaj z zablokowanymi łokciami czy kolanami przez kilka sekund, jeśli to zdejmuje napięcie. Płynnie przejdź do kolejnego powtórzenia.',
          'Bardzo wolne powtórzenia (np. 10 sekund w dół) nie budują więcej mięśni. Robisz wtedy po prostu mniej powtórzeń z mniejszym ciężarem.',
          'Trzymaj to samo tempo co tydzień. Inaczej nie wiesz, czy jesteś silniejszy, czy tylko zacząłeś bujać ciężarem.'
        ]
      },
      {
        id: 'food',
        title: 'Jedzenie bez liczenia wszystkiego',
        thesis: 'Waga łazienkowa skacze z dnia na dzień. Kierunek poznasz po talii i po tym, czy ciężary idą w górę.',
        points: [
          'Budujesz masę? Jedz trochę więcej, niż potrzebujesz. Chudniesz? Trochę mniej. Duże skoki w którąkolwiek stronę zwykle kończą się tłuszczem albo utratą siły.',
          'Białko to ok. 1,6–2,2 g na kilogram masy ciała dziennie. Najprościej: porcja białka w każdym posiłku.',
          'Talia rośnie, a ciężary stoją? Prawdopodobnie jesz za dużo. Talia spada, ale siła leci na łeb? Deficyt jest za duży.',
          'Nie oceniaj po jednym ważeniu. Patrz, co się dzieje przez 2–3 tygodnie.'
        ],
        actions: [{ label: 'Otwórz pomiary', tab: 'stats', subtab: 'body' }]
      },
      {
        id: 'deload',
        title: 'Kiedy zwolnić',
        thesis: 'Lżejszy tydzień to nie strata czasu. To moment, w którym zmęczenie opada i widać, co zbudowałeś.',
        points: [
          'W tygodniu 6 robisz te same ćwiczenia, tylko lżej (RIR 4). Ciało dostaje czas na naprawę.',
          'Jeśli przez dwa tygodnie z rzędu wyniki spadają, a śpisz normalnie, nie dokładaj serii. Zabierz kilka — wróć bliżej 8–12 w tygodniu.',
          'Ból stawu, słaby sen i brak chęci do treningu to sygnały, żeby odpuścić, zanim coś się zepsuje.',
          'Po skończonym cyklu zresetuj postęp planu i zacznij od tygodnia 1 z nieco większymi ciężarami. Historia i pomiary zostają.'
        ],
        actions: [{ label: 'Otwórz trening', tab: 'home' }]
      }
    ]
  },
  {
    id: 'apka',
    title: 'Jak poruszać się po apce',
    cards: [
      {
        id: 'map',
        title: 'Gdzie co jest',
        thesis: 'Wszystko jest pod pięcioma przyciskami na dole ekranu.',
        points: [
          'Trening (duży przycisk na środku) — tu zaczynasz każdy trening.',
          'Edytor — tu układasz i zmieniasz swój plan.',
          'Wiki — to, co właśnie czytasz.',
          'Statystyki — ile serii robisz na każdą partię, jak rośnie siła i jak zmienia się sylwetka.',
          'Historia — lista wszystkich zakończonych treningów.',
          'Na górze możesz zainstalować apkę na telefonie i zalogować się przez Google, żeby dane synchronizowały się między urządzeniami.'
        ]
      },
      {
        id: 'session',
        title: 'Jak zrobić trening',
        thesis: 'Wybierasz dzień, wpisujesz ciężar i powtórzenia, odhaczasz serię. Resztę apka robi za ciebie.',
        points: [
          'Na górze ekranu Trening wybierasz tydzień (TYG 1, TYG 2…), a potem dzień, który chcesz zrobić.',
          'Przy każdym ćwiczeniu widzisz, co zrobiłeś ostatnio. Spróbuj to pobić choćby o jedno powtórzenie.',
          'Wpisz ciężar w pierwszej serii — apka sama przepisze go do kolejnych. Zmieniasz tylko wtedy, gdy trzeba.',
          'Kliknięcie w kółko po prawej odhacza serię i włącza licznik przerwy. Możesz go zminimalizować i dalej korzystać z apki.',
          'Po ostatniej serii kliknij „Zakończ trening”. W oknie na końcu możesz dopisać notatkę. Gdy skończysz cały tydzień, apka sama przejdzie do następnego.'
        ],
        actions: [{ label: 'Otwórz trening', tab: 'home' }]
      },
      {
        id: 'editor',
        title: 'Jak ułożyć plan',
        thesis: 'W edytorze budujesz plan raz, a potem tylko go dopracowujesz.',
        points: [
          'Na górze tworzysz nowy plan, kopiujesz obecny albo zmieniasz jego nazwę. Nowy plan możesz zacząć od gotowego szablonu albo od zera.',
          'Biblioteka ćwiczeń i biblioteka treningów trzymają twoje ulubione ruchy i całe dni, żeby nie wpisywać ich za każdym razem.',
          'Ustaw, ile tygodni trwa cykl, a dla każdego tygodnia — jak ciężko trenujesz (RIR) i ile odpoczywasz.',
          'Liczbę serii możesz zmieniać tydzień po tygodniu. Jeśli chcesz, skopiuj tydzień 1 do wszystkich pozostałych jednym kliknięciem.',
          'Ćwiczenia i dni przesuwasz, przeciągając je palcem. Na dole widzisz, ile serii tygodniowo dostanie każda partia.',
          'Planem podzielisz się linkiem. Historia treningów leci sama do arkusza Google na twoim koncie — link do arkusza oddajesz, kiedy chcesz pokazać raport.'
        ],
        actions: [{ label: 'Otwórz edytor', tab: 'editor' }]
      },
      {
        id: 'stats',
        title: 'Jak czytać statystyki',
        thesis: 'Trzy pytania: czy robię dość serii, czy jestem silniejszy i czy zmienia się sylwetka.',
        points: [
          'Słupki pokazują, ile ciężkich serii zrobiłeś w tym tygodniu na każdą partię. Kolor mówi, czy to za mało, w sam raz, czy już za dużo.',
          'Wykres pokazuje szacowany maks na jedno powtórzenie, wyliczony z twoich serii. Nie musisz go dźwigać — ważne, żeby linia szła w górę.',
          'W zakładce „Waga & Pomiary” zapisujesz wagę i obwody: talię, klatkę, ramię, udo i łydkę. Mierz się raz na tydzień lub dwa, o tej samej porze.'
        ],
        actions: [
          { label: 'Otwórz objętość', tab: 'stats', subtab: 'volume' },
          { label: 'Otwórz pomiary', tab: 'stats', subtab: 'body' }
        ]
      },
      {
        id: 'history',
        title: 'Historia treningów',
        thesis: 'Każdy skończony trening zostaje tu na zawsze — nawet jeśli zaczniesz plan od nowa.',
        points: [
          'Widzisz datę, nazwę planu i łączny tonaż, czyli sumę ciężar × powtórzenia ze wszystkich serii.',
          'Kliknij trening, żeby zobaczyć każdą serię i dopisać notatkę. Notatka ląduje w arkuszu Google razem z treningiem.',
          'Reset planu nie usuwa historii, a usunięcie historii nie zmienia planu.'
        ],
        actions: [{ label: 'Otwórz historię', tab: 'history' }]
      }
    ]
  }
];

let wikiRendered = false;

function escapeHtml(value){
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeJsAttr(value){
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, '\\\'')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '\\u003c');
}

function escapeWikiText(value){
  return escapeHtml(value);
}

function renderWiki(){
  if(wikiRendered) return;
  const root = document.getElementById('wikiContent');
  if(!root) return;

  let html = `<p class="wiki-lead">Najkrótsza baza kuźni: co naprawdę buduje sylwetkę i gdzie to kliknąć w aplikacji.</p>`;
  WIKI_SECTIONS.forEach(section => {
    html += `<div class="wiki-group-title">${escapeWikiText(section.title)}</div>`;
    section.cards.forEach((card, index) => {
      const open = index === 0 ? ' open' : '';
      const points = (card.points || []).map(point => `<li>${escapeWikiText(point)}</li>`).join('');
      const actions = (card.actions || []).map(action => {
        const subtab = action.subtab ? `, '${escapeWikiText(action.subtab)}'` : '';
        return `<button type="button" class="wiki-open-btn" onclick="openWikiTarget('${escapeWikiText(action.tab)}'${subtab})">${escapeWikiText(action.label)}</button>`;
      }).join('');
      const actionsHtml = actions ? `<div class="wiki-actions">${actions}</div>` : '';
      html += `<article class="wiki-card${open}" id="wiki-card-${escapeWikiText(card.id)}">
        <button type="button" class="wiki-card-head" onclick="toggleWikiCard('${escapeWikiText(card.id)}')" aria-expanded="${index === 0 ? 'true' : 'false'}">
          <span>${escapeWikiText(card.title)}</span>
          <span class="wiki-chevron" aria-hidden="true">›</span>
        </button>
        <div class="wiki-card-body">
          <p class="wiki-thesis">${escapeWikiText(card.thesis)}</p>
          <ul class="wiki-points">${points}</ul>
          ${actionsHtml}
        </div>
      </article>`;
    });
  });

  root.innerHTML = html;
  wikiRendered = true;
}

function toggleWikiCard(cardId){
  const card = document.getElementById('wiki-card-' + cardId);
  if(!card) return;
  const open = card.classList.toggle('open');
  const head = card.querySelector('.wiki-card-head');
  if(head) head.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function openWikiTarget(tab, subtab){
  switchTab(tab);
  if(tab === 'stats' && subtab) switchStatsSubtab(subtab);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
