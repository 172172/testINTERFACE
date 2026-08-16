#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from copy import deepcopy
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
VERIFIED = "2026-08-16"

PARTIES = [
    {"id": "s", "name": "Socialdemokraterna", "short": "S", "comparisonGroup": "core", "sortOrder": 1},
    {"id": "m", "name": "Moderaterna", "short": "M", "comparisonGroup": "core", "sortOrder": 2},
    {"id": "sd", "name": "Sverigedemokraterna", "short": "SD", "comparisonGroup": "core", "sortOrder": 3},
    {"id": "v", "name": "Vänsterpartiet", "short": "V", "comparisonGroup": "core", "sortOrder": 4},
    {"id": "c", "name": "Centerpartiet", "short": "C", "comparisonGroup": "core", "sortOrder": 5},
    {"id": "kd", "name": "Kristdemokraterna", "short": "KD", "comparisonGroup": "core", "sortOrder": 6},
    {"id": "l", "name": "Liberalerna", "short": "L", "comparisonGroup": "core", "sortOrder": 7},
    {"id": "mp", "name": "Miljöpartiet", "short": "MP", "comparisonGroup": "core", "sortOrder": 8},
    {"id": "op", "name": "Örebropartiet", "short": "ÖP", "comparisonGroup": "provisional", "sortOrder": 9},
]

PARTY_URLS = {
    "s": "https://valkompass.svt.se/2026/parti/socialdemokraterna/",
    "m": "https://valkompass.svt.se/2026/parti/moderaterna/",
    "sd": "https://valkompass.svt.se/2026/parti/sverigedemokraterna/",
    "v": "https://valkompass.svt.se/2026/parti/vansterpartiet/",
    "c": "https://valkompass.svt.se/2026/parti/centerpartiet/",
    "kd": "https://valkompass.svt.se/2026/parti/kristdemokraterna/",
    "l": "https://valkompass.svt.se/2026/parti/liberalerna/",
    "mp": "https://valkompass.svt.se/2026/parti/miljopartiet/",
}

SOURCE_PROMPTS = [
    "Barn från 13 år som begår grova brott ska kunna dömas till fängelse",
    "Vinstdrivande aktiebolag ska inte få driva skolor",
    "Bygg hyresrätter i villaområden för att minska segregationen",
    "Skillnaden i inkomst mellan de som arbetar och de som får bidrag ska öka",
    "Det ska bli enklare att starta gruvor och annan industri i områden där rennäring bedrivs",
    "Sverige ska ha mer ambitiösa klimatmål än övriga EU",
    "Permanenta uppehållstillstånd ska rivas upp och ersättas med tillfälliga",
    "Sverige ska på sikt lämna Nato",
    "Public service ska ha ett smalare uppdrag och mindre resurser",
    "Karensavdraget vid sjukdom ska avskaffas",
    "Betyg i ordning och uppförande ska införas i skolan",
    "Pensionsåldern ska inte höjas",
    "Tillåt försäljning av starköl och vin i livsmedelsbutiker",
    "Staten ska investera mer pengar i gröna industriprojekt",
    "Sverige bör införa euro som valuta",
    "Sverige ska öka det internationella biståndet",
    "Marknadshyror ska införas på nya hyresrätter",
    "Skolan ska ta större ansvar för undervisning om HBTQI-frågor",
    "Det ska vara möjligt att dra tillbaka medborgarskap för gängkriminella",
    "Lagstifta om kortare veckoarbetstid",
    "Skatten på bensin och diesel ska sänkas",
    "Sverige ska verka för att fler länder erkänner Palestina som stat",
    "Det offentliga stödet till kulturverksamheter ska minska",
    "Tandvård för personer under 23 år ska vara gratis",
    "Grova sexuella övergrepp mot barn ska kunna leda till livstids fängelse",
    "Den tillfälligt sänkta momsen på mat ska vara kvar",
    "Staten ska ge ekonomiskt stöd till byggandet av nya kärnkraftverk",
    "Kommunerna ska inte längre kunna stoppa ny vindkraft",
    "Staten ska ta över ansvaret för sjukvården",
    "Staten bör ge ekonomiskt stöd för att bygga fler billiga hyresrätter",
    "Pappamånaderna i föräldraförsäkringen ska tas bort",
    "Hur nära ekonomiskt och militärt samarbete ska Sverige ha med USA?",
    "Hur mycket ska höginkomsttagare betala i skatt?",
    "Hur öppet ska Sverige vara för att ta emot asylsökande?",
    "Hur mycket av skogen i Sverige ska skyddas från avverkning?",
]

