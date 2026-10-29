import { RUNG, type DetectedSpan } from './types';

// A small, offline gazetteer aimed at common document locations. It covers
// countries, major cities and a useful Spain/Galicia administrative set; it
// is intentionally not presented as a worldwide gazetteer.
const PLACES = [
  // Countries and common short names
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Argentina', 'Armenia', 'Australia', 'Austria',
  'Azerbaijan', 'Bangladesh', 'Belarus', 'Belgium', 'Bolivia', 'Bosnia and Herzegovina', 'Brazil', 'Bulgaria',
  'Cambodia', 'Cameroon', 'Canada', 'Chile', 'China', 'Colombia', 'Costa Rica', 'Croatia', 'Cuba', 'Cyprus',
  'Czech Republic', 'Czechia', 'Denmark', 'Dominican Republic', 'Ecuador', 'Egypt', 'Estonia', 'Ethiopia',
  'Finland', 'France', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Guatemala', 'Hungary', 'Iceland', 'India',
  'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Japan', 'Jordan', 'Kenya', 'Latvia', 'Lebanon',
  'Lithuania', 'Luxembourg', 'Malaysia', 'Malta', 'Mexico', 'Moldova', 'Monaco', 'Mongolia', 'Montenegro',
  'Morocco', 'Nepal', 'Netherlands', 'New Zealand', 'Nigeria', 'North Korea', 'North Macedonia', 'Norway',
  'Pakistan', 'Palestine', 'Panama', 'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal', 'Puerto Rico',
  'Romania', 'Russia', 'Saudi Arabia', 'Scotland', 'Senegal', 'Serbia', 'Singapore', 'Slovakia', 'Slovenia',
  'South Africa', 'South Korea', 'Spain', 'Sri Lanka', 'Sweden', 'Switzerland', 'Syria', 'Taiwan', 'Thailand',
  'Tunisia', 'Turkey', 'Türkiye', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay',
  'Venezuela', 'Vietnam', 'Wales',
  // Common local-language country and region names
  'Alemania', 'Brasil', 'Bretaña', 'España', 'Estados Unidos', 'Francia', 'Galiza', 'Grecia', 'Inglaterra',
  'Irlanda', 'Italia', 'México', 'Países Bajos', 'Portugal', 'Reino Unido', 'Suiza',
  // Widely encountered cities
  'Amsterdam', 'Athens', 'Atlanta', 'Auckland', 'Bangkok', 'Barcelona', 'Beijing', 'Berlin', 'Boston', 'Brussels',
  'Buenos Aires', 'Cairo', 'Chicago', 'Copenhagen', 'Dublin', 'Edinburgh', 'Geneva', 'Helsinki', 'Hong Kong',
  'Istanbul', 'Jakarta', 'Jerusalem', 'Johannesburg', 'Kyiv', 'Lisbon', 'London', 'Los Angeles', 'Lyon', 'Madrid',
  'Melbourne', 'Mexico City', 'Miami', 'Milan', 'Montreal', 'Moscow', 'Mumbai', 'Munich', 'Nairobi', 'New York',
  'Oslo', 'Ottawa', 'Paris', 'Prague', 'Reykjavik', 'Rio de Janeiro', 'Rome', 'San Francisco', 'Santiago',
  'São Paulo', 'Seoul', 'Shanghai', 'Singapore', 'Stockholm', 'Sydney', 'Tokyo', 'Toronto', 'Vancouver', 'Vienna',
  'Warsaw', 'Washington', 'Zurich',
  // Spain: autonomous communities, provinces and commonly cited cities
  'A Coruña', 'Alacant', 'Alicante', 'Almería', 'Asturias', 'Ávila', 'Badajoz', 'Baleares', 'Barcelona',
  'Bizkaia', 'Burgos', 'Cáceres', 'Cádiz', 'Cantabria', 'Castellón', 'Ceuta', 'Ciudad Real', 'Córdoba',
  'Cuenca', 'Girona', 'Granada', 'Guadalajara', 'Guipúzcoa', 'Huelva', 'Huesca', 'Jaén', 'La Rioja', 'León',
  'Lleida', 'Lugo', 'Madrid', 'Málaga', 'Melilla', 'Murcia', 'Navarra', 'Ourense', 'Palencia', 'Pontevedra',
  'Salamanca', 'Santa Cruz de Tenerife', 'Segovia', 'Sevilla', 'Soria', 'Tarragona', 'Teruel', 'Toledo',
  'Valencia', 'Valladolid', 'Zamora', 'Zaragoza',
  'Andalucía', 'Aragón', 'Canarias', 'Castilla-La Mancha', 'Castilla y León', 'Cataluña', 'Comunidad de Madrid',
  'Comunidad Valenciana', 'Extremadura', 'Galicia', 'La Rioja', 'País Vasco', 'Región de Murcia',
  'Illes Balears', 'Islas Baleares', 'País Valencià',
  // Common Galician place names
  'Santiago de Compostela', 'Vigo', 'Ferrol', 'Vilagarcía de Arousa', 'Narón', 'Oleiros', 'Carballo', 'Ribeira',
  'Redondela', 'Ponteareas', 'Marín', 'Cangas', 'Ames', 'Culleredo', 'Cambre', 'Lalín', 'Monforte de Lemos',
  'O Barco de Valdeorras', 'Verín', 'Xinzo de Limia',
] as const;

