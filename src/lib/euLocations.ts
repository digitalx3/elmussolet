// EU + EEA countries with their administrative subdivisions (provinces / regions).
// Used by the address forms to provide linked Country -> Province dropdowns.

export interface CountryOption {
  code: string;   // ISO 3166-1 alpha-2
  name: string;   // Display name (Catalan/Spanish-friendly)
  provinces: string[];
}

export const EU_COUNTRIES: CountryOption[] = [
  {
    code: 'ES', name: 'Espanya / España',
    provinces: [
      'A Coruña', 'Àlaba / Álava', 'Albacete', 'Alacant / Alicante', 'Almeria / Almería',
      'Astúries / Asturias', 'Àvila / Ávila', 'Badajoz', 'Illes Balears', 'Barcelona',
      'Burgos', 'Càceres / Cáceres', 'Cadis / Cádiz', 'Cantàbria / Cantabria', 'Castelló / Castellón',
      'Ciudad Real', 'Còrdova / Córdoba', 'Conca / Cuenca', 'Girona', 'Granada',
      'Guadalajara', 'Guipúscoa / Gipuzkoa', 'Huelva', 'Osca / Huesca', 'Jaén',
      'Lleó / León', 'Lleida', 'Lugo', 'Madrid', 'Màlaga / Málaga',
      'Múrcia / Murcia', 'Navarra', 'Ourense', 'Palència / Palencia', 'Las Palmas',
      'Pontevedra', 'La Rioja', 'Salamanca', 'Santa Cruz de Tenerife', 'Segòvia / Segovia',
      'Sevilla', 'Sòria / Soria', 'Tarragona', 'Terol / Teruel', 'Toledo',
      'València / Valencia', 'Valladolid', 'Biscaia / Bizkaia', 'Zamora', 'Saragossa / Zaragoza',
      'Ceuta', 'Melilla',
    ],
  },
  {
    code: 'AD', name: 'Andorra',
    provinces: ['Andorra la Vella', 'Canillo', 'Encamp', 'Escaldes-Engordany', 'La Massana', 'Ordino', 'Sant Julià de Lòria'],
  },
  {
    code: 'PT', name: 'Portugal',
    provinces: [
      'Aveiro', 'Beja', 'Braga', 'Bragança', 'Castelo Branco', 'Coimbra', 'Évora', 'Faro',
      'Guarda', 'Leiria', 'Lisboa', 'Portalegre', 'Porto', 'Santarém', 'Setúbal', 'Viana do Castelo',
      'Vila Real', 'Viseu', 'Açores', 'Madeira',
    ],
  },
  {
    code: 'FR', name: 'França / Francia',
    provinces: [
      'Auvergne-Rhône-Alpes', 'Bourgogne-Franche-Comté', 'Bretagne', 'Centre-Val de Loire', 'Corse',
      'Grand Est', 'Hauts-de-France', 'Île-de-France', 'Normandie', 'Nouvelle-Aquitaine',
      'Occitanie', 'Pays de la Loire', 'Provence-Alpes-Côte d\'Azur',
      'Guadeloupe', 'Martinique', 'Guyane', 'La Réunion', 'Mayotte',
    ],
  },
  {
    code: 'IT', name: 'Itàlia / Italia',
    provinces: [
      'Abruzzo', 'Basilicata', 'Calabria', 'Campania', 'Emilia-Romagna', 'Friuli-Venezia Giulia',
      'Lazio', 'Liguria', 'Lombardia', 'Marche', 'Molise', 'Piemonte', 'Puglia', 'Sardegna',
      'Sicilia', 'Toscana', 'Trentino-Alto Adige', 'Umbria', 'Valle d\'Aosta', 'Veneto',
    ],
  },
  {
    code: 'DE', name: 'Alemanya / Alemania',
    provinces: [
      'Baden-Württemberg', 'Bayern', 'Berlin', 'Brandenburg', 'Bremen', 'Hamburg', 'Hessen',
      'Mecklenburg-Vorpommern', 'Niedersachsen', 'Nordrhein-Westfalen', 'Rheinland-Pfalz',
      'Saarland', 'Sachsen', 'Sachsen-Anhalt', 'Schleswig-Holstein', 'Thüringen',
    ],
  },
  {
    code: 'BE', name: 'Bèlgica / Bélgica',
    provinces: ['Antwerpen', 'Brussel·les / Bruxelles', 'Hainaut', 'Liège', 'Limburg', 'Luxembourg',
      'Namur', 'Oost-Vlaanderen', 'Vlaams-Brabant', 'Brabant wallon', 'West-Vlaanderen'],
  },
  {
    code: 'NL', name: 'Països Baixos / Países Bajos',
    provinces: ['Drenthe', 'Flevoland', 'Friesland', 'Gelderland', 'Groningen', 'Limburg',
      'Noord-Brabant', 'Noord-Holland', 'Overijssel', 'Utrecht', 'Zeeland', 'Zuid-Holland'],
  },
  {
    code: 'LU', name: 'Luxemburg / Luxemburgo',
    provinces: ['Capellen', 'Clervaux', 'Diekirch', 'Echternach', 'Esch-sur-Alzette', 'Grevenmacher',
      'Luxembourg', 'Mersch', 'Redange', 'Remich', 'Vianden', 'Wiltz'],
  },
  {
    code: 'IE', name: 'Irlanda',
    provinces: ['Carlow', 'Cavan', 'Clare', 'Cork', 'Donegal', 'Dublin', 'Galway', 'Kerry',
      'Kildare', 'Kilkenny', 'Laois', 'Leitrim', 'Limerick', 'Longford', 'Louth', 'Mayo',
      'Meath', 'Monaghan', 'Offaly', 'Roscommon', 'Sligo', 'Tipperary', 'Waterford',
      'Westmeath', 'Wexford', 'Wicklow'],
  },
  {
    code: 'AT', name: 'Àustria / Austria',
    provinces: ['Burgenland', 'Kärnten', 'Niederösterreich', 'Oberösterreich', 'Salzburg',
      'Steiermark', 'Tirol', 'Vorarlberg', 'Wien'],
  },
  {
    code: 'GR', name: 'Grècia / Grecia',
    provinces: ['Attiki', 'Central Greece', 'Central Macedonia', 'Crete', 'Eastern Macedonia and Thrace',
      'Epirus', 'Ionian Islands', 'North Aegean', 'Peloponnese', 'South Aegean', 'Thessaly',
      'Western Greece', 'Western Macedonia'],
  },
  {
    code: 'PL', name: 'Polònia / Polonia',
    provinces: ['Dolnośląskie', 'Kujawsko-Pomorskie', 'Lubelskie', 'Lubuskie', 'Łódzkie',
      'Małopolskie', 'Mazowieckie', 'Opolskie', 'Podkarpackie', 'Podlaskie', 'Pomorskie',
      'Śląskie', 'Świętokrzyskie', 'Warmińsko-Mazurskie', 'Wielkopolskie', 'Zachodniopomorskie'],
  },
  {
    code: 'CZ', name: 'Txèquia / Chequia',
    provinces: ['Praha', 'Středočeský', 'Jihočeský', 'Plzeňský', 'Karlovarský', 'Ústecký',
      'Liberecký', 'Královéhradecký', 'Pardubický', 'Vysočina', 'Jihomoravský', 'Olomoucký',
      'Zlínský', 'Moravskoslezský'],
  },
  {
    code: 'SK', name: 'Eslovàquia / Eslovaquia',
    provinces: ['Bratislavský', 'Trnavský', 'Trenčiansky', 'Nitriansky', 'Žilinský',
      'Banskobystrický', 'Prešovský', 'Košický'],
  },
  {
    code: 'HU', name: 'Hongria / Hungría',
    provinces: ['Budapest', 'Bács-Kiskun', 'Baranya', 'Békés', 'Borsod-Abaúj-Zemplén', 'Csongrád-Csanád',
      'Fejér', 'Győr-Moson-Sopron', 'Hajdú-Bihar', 'Heves', 'Jász-Nagykun-Szolnok',
      'Komárom-Esztergom', 'Nógrád', 'Pest', 'Somogy', 'Szabolcs-Szatmár-Bereg', 'Tolna',
      'Vas', 'Veszprém', 'Zala'],
  },
  {
    code: 'RO', name: 'Romania',
    provinces: ['Alba', 'Arad', 'Argeș', 'Bacău', 'Bihor', 'Bistrița-Năsăud', 'Botoșani', 'Brașov',
      'Brăila', 'București', 'Buzău', 'Caraș-Severin', 'Călărași', 'Cluj', 'Constanța', 'Covasna',
      'Dâmbovița', 'Dolj', 'Galați', 'Giurgiu', 'Gorj', 'Harghita', 'Hunedoara', 'Ialomița',
      'Iași', 'Ilfov', 'Maramureș', 'Mehedinți', 'Mureș', 'Neamț', 'Olt', 'Prahova', 'Satu Mare',
      'Sălaj', 'Sibiu', 'Suceava', 'Teleorman', 'Timiș', 'Tulcea', 'Vaslui', 'Vâlcea', 'Vrancea'],
  },
  {
    code: 'BG', name: 'Bulgària / Bulgaria',
    provinces: ['Blagoevgrad', 'Burgas', 'Dobrich', 'Gabrovo', 'Haskovo', 'Kardzhali', 'Kyustendil',
      'Lovech', 'Montana', 'Pazardzhik', 'Pernik', 'Pleven', 'Plovdiv', 'Razgrad', 'Ruse',
      'Shumen', 'Silistra', 'Sliven', 'Smolyan', 'Sofia', 'Sofia City', 'Stara Zagora',
      'Targovishte', 'Varna', 'Veliko Tarnovo', 'Vidin', 'Vratsa', 'Yambol'],
  },
  {
    code: 'SI', name: 'Eslovènia / Eslovenia',
    provinces: ['Pomurska', 'Podravska', 'Koroška', 'Savinjska', 'Zasavska', 'Posavska',
      'Jugovzhodna Slovenija', 'Osrednjeslovenska', 'Gorenjska', 'Primorsko-notranjska',
      'Goriška', 'Obalno-kraška'],
  },
  {
    code: 'HR', name: 'Croàcia / Croacia',
    provinces: ['Zagreb (Grad)', 'Bjelovar-Bilogora', 'Brod-Posavina', 'Dubrovnik-Neretva', 'Istria',
      'Karlovac', 'Koprivnica-Križevci', 'Krapina-Zagorje', 'Lika-Senj', 'Međimurje',
      'Osijek-Baranja', 'Požega-Slavonia', 'Primorje-Gorski Kotar', 'Šibenik-Knin',
      'Sisak-Moslavina', 'Split-Dalmatia', 'Varaždin', 'Virovitica-Podravina', 'Vukovar-Srijem',
      'Zadar', 'Zagreb (County)'],
  },
  {
    code: 'DK', name: 'Dinamarca',
    provinces: ['Hovedstaden', 'Sjælland', 'Syddanmark', 'Midtjylland', 'Nordjylland'],
  },
  {
    code: 'SE', name: 'Suècia / Suecia',
    provinces: ['Stockholm', 'Uppsala', 'Södermanland', 'Östergötland', 'Jönköping', 'Kronoberg',
      'Kalmar', 'Gotland', 'Blekinge', 'Skåne', 'Halland', 'Västra Götaland', 'Värmland',
      'Örebro', 'Västmanland', 'Dalarna', 'Gävleborg', 'Västernorrland', 'Jämtland',
      'Västerbotten', 'Norrbotten'],
  },
  {
    code: 'FI', name: 'Finlàndia / Finlandia',
    provinces: ['Åland', 'Etelä-Karjala', 'Etelä-Pohjanmaa', 'Etelä-Savo', 'Kainuu', 'Kanta-Häme',
      'Keski-Pohjanmaa', 'Keski-Suomi', 'Kymenlaakso', 'Lappi', 'Pirkanmaa', 'Pohjanmaa',
      'Pohjois-Karjala', 'Pohjois-Pohjanmaa', 'Pohjois-Savo', 'Päijät-Häme', 'Satakunta',
      'Uusimaa', 'Varsinais-Suomi'],
  },
  {
    code: 'EE', name: 'Estònia / Estonia',
    provinces: ['Harju', 'Hiiu', 'Ida-Viru', 'Jõgeva', 'Järva', 'Lääne', 'Lääne-Viru', 'Põlva',
      'Pärnu', 'Rapla', 'Saare', 'Tartu', 'Valga', 'Viljandi', 'Võru'],
  },
  {
    code: 'LV', name: 'Letònia / Letonia',
    provinces: ['Rīga', 'Vidzeme', 'Kurzeme', 'Zemgale', 'Latgale'],
  },
  {
    code: 'LT', name: 'Lituània / Lituania',
    provinces: ['Alytus', 'Kaunas', 'Klaipėda', 'Marijampolė', 'Panevėžys', 'Šiauliai',
      'Tauragė', 'Telšiai', 'Utena', 'Vilnius'],
  },
  {
    code: 'MT', name: 'Malta',
    provinces: ['Southern Harbour', 'Northern Harbour', 'South Eastern', 'Western', 'Northern', 'Gozo'],
  },
  {
    code: 'CY', name: 'Xipre / Chipre',
    provinces: ['Nicosia', 'Limassol', 'Larnaca', 'Famagusta', 'Paphos', 'Kyrenia'],
  },
];

export const getCountry = (code: string | null | undefined): CountryOption | undefined =>
  EU_COUNTRIES.find(c => c.code === code);

export const getProvincesFor = (code: string | null | undefined): string[] =>
  getCountry(code)?.provinces ?? [];

export const DEFAULT_COUNTRY = 'ES';