# The 35 live statements are independent, neutral Swedish paraphrases of the
# corresponding source items. Their subject, direction and scope are preserved.
# The source page is linked for every party-position so the mapping can be audited.
ACTIVE_QUESTIONS: list[dict[str, Any]] = [
    {
        "id": "q001", "area": "Brott och rättsväsende",
        "text": "Barn som har fyllt 13 år och begår grova brott bör kunna dömas till fängelse.",
        "scope": "Avser om fängelse ska finnas som straffrättslig påföljd redan från 13 års ålder vid grova brott, inte placering enligt sociallagstiftning.",
    },
    {
        "id": "q002", "area": "Skola",
        "text": "Vinstdrivande aktiebolag bör förbjudas att driva skolor.",
        "scope": "Avser ett förbud kopplat till bolagsformen och möjligheten att dela ut vinst, inte ett förbud mot alla fristående eller idéburna skolor.",
    },
    {
        "id": "q003", "area": "Bostäder",
        "text": "Hyresrätter bör byggas i områden som i dag domineras av villor för att minska boendesegregationen.",
        "scope": "Avser att blanda upplåtelseformer i befintliga villaområden som ett verktyg mot segregation.",
    },
    {
        "id": "q004", "area": "Ekonomi och skatter",
        "text": "Det ekonomiska avståndet mellan att arbeta och att leva på bidrag bör bli större.",
        "scope": "Avser utfallet i disponibel inkomst. Påståendet bestämmer inte om skillnaden ska skapas genom högre arbetsinkomster, lägre skatt, bidragstak eller lägre ersättningar.",
    },
    {
        "id": "q005", "area": "Företagande och industri",
        "text": "Det bör bli enklare att starta gruvor och annan industri även i områden där rennäring bedrivs.",
        "scope": "Avser lättare etablering eller tillståndsgivning när industriella intressen möter rennäringens markanvändning.",
    },
    {
        "id": "q006", "area": "Klimat och miljö",
        "text": "Sveriges klimatmål bör vara mer ambitiösa än EU:s gemensamma mål.",
        "scope": "Avser om Sverige ska gå längre eller snabbare än den gemensamma EU-nivån, inte om Sverige ska följa EU:s beslutade krav.",
    },
    {
        "id": "q007", "area": "Migration och integration",
        "text": "Redan beviljade permanenta uppehållstillstånd bör ersättas med tidsbegränsade tillstånd.",
        "scope": "Avser en generell omvandling av befintliga permanenta tillstånd, inte bara återkallelse efter brott, fusk eller individuellt ändrade omständigheter.",
    },
    {
        "id": "q008", "area": "Försvar och säkerhet",
        "text": "Sverige bör lämna Nato på längre sikt.",
        "scope": "Avser ett framtida svenskt utträde ur Nato, inte kritik mot enskilda Nato-beslut eller villkor för samarbetet.",
    },
    {
        "id": "q009", "area": "Demokrati, medier och kultur",
        "text": "Public service bör få ett mer begränsat uppdrag och mindre finansiering.",
        "scope": "Båda delarna ingår: ett smalare innehållsuppdrag och lägre resurser än i dag.",
    },
    {
        "id": "q010", "area": "Arbetsmarknad och socialförsäkring",
        "text": "Karensavdraget vid sjukfrånvaro bör tas bort.",
        "scope": "Avser att anställda inte ska förlora ersättning genom dagens karensavdrag när en sjukperiod börjar.",
    },
    {
        "id": "q011", "area": "Skola",
        "text": "Skolan bör införa betyg för elevers ordning och uppförande.",
        "scope": "Avser en särskild formell bedömning av beteende, utöver kunskapsbetygen.",
    },
    {
        "id": "q012", "area": "Familj och socialpolitik",
        "text": "Pensionsåldern bör inte höjas ytterligare.",
        "scope": "Avser den generella pensionsålderns fortsatta utveckling, inte särskilda möjligheter till tidigare pension för vissa yrken eller individer.",
    },
    {
        "id": "q013", "area": "Sjukvård och folkhälsa",
        "text": "Vin och starköl bör få säljas i vanliga livsmedelsbutiker.",
        "scope": "Avser att bryta Systembolagets detaljhandelsmonopol för vin och starköl.",
    },
    {
        "id": "q014", "area": "Företagande och industri",
        "text": "Staten bör öka sina investeringar i gröna industriprojekt.",
        "scope": "Avser mer statligt kapital, stöd eller risktagande i industriprojekt som motiveras av klimatomställningen.",
    },
    {
        "id": "q015", "area": "EU och utrikespolitik",
        "text": "Sverige bör byta valuta från kronan till euron.",
        "scope": "Avser ett svenskt införande av euron, inte enbart en ny utredning eller framtida omprövning utan ställningstagande.",
    },
    {
        "id": "q016", "area": "EU och utrikespolitik",
        "text": "Sveriges internationella bistånd bör öka.",
        "scope": "Avser den sammanlagda svenska biståndsnivån, inte endast omfördelningar mellan mottagarländer eller ändamål.",
    },
    {
        "id": "q017", "area": "Bostäder",
        "text": "Nya hyresrätter bör få fri eller marknadsbaserad hyressättning.",
        "scope": "Avser nyproducerade hyresrätter. Befintliga hyreskontrakt och hyror ingår inte i påståendet.",
    },
    {
        "id": "q018", "area": "Skola",
        "text": "Skolan bör ta ett större ansvar för undervisning om HBTQI-frågor.",
        "scope": "Avser skolans undervisningsuppdrag och kunskapsinnehåll, inte särskilda regler för enskilda elevers identitet.",
    },
    {
        "id": "q019", "area": "Brott och rättsväsende",
        "text": "Gängkriminella bör kunna få sitt svenska medborgarskap återkallat.",
        "scope": "Avser möjlighet till återkallelse på grund av gängrelaterad grov kriminalitet. Konstitutionella villkor, exempelvis förbud mot statslöshet, kan begränsa vilka personer som omfattas.",
    },
    {
        "id": "q020", "area": "Arbetsmarknad och socialförsäkring",
        "text": "Den normala heltidsveckan bör kortas genom lagstiftning.",
        "scope": "Avser en lagstadgad generell arbetstidsförkortning, inte enbart kollektivavtal eller lokala försök.",
    },
    {
        "id": "q021", "area": "Energi och transporter",
        "text": "Bensin och diesel bör beskattas lägre än i dag.",
        "scope": "Avser lägre skatt på fossila drivmedel. Andra åtgärder som pressar pumppriset utan skattesänkning räknas inte automatiskt som stöd.",
    },
    {
        "id": "q022", "area": "EU och utrikespolitik",
        "text": "Sverige bör arbeta för att fler länder erkänner Palestina som stat.",
        "scope": "Avser aktiv svensk diplomati för fler erkännanden, inte enbart Sveriges eget redan gjorda erkännande.",
    },
    {
        "id": "q023", "area": "Demokrati, medier och kultur",
        "text": "Det offentliga ekonomiska stödet till kulturverksamhet bör minska.",
        "scope": "Avser den samlade offentliga finansieringen av kultur, inte om stödet ska omfördelas mellan olika kulturformer.",
    },
    {
        "id": "q024", "area": "Sjukvård och folkhälsa",
        "text": "Tandvård bör vara avgiftsfri för alla som ännu inte fyllt 23 år.",
        "scope": "Avser generell avgiftsfri tandvård till och med 22 års ålder, inte endast förstärkt tandvårdsbidrag.",
    },
    {
        "id": "q025", "area": "Brott och rättsväsende",
        "text": "Livstids fängelse bör finnas i straffskalan för grova sexuella övergrepp mot barn.",
        "scope": "Avser att den strängaste påföljden ska kunna användas i de grövsta fallen, inte att alla sådana brott automatiskt ska ge livstid.",
    },
    {
        "id": "q026", "area": "Ekonomi och skatter",
        "text": "Den tillfälligt sänkta momsen på mat bör behållas även efter den beslutade perioden.",
        "scope": "Avser en förlängning när den nu beslutade perioden löper ut, inte att momsnivån aldrig får ändras i framtiden.",
    },
    {
        "id": "q027", "area": "Energi och transporter",
        "text": "Staten bör ge ekonomiskt stöd till byggandet av nya kärnkraftsreaktorer.",
        "scope": "Avser statligt ekonomiskt stöd eller risktagande för ny kärnkraft, inte endast ändrade tillståndsregler.",
    },
    {
        "id": "q028", "area": "Energi och transporter",
        "text": "Kommuner bör inte längre kunna stoppa planerade vindkraftsetableringar.",
        "scope": "Avser att avskaffa kommunernas särskilda möjlighet att säga nej till ny vindkraft.",
    },
    {
        "id": "q029", "area": "Sjukvård och folkhälsa",
        "text": "Huvudansvaret för sjukvården bör flyttas från regionerna till staten.",
        "scope": "Avser ett statligt huvudmannaskap, inte enbart mer statlig finansiering, tillsyn eller nationell samordning.",
    },
    {
        "id": "q030", "area": "Bostäder",
        "text": "Staten bör ge ekonomiskt stöd till byggandet av fler hyresrätter med låga hyror.",
        "scope": "Avser riktat statligt byggstöd kopplat till lägre hyror, inte enbart generella regelförenklingar för bostadsbyggande.",
    },
    {
        "id": "q031", "area": "Familj och socialpolitik",
        "text": "De reserverade månaderna för pappor i föräldraförsäkringen bör avskaffas.",
        "scope": "Avser att ta bort de dagar som inte kan överlåtas från pappan till den andra föräldern.",
    },
    {
        "id": "q032", "area": "Försvar och säkerhet",
        "text": "Sverige bör ha ett närmare ekonomiskt och militärt samarbete med USA än i dag.",
        "scope": "Avser riktningen jämfört med dagens samarbetsnivå. Frågan säger inte vilken särskild överenskommelse som ska ändras.",
        "sourceQuestionType": "directional-slider",
        "sourceTransformation": "Källans femgradiga mer–mindre-skala har kodats från −2 till +2 med dagens nivå som 0.",
    },
    {
        "id": "q033", "area": "Ekonomi och skatter",
        "text": "Personer med höga inkomster bör betala mer skatt än de gör i dag.",
        "scope": "Avser den samlade skatten för höginkomsttagare jämfört med dagens nivå, utan att låsa vilket skatteinstrument som används.",
        "sourceQuestionType": "directional-slider",
        "sourceTransformation": "Källans femgradiga mer–mindre-skala har kodats från −2 till +2 med dagens nivå som 0.",
    },
    {
        "id": "q034", "area": "Migration och integration",
        "text": "Sverige bör vara mer öppet än i dag för att ta emot asylsökande.",
        "scope": "Avser riktningen för det svenska asylmottagandet jämfört med dagens nivå.",
        "sourceQuestionType": "directional-slider",
        "sourceTransformation": "Källans femgradiga mer–mindre-skala har kodats från −2 till +2 med dagens nivå som 0.",
    },
    {
        "id": "q035", "area": "Klimat och miljö",
        "text": "En större andel av Sveriges skog bör skyddas mot avverkning än i dag.",
        "scope": "Avser andelen skyddad skog jämfört med dagens nivå, inte hur skyddet fördelas mellan formella reservat och frivilliga avsättningar.",
        "sourceQuestionType": "directional-slider",
        "sourceTransformation": "Källans femgradiga mer–mindre-skala har kodats från −2 till +2 med dagens nivå som 0.",
    },
]