const escape = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PLACE_REGEX = new RegExp(
  `(?<![\\p{L}\\p{M}\\p{N}_])(?:${[...new Set(PLACES)].sort((a, b) => b.length - a.length).map(escape).join('|')})(?![\\p{L}\\p{M}\\p{N}_])`,
  'giu',
);

// A handful of gazetteer entries are also common names or ordinary words. They
// need an explicit geographic cue and must not be peeled off a following
// capitalized name (for example, "Jordan Smith").
const AMBIGUOUS = new Set([
  'Chad', 'Georgia', 'Jordan', 'Malta', 'Marín', 'Paris', 'Rome', 'Santiago', 'Turkey', 'Washington', 'Victoria',
].map((place) => place.toLowerCase()));
const GEO_CUE = /(?:\b(?:in|from|to|at|near|within|around|visiting|en|desde|hacia|provincia|ciudad|país|países|estado|región|cidade|país|na|para|em)\s+|\b(?:city|country|province|state|region)\s+(?:of\s+)?|\b(?:país|provincia|cidade|estado|región)\s+de\s+)$/iu;
const FOLLOWING_NAME = /^\s+\p{Lu}\p{L}+/u;

const SPANISH_LOCALITIES = [
  'A Coruña', 'Alacant', 'Alicante', 'Almería', 'Asturias', 'Ávila', 'Badajoz', 'Baleares', 'Barcelona',
  'Bizkaia', 'Burgos', 'Cáceres', 'Cádiz', 'Cantabria', 'Castellón', 'Ceuta', 'Ciudad Real', 'Córdoba',
  'Cuenca', 'Girona', 'Granada', 'Guadalajara', 'Guipúzcoa', 'Huelva', 'Huesca', 'Jaén', 'La Rioja', 'León',
  'Lleida', 'Lugo', 'Madrid', 'Málaga', 'Melilla', 'Murcia', 'Navarra', 'Ourense', 'Palencia', 'Pontevedra',
  'Salamanca', 'Santa Cruz de Tenerife', 'Segovia', 'Sevilla', 'Soria', 'Tarragona', 'Teruel', 'Toledo',
  'Valencia', 'Valladolid', 'Zamora', 'Zaragoza', 'Andalucía', 'Aragón', 'Canarias', 'Castilla-La Mancha',
  'Castilla y León', 'Cataluña', 'Comunidad de Madrid', 'Comunidad Valenciana', 'Extremadura', 'Galicia',
  'País Vasco', 'Región de Murcia', 'Santiago de Compostela', 'Vigo', 'Ferrol', 'Vilagarcía de Arousa',
  'Narón', 'Oleiros', 'Carballo', 'Ribeira', 'Redondela', 'Ponteareas', 'Marín', 'Cangas', 'Ames', 'Culleredo',
  'Cambre', 'Lalín', 'Monforte de Lemos', 'O Barco de Valdeorras', 'Verín', 'Xinzo de Limia',
];
const SPANISH_LOCALITY_REGEX = SPANISH_LOCALITIES
  .sort((a, b) => b.length - a.length)
  .map(escape)
  .join('|');

/** Detects a Spanish postal address fragment only when the code is anchored. */
export const detectSpanishPostalAddressFragments = (text: string): DetectedSpan[] => {
  const spans: DetectedSpan[] = [];
  const withLocality = new RegExp(`\\b\\d{5}[ \\t]+(?:${SPANISH_LOCALITY_REGEX})\\b`, 'giu');
  let match: RegExpExecArray | null;
  while ((match = withLocality.exec(text)) !== null) {
    spans.push({
      start: match.index,
      end: match.index + match[0].length,
      category: 'ADDRESS',
      text: match[0],
      confidence: 1,
      source: 'regex',
      rung: RUNG.ADDRESS,
    });
  }

  const labeled = /\b(?:CP|C\.?P\.?|código\s+postal|postal\s+code)\s*:?\s*(\d{5})\b/giu;
  while ((match = labeled.exec(text)) !== null) {
    const start = match.index + match[0].lastIndexOf(match[1]);
    spans.push({
      start,
      end: start + match[1].length,
      category: 'ADDRESS',
      text: match[1],
      confidence: 1,
      source: 'regex',
      rung: RUNG.ADDRESS,
    });
  }
  return spans;
};

/** Detects place names from the built-in offline vocabulary. */
export const detectLocations = (text: string): DetectedSpan[] => {
  const spans: DetectedSpan[] = [];
  const regex = new RegExp(PLACE_REGEX);
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const before = text.slice(Math.max(0, match.index - 32), match.index);
    const after = text.slice(match.index + match[0].length);
    if (AMBIGUOUS.has(match[0].toLowerCase()) && (!GEO_CUE.test(before) || FOLLOWING_NAME.test(after))) continue;
    spans.push({
      start: match.index,
      end: match.index + match[0].length,
      category: 'LOCATION',
      text: match[0],
      confidence: 0.9,
      source: 'regex',
      rung: RUNG.LOCATION,
    });
  }
  return spans;
};