# Each research item comes from the earlier precision-designed bank. It remains
# visible and exportable but cannot affect results until the same evidence bar is
# met for every comparison party.
RESEARCH_QUESTIONS: list[dict[str, Any]] = [
    {
        "id": "r001", "area": "Ekonomi och skatter",
        "text": "Nya skattesänkningar på arbetsinkomster bör även omfatta personer som betalar statlig inkomstskatt.",
        "scope": "Avser om kommande skattesänkningar på lön ska omfatta även inkomster över brytpunkten för statlig inkomstskatt, inte bara låg- och medelinkomster.",
    },
    {
        "id": "r002", "area": "Ekonomi och skatter",
        "text": "Sverige bör införa en statlig skatt på stora privata nettoförmögenheter.",
        "scope": "Avser en återkommande skatt på stora privata nettoförmögenheter efter avdrag för skulder, inte fastighetsavgift, kapitalvinstskatt eller arvsskatt.",
    },
    {
        "id": "r003", "area": "Ekonomi och skatter",
        "text": "Staten bör varaktigt öka de generella statsbidragen till kommuner och regioner även om det minskar utrymmet för nya skattesänkningar.",
        "scope": "Avser permanenta, generella tillskott till kommunsektorn och den uttryckliga prioriteringen framför nya skattesänkningar.",
    },
    {
        "id": "r004", "area": "Brott och rättsväsende",
        "text": "Polisen bör få använda hemliga preventiva tvångsmedel mot personer som inte är misstänkta för ett konkret brott när det finns risk för grov organiserad brottslighet.",
        "scope": "Avser preventiva hemliga tvångsmedel före en konkret brottsmisstanke, inte användning mot redan misstänkta personer.",
    },
    {
        "id": "r005", "area": "Brott och rättsväsende",
        "text": "Straffreduktionen när en person döms för flera brott samtidigt bör minska ytterligare.",
        "scope": "Avser den så kallade mängdrabatten vid flerbrottslighet, inte ungdomsreduktion eller villkorlig frigivning.",
    },
    {
        "id": "r006", "area": "Migration och integration",
        "text": "Godkänt språkprov i svenska bör vara ett krav för svenskt medborgarskap, med medicinskt motiverade undantag.",
        "scope": "Avser ett formellt språkkrav för medborgarskap och uttryckliga undantag när en person av medicinska skäl inte kan genomföra provet.",
    },
    {
        "id": "r007", "area": "Migration och integration",
        "text": "Återvandringsbidraget bör vara så högt att det ger ett tydligt ekonomiskt incitament att frivilligt lämna Sverige permanent.",
        "scope": "Avser storleken och incitamentseffekten i ett frivilligt bidrag, inte tvångsutvisning eller återkallelse av tillstånd.",
    },
    {
        "id": "r008", "area": "Migration och integration",
        "text": "Arbetstillstånd bör kunna beviljas för jobb under medianlönen när villkoren följer kollektivavtal eller etablerad branschpraxis.",
        "scope": "Avser om ett centralt lönegolv ska kunna underskridas när branschens normala avtal och villkor ändå uppfylls.",
    },
    {
        "id": "r009", "area": "Energi",
        "text": "Staten bör betala en större del av nätanslutningen för ny havsbaserad vindkraft.",
        "scope": "Avser statlig finansiering av anslutningskostnaden till elnätet, inte generella stöd till själva vindkraftverken.",
    },
    {
        "id": "r010", "area": "Energi",
        "text": "Sveriges långsiktiga elplanering bör innehålla ett särskilt mål för mängden planerbar elproduktion.",
        "scope": "Avser ett kvantifierat mål för produktion som kan styras efter behov, inte enbart ett teknikneutralt mål för total elproduktion.",
    },
    {
        "id": "r011", "area": "Klimat och miljö",
        "text": "Staten bör införa en bred köpbonus för privatpersoner som köper nya elbilar.",
        "scope": "Avser ett generellt inköpsstöd för nya elbilar, inte endast riktade stöd till vissa hushåll eller landsbygdsområden.",
    },
    {
        "id": "r012", "area": "Sjukvård",
        "text": "Vinstdrivande företag bör få dela ut vinst från skattefinansierad vård när de uppfyller samma kvalitetskrav som andra vårdgivare.",
        "scope": "Avser rätten till vinstutdelning efter uppfyllda kvalitetskrav, inte enbart rätten att bedriva vård.",
    },
    {
        "id": "r013", "area": "Sjukvård",
        "text": "Patienter som inte får specialistvård inom vårdgarantin bör ha rätt till offentligt finansierad vård hos en annan godkänd vårdgivare.",
        "scope": "Avser en nationellt fungerande rätt att få vård någon annanstans när tidsgränsen överskrids.",
    },
    {
        "id": "r014", "area": "Sjukvård",
        "text": "Vuxentandvården bör på sikt få ett ekonomiskt högkostnadsskydd som liknar övrig sjukvård.",
        "scope": "Avser ett brett högkostnadsskydd för vuxna, inte endast ett högre tandvårdsbidrag eller stöd till vissa åldersgrupper.",
    },
    {
        "id": "r015", "area": "Skola",
        "text": "Staten bör ta över huvudmannaskapet för grundskolan från kommunerna.",
        "scope": "Avser ett statligt huvudmannaskap, inte bara mer nationell finansiering, reglering eller tillsyn.",
    },
    {
        "id": "r016", "area": "Skola",
        "text": "Nationella terminsbetyg bör ges från årskurs 4 i grundskolan.",
        "scope": "Avser betyg från årskurs 4 för alla elever, inte frivilliga försök eller skriftliga omdömen utan betygsskala.",
    },
    {
        "id": "r017", "area": "Arbetsmarknad och socialförsäkring",
        "text": "Arbetsgivare bör få undanta fler anställda än i dag från principen sist in–först ut vid arbetsbrist.",
        "scope": "Avser fler undantag från turordningsreglerna vid uppsägning på grund av arbetsbrist.",
    },
    {
        "id": "r018", "area": "Arbetsmarknad och socialförsäkring",
        "text": "Den inkomstbaserade a-kassan bör ge högre ersättning under arbetslöshetens första månader än dagens system.",
        "scope": "Avser ersättningsnivån i början av arbetslösheten, inte medlemsvillkor eller hur snabbt ersättningen senare trappas ned.",
    },
    {
        "id": "r019", "area": "Företagande och industri",
        "text": "Arbetsgivaravgiften bör sänkas särskilt för små företag när de anställer sina första medarbetare.",
        "scope": "Avser en riktad nedsättning vid de första anställningarna, inte en generell sänkning för alla arbetsgivare.",
    },
    {
        "id": "r020", "area": "Företagande och industri",
        "text": "Offentlig upphandling bör få premiera produktion i Sverige eller EU för samhällskritiska varor även när ett globalt alternativ är billigare.",
        "scope": "Avser leveranssäkerhet och geografisk produktion för samhällskritiska varor, med möjlig högre kostnad som följd.",
    },
    {
        "id": "r021", "area": "Försvar och säkerhet",
        "text": "Sveriges militära försvarsutgifter bör varaktigt uppgå till minst 3,5 procent av BNP, utöver civila beredskapsutgifter.",
        "scope": "Avser den militära delen av försvarsutgifterna och en varaktig miniminivå, inte ett tillfälligt tillskott.",
    },
    {
        "id": "r022", "area": "Försvar och säkerhet",
        "text": "Sverige bör fortsätta ge omfattande militärt stöd till Ukraina även om andra svenska statsutgifter då måste bli högre eller prioriteras ned.",
        "scope": "Avser uthålligt militärt stöd och den uttryckliga budgetmässiga kostnaden.",
    },
    {
        "id": "r023", "area": "EU och utrikespolitik",
        "text": "EU bör fatta fler utrikes- och säkerhetspolitiska beslut med kvalificerad majoritet i stället för nationellt veto.",
        "scope": "Avser minskat krav på enhällighet inom EU:s utrikes- och säkerhetspolitik.",
    },
    {
        "id": "r024", "area": "Bostäder och infrastruktur",
        "text": "Staten bör återuppta planeringen av separata höghastighetsbanor mellan Stockholm, Göteborg och Malmö.",
        "scope": "Avser nya separata stambanor för höghastighetståg, inte endast upprustning av befintlig järnväg.",
    },
    {
        "id": "r025", "area": "Demokrati och personlig integritet",
        "text": "Sverige bör motsätta sig generell automatisk skanning av privata digitala meddelanden innan det finns konkret misstanke mot användaren.",
        "scope": "Avser generell förhandsgranskning av privata meddelanden, inte riktad avlyssning efter beslut i ett konkret ärende.",
    },
]

# Party answers transcribed from the 2026 national source pages, in q001–q035 order.
ANSWERS: dict[str, list[int]] = {
    "s":  [-1, 2,-1, 1, 1,-1,-2,-2,-2, 2,-2,-1,-2, 2,-1, 2,-2, 1, 2,-1, 1, 2,-2, 2, 2,-1, 1,-1,-2, 2,-2, 2, 1,-1, 0],
    "m":  [ 2,-1,-2, 2, 1, 1,-1,-2,-1,-2, 1,-1, 1,-1, 1,-2,-1, 1, 2,-1, 2,-1,-1, 1, 2, 1, 2,-1, 1,-1,-2, 0,-1,-2,-1],
    "sd": [ 2,-2,-2, 2, 2,-2, 2,-2, 2, 1, 2, 1,-1,-2,-2,-2,-2,-2, 2,-2, 2,-2, 1,-1, 2, 2, 2,-2, 2,-2, 2, 1,-1,-2,-1],
    "v":  [-2, 2, 2,-2,-1, 2,-2,-1,-2, 2,-2, 2,-2, 1,-2, 2,-2, 2,-1, 2,-1, 2,-2, 2, 2, 1,-2, 1,-1, 2,-2,-1, 1, 1, 2],
    "c":  [-2,-1,-1, 2, 1, 2,-2,-2,-2,-2,-2,-2,-2, 2, 1, 2,-1, 1, 1,-2,-1, 1,-2, 1, 2, 1,-1,-2,-1, 1,-2, 0, 0, 0, 0],
    "kd": [ 1,-1,-2, 1, 2,-2, 1,-2, 2,-2, 2,-2,-2,-1,-1, 2, 1,-1, 2,-1, 2,-2,-1,-1, 2, 1, 2,-2, 2,-2, 2, 0,-1, 0,-1],
    "l":  [ 1, 2,-2, 1, 1,-1,-2,-2,-2,-2,-1,-1, 2,-1, 2, 1, 2, 1, 2,-1, 1,-1,-2, 1, 2, 1, 1,-2, 1,-1,-2, 0,-2, 0, 1],
    "mp": [-2, 2, 1, 1,-2, 2,-2,-2,-2, 2,-2, 1,-2, 2,-2, 2,-2, 2,-1, 2,-2, 2,-2, 2, 2, 1,-2,-2,-1, 2,-2,-1, 1, 2, 2],
}

PROPOSITION_LABELS = {
    -2: "Mycket dåligt förslag",
    -1: "Ganska dåligt förslag",
     1: "Ganska bra förslag",
     2: "Mycket bra förslag",
}
SLIDER_LABELS = {-2: "Mycket mindre", -1: "Lite mindre", 0: "Samma som i dag", 1: "Lite mer", 2: "Mycket mer"}

SOURCE_REGISTRY = [
    {
        "id": "svt-2026-main", "publisher": "SVT Nyheter", "title": "Valkompass 2026",
        "url": "https://valkompass.svt.se/2026/", "sourceType": "established-compass",
        "note": "Översikt över SVT:s nationella och lokala valkompasser samt de åtta deltagande riksdagspartierna.",
        "verified": VERIFIED,
    },
    {
        "id": "svt-2026-method", "publisher": "SVT Nyheter", "title": "Frågor och svar om SVT:s valkompasser",
        "url": "https://www.svt.se/nyheter/inrikes/fragor-och-svar-om-svts-valkompasser", "sourceType": "methodology",
        "note": "Beskriver frågeurval, partiernas egna svar och hur SVT tog fram 2026 års kompass tillsammans med Indikator Opinion.",
        "verified": VERIFIED,
    },
]
for party in PARTIES:
    if party["id"] in PARTY_URLS:
        SOURCE_REGISTRY.append({
            "id": f"svt-2026-{party['id']}", "party": party["id"], "publisher": "SVT Nyheter",
            "title": f"Valkompass 2026 – {party['name']}", "url": PARTY_URLS[party["id"]],
            "sourceType": "party-self-report-established-compass",
            "note": "Partiets egna svar på samma nationella sakfrågor. Appens formulering är en självständig neutral parafras med bevarad riktning och avgränsning.",
            "verified": VERIFIED,
        })
SOURCE_REGISTRY.extend([
    {
        "id": "op-2026-program", "party": "op", "publisher": "Örebropartiet", "title": "Valprogram 2026 – ingångssida",
        "url": "https://orebropartiet.se/var-politik/", "sourceType": "official-election-program",
        "note": "Partiet uppger att 2026-programmet publiceras successivt och kan kompletteras fram till valdagen.",
        "verified": VERIFIED,
    },
    {
        "id": "op-2026-energy", "party": "op", "publisher": "Örebropartiet", "title": "Energi och bränsle",
        "url": "https://orebropartiet.se/var-politik/energi-och-br%C3%A4nsle/", "sourceType": "official-election-program",
        "note": "Officiell programdel om kärnkraft, vindkraft, gröna industriprojekt och drivmedelsskatter.",
        "verified": VERIFIED,
    },
    {
        "id": "op-2026-dental", "party": "op", "publisher": "Örebropartiet", "title": "Tandvård",
        "url": "https://orebropartiet.se/var-politik/tandv%C3%A5rd/", "sourceType": "official-election-program",
        "note": "Officiell programdel om avgiftsfri tandvård på nationell nivå.",
        "verified": VERIFIED,
    },
    {
        "id": "op-2026-migration", "party": "op", "publisher": "Örebropartiet", "title": "Migrationspolitik",
        "url": "https://orebropartiet.se/var-politik/migrationspolitik/", "sourceType": "official-election-program",
        "note": "Officiell programdel om asyl, medborgarskap, uppehållstillstånd och återvandring.",
        "verified": VERIFIED,
    },
])

COMMON_RULE = {
    "+2": "Tydligt stöd för påståendet eller en starkare version.",
    "+1": "Stöd för riktningen men med tydliga begränsningar eller lägre ambitionsnivå.",
    "0": "Uttryckligt stöd för ungefär dagens nivå eller en verklig mellanposition. Avsaknad av källa är aldrig 0.",
    "-1": "Motstånd mot riktningen, men med undantag eller stöd för en svagare närliggande reform.",
    "-2": "Tydligt motstånd mot påståendet eller stöd för en motsatt ordning.",
    "null": "Otillräckligt exakt eller aktuellt underlag. Positionen påverkar då inget resultat.",
}

QUESTIONS: list[dict[str, Any]] = []
for ordinal, q in enumerate(ACTIVE_QUESTIONS, start=1):
    item = deepcopy(q)
    item.update({
        "status": "active", "score": True, "order": ordinal,
        "reviewStatus": "verified-common-matrix", "codingRule": COMMON_RULE,
        "sourceSet": "svt-2026-national-party-answers", "sourceQuestionOrdinal": ordinal,
        "sourceQuestionType": item.get("sourceQuestionType", "proposition"),
        "sourcePrompt": SOURCE_PROMPTS[ordinal - 1],
        "sourceReference": "https://valkompass.svt.se/2026/",
        "wordingMethod": "Självständig neutral parafras av motsvarande källpåstående; riktning och saklig avgränsning ska vara oförändrade.",
    })
    QUESTIONS.append(item)
for offset, q in enumerate(RESEARCH_QUESTIONS, start=1):
    item = deepcopy(q)
    item.update({
        "status": "research", "score": False, "order": 35 + offset,
        "reviewStatus": "awaiting-common-matrix", "codingRule": COMMON_RULE,
        "sourceSet": None, "sourceQuestionOrdinal": None,
        "sourceQuestionType": "proposition",
        "wordingMethod": "Egen precisionsfråga. Får inte aktiveras förrän alla jämförelsepartier har verifierats mot exakt samma avgränsning.",
    })
    QUESTIONS.append(item)

POSITIONS: list[dict[str, Any]] = []
party_by_id = {p["id"]: p for p in PARTIES}
for q in QUESTIONS:
    for party in PARTIES:
        pid = party["id"]
        base = {
            "party": pid,
            "question": q["id"],
            "position": None,
            "confidence": "unknown",
            "codingStatus": "unknown",
            "comparisonGroup": party["comparisonGroup"],
            "source": None,
            "sourceId": None,
            "sourceTitle": None,
            "sourcePublisher": None,
            "sourceDate": None,
            "sourceAnswer": None,
            "verified": VERIFIED,
            "evidenceType": None,
            "semanticMatch": None,
            "rationale": "Ingen position används utan tillräckligt exakt och aktuellt underlag.",
            "reviewNotes": None,
        }
        if q["status"] == "active" and pid in ANSWERS:
            value = ANSWERS[pid][q["order"] - 1]
            is_slider = q["sourceQuestionType"] == "directional-slider"
            label = (SLIDER_LABELS if is_slider else PROPOSITION_LABELS)[value]
            scale_note = "mer–mindre-skalan" if is_slider else "förslagsskalan"
            base.update({
                "position": value,
                "confidence": "high",
                "codingStatus": "verified",
                "source": PARTY_URLS[pid],
                "sourceId": f"svt-2026-{pid}",
                "sourceTitle": f"SVT Valkompass 2026 – {party['name']}",
                "sourcePublisher": "SVT Nyheter",
                "sourceDate": None,
                "sourceAnswer": label,
                "evidenceType": "party-self-report-established-compass",
                "semanticMatch": "same-proposition-neutral-paraphrase",
                "rationale": (
                    f"{party['name']} valde ”{label}” på den motsvarande nationella frågan. "
                    f"Svaret har mekaniskt kodats till {value:+d} på {scale_note}; ingen manuell bonus eller efterjustering har lagts till."
                ),
                "reviewNotes": "Källsidans originalformulering och partiets egen motivering kan granskas via länken.",
            })
        elif q["status"] == "research":
            base.update({
                "codingStatus": "not-in-scoring-matrix",
                "rationale": "Frågan är en forskningsfråga och är avstängd från poängberäkningen tills en komplett, jämförbar källmatris finns för samtliga partier.",
            })
        elif pid == "op" and q["status"] == "active":
            base.update({
                "codingStatus": "awaiting-official-material",
                "rationale": "Örebropartiets nationella valprogram 2026 publiceras successivt. Ingen position sätts förrän publicerat material täcker just denna avgränsning tillräckligt tydligt.",
                "source": "https://orebropartiet.se/var-politik/",
                "sourceId": "op-2026-program",
                "sourceTitle": "Örebropartiet – Valprogram 2026",
                "sourcePublisher": "Örebropartiet",
                "sourceDate": None,
                "evidenceType": "official-election-program-incomplete",
            })
        POSITIONS.append(base)

# Conservative exact mappings for the portions of Örebropartiet's 2026 national
# programme that were published and sufficiently specific on the verification date.
OP_KNOWN = {
    "q014": {
        "position": -2, "sourceId": "op-2026-energy", "source": "https://orebropartiet.se/var-politik/energi-och-br%C3%A4nsle/",
        "sourceTitle": "Örebropartiet – Energi och bränsle", "confidence": "high",
        "sourceAnswer": "Motsätter sig statlig finansiering av gröna industriprojekt",
        "rationale": "Partiets officiella 2026-program vill avveckla offentligt finansierade gröna industriprojekt och säger att staten ska hålla sig borta från denna typ av risktagande. Det är ett tydligt motstånd mot mer statliga investeringar.",
    },
    "q019": {
        "position": 2, "sourceId": "op-2026-migration", "source": "https://orebropartiet.se/var-politik/migrationspolitik/",
        "sourceTitle": "Örebropartiet – Migrationspolitik", "confidence": "high",
        "sourceAnswer": "Vill kunna riva upp medborgarskap vid bland annat kriminalitet",
        "rationale": "Partiets officiella 2026-program vill kunna riva upp förvärvade medborgarskap för personer som bland annat ägnar sig åt kriminalitet. Det stödjer påståendets riktning tydligt.",
    },
    "q021": {
        "position": 2, "sourceId": "op-2026-energy", "source": "https://orebropartiet.se/var-politik/energi-och-br%C3%A4nsle/",
        "sourceTitle": "Örebropartiet – Energi och bränsle", "confidence": "high",
        "sourceAnswer": "Vill avskaffa alla skatter på bränsle",
        "rationale": "Partiets officiella 2026-program vill avskaffa samtliga skatter på bränsle, vilket är en starkare version av att sänka skatten på bensin och diesel.",
    },
    "q024": {
        "position": 2, "sourceId": "op-2026-dental", "source": "https://orebropartiet.se/var-politik/tandv%C3%A5rd/",
        "sourceTitle": "Örebropartiet – Tandvård", "confidence": "high",
        "sourceAnswer": "Vill ha avgiftsfri tandvård för samtliga medborgare",
        "rationale": "Partiets officiella 2026-program vill införa avgiftsfri tandvård för alla medborgare i Sverige. Det omfattar och går längre än avgiftsfri tandvård till 23 års ålder.",
    },
    "q027": {
        "position": 2, "sourceId": "op-2026-energy", "source": "https://orebropartiet.se/var-politik/energi-och-br%C3%A4nsle/",
        "sourceTitle": "Örebropartiet – Energi och bränsle", "confidence": "high",
        "sourceAnswer": "Vill att staten ska äga och finansiera utbyggd kärnkraft",
        "rationale": "Partiets officiella 2026-program vill bygga ut kärnkraften med staten som huvudman och ägare samt finansiering genom budget, lån eller pensionsfonder. Det är tydligt statligt ekonomiskt stöd.",
    },
    "q034": {
        "position": -2, "sourceId": "op-2026-migration", "source": "https://orebropartiet.se/var-politik/migrationspolitik/",
        "sourceTitle": "Örebropartiet – Migrationspolitik", "confidence": "high",
        "sourceAnswer": "Vill nolla asylinvandringen med ett begränsat närområdesundantag",
        "rationale": "Partiets officiella 2026-program vill avskaffa asylinvandringen, med undantag för krig i Sveriges omedelbara närområde. Det är tydligt motsatt ett öppnare mottagande än i dag.",
    },
}
for row in POSITIONS:
    if row["party"] == "op" and row["question"] in OP_KNOWN:
        known = OP_KNOWN[row["question"]]
        row.update({
            **known,
            "codingStatus": "verified",
            "sourcePublisher": "Örebropartiet",
            "sourceDate": None,
            "verified": VERIFIED,
            "evidenceType": "official-election-program",
            "semanticMatch": "direct-or-stronger-policy-position",
            "reviewNotes": "Örebropartiet ingår inte i den jämförbara huvudrankningen förrän en tillräckligt komplett nationell matris finns. Denna rad kan ändå granskas och användas i en separat preliminär delmängdsjämförelse.",
        })

# An explicit example of the fail-closed rule. The programme clearly opposes
# large-scale wind power and proposes a veto for nearby property owners, but
# that does not directly answer whether the *municipal* veto should remain.
# Therefore q028 stays unknown instead of inferring a numeric position.
for row in POSITIONS:
    if row["party"] == "op" and row["question"] == "q028":
        row.update({
            "position": None,
            "confidence": "unknown",
            "codingStatus": "insufficient-scope-match",
            "source": "https://orebropartiet.se/var-politik/energi-och-br%C3%A4nsle/",
            "sourceId": "op-2026-energy",
            "sourceTitle": "Örebropartiet – Energi och bränsle",
            "sourcePublisher": "Örebropartiet",
            "sourceAnswer": None,
            "evidenceType": "official-election-program",
            "semanticMatch": "insufficient-specificity",
            "rationale": "Programmet vill stoppa storskalig vindkraft och ge närboende fastighetsägare veto, men det säger inte uttryckligen om kommunernas särskilda veto ska finnas kvar. Den exakta frågan gäller den kommunala vetorätten, därför lämnas positionen okänd.",
            "reviewNotes": "Fail-closed: en närliggande politisk linje får inte ersätta ett exakt svar på den kommunala vetorätten.",
        })

# Canonical write before the fingerprint is calculated.
def write_json(name: str, value: Any) -> None:
    (DATA / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

write_json("questions.json", QUESTIONS)
write_json("parties.json", PARTIES)
write_json("positions.json", POSITIONS)
write_json("source-register.json", SOURCE_REGISTRY)

canonical_payload = json.dumps(
    {"questions": QUESTIONS, "parties": PARTIES, "positions": POSITIONS, "sources": SOURCE_REGISTRY},
    ensure_ascii=False, sort_keys=True, separators=(",", ":"),
).encode("utf-8")
fingerprint = hashlib.sha256(canonical_payload).hexdigest()

active_areas: dict[str, int] = {}
for q in QUESTIONS:
    if q["status"] == "active":
        active_areas[q["area"]] = active_areas.get(q["area"], 0) + 1

META = {
    "title": "Öppen Valkompass 2026",
    "datasetVersion": "0.4.0-source-audit",
    "questionDesignVersion": "3.2",
    "verifiedThrough": VERIFIED,
    "electionDate": "2026-09-13",
    "dataFingerprintSha256": fingerprint,
    "activeQuestionCount": sum(q["status"] == "active" for q in QUESTIONS),
    "researchQuestionCount": sum(q["status"] == "research" for q in QUESTIONS),
    "totalQuestionCount": len(QUESTIONS),
    "corePartyIds": [p["id"] for p in PARTIES if p["comparisonGroup"] == "core"],
    "provisionalPartyIds": [p["id"] for p in PARTIES if p["comparisonGroup"] == "provisional"],
    "minimumAnsweredForResult": 12,
    "activeAreaCounts": active_areas,
    "scoring": {
        "positionScale": [-2, -1, 0, 1, 2],
        "importanceScale": [0, 1, 2, 3, 5],
        "overall": "Aritmetiskt medel av varje besvarat politikområdes matchningsprocent.",
        "priority": "Viktad områdesmatchning där användarens genomsnittliga vikt i området styr områdets påverkan.",
        "unknown": "Okända positioner påverkar inte poängen och får aldrig kodas som 0.",
    },
    "readiness": {
        "coreMatrixRequired": 35 * 8,
        "coreMatrixVerified": sum(
            row["codingStatus"] == "verified" and row["party"] in ANSWERS and row["question"].startswith("q")
            for row in POSITIONS
        ),
        "provisionalKnown": sum(row["codingStatus"] == "verified" and row["party"] == "op" for row in POSITIONS),
        "researchIncludedInScoring": False,
    },
    "review": {
        "coreMatrix": "Mekanisk översättning av partiernas egna svar på samma 35 nationella 2026-frågor; inga manuella poängjusteringar.",
        "precisionQuestions": "25 frågor är fail-closed och score:false tills en komplett exakt källmatris finns.",
        "provisionalParty": "Örebropartiet kodas endast när publicerat nationellt 2026-material direkt täcker frågans avgränsning; närliggande politik räcker inte.",
        "secondReview": "Politisk dubbelgranskning av varje rad är ett fortsatt kvalitetssteg och redovisas inte som genomförd innan den faktiskt är klar."
    },
    "note": "Den publika kärnan använder 35 sakfrågor med en komplett och jämförbar matris av partiernas egna 2026-svar för samtliga åtta riksdagspartier. Samma kod betyder samma svarskategori på det exakta påståendet, inte att partiernas övriga politik, motiv eller genomförande är identiska. Ytterligare 25 precisionsfrågor finns i forskningskön men påverkar inte resultatet. Örebropartiet visas separat och preliminärt; endast direkt belagda positioner kodas och närliggande politik lämnas null.",
}
write_json("meta.json", META)

print(f"Generated {len(QUESTIONS)} questions, {len(POSITIONS)} positions, fingerprint {fingerprint}")
