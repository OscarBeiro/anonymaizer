import type { DetectorLexicon } from './lexicons';

/** Basque (euskara) lexical pack. Basque puts the institution word last ("Donostiako Udala"), so those heads are company suffixes. */
export const BASQUE_PACK = {
  id: 'eu',
  greetings: ['Kaixo', 'Agur', 'Egun', 'Arratsalde', 'Gau', 'Eskerrik', 'Adeitasunez', 'Agurtzen'],
  stopwords: ['Astelehena', 'Asteartea', 'Asteazkena', 'Osteguna', 'Ostirala', 'Larunbata', 'Igandea', 'Urtarrila', 'Otsaila', 'Martxoa', 'Apirila', 'Maiatza', 'Ekaina', 'Uztaila', 'Abuztua', 'Iraila', 'Urria', 'Azaroa', 'Abendua', 'Kaixo', 'Agur', 'Egun', 'Arratsalde', 'Gau', 'Eskerrik', 'Adeitasunez', 'Agurtzen', 'Eta', 'Baina', 'Ere', 'Edo', 'Hau', 'Hori', 'Hura'],
  companyPrefixes: ['Eusko', 'Fundazio', 'Elkarte', 'Banku'],
  nameParticles: ['de', 'del', 'de la', 'y', 'eta'],
} as const;

export const BASQUE_LEXICON: DetectorLexicon = {
  companySuffixes: ['S\\.Koop\\.', 'S\\.L\\.', 'S\\.A\\.', 'Kooperatiba', 'Fundazioa', 'Elkartea', 'Unibertsitatea', 'Aldundia', 'Udala', 'Saila', 'Taldea', 'SL', 'SA'],
  companyPrefixes: [...BASQUE_PACK.companyPrefixes],
  acronymExclusions: ['IVA', 'IRPF', 'NIF', 'DNI', 'NAN', 'IFZ', 'IBAN', 'SEPA', 'PDF', 'URL', 'API', 'OK', 'NDA', 'SLA', 'RGPD', 'LOPD', 'EHAA', 'BOE', 'EB', 'UE', 'EU', 'CEO', 'ONG', 'EUR', 'ID', 'PIN', 'SMS', 'USB'],
  nameParticles: [...BASQUE_PACK.nameParticles],
  stopwords: [...BASQUE_PACK.stopwords],
  titleLexemes: ['Psikologoa', 'Medikua', 'Abokatua', 'Ingeniaria', 'Graduatua', 'Lizentziatua', 'Gizarte Langilea', 'Teknikaria', 'Zuzendaria', 'Kudeatzailea', 'Lehendakaria', 'Idazkaria', 'Arduraduna', 'Koordinatzailea', 'Administratzailea'],
  structureHeads: ['Txostena', 'Espedientea', 'Ebaluazioa', 'Eranskina', 'Atala', 'Orrialdea', 'Gaia', 'Data', 'Erreferentzia', 'Dokumentua', 'Kapitulua', 'Abizenak', 'Izena', 'Telefonoa', 'Helbidea', 'Posta', 'Datuak', 'Laburpena', 'Ondorioak', 'Aurrekariak', 'Oharrak', 'Arrazoia', 'Bezeroa', 'Pazientea', 'Enpresa', 'Proiektua', 'Faktura', 'Kontratua', 'Akta', 'Eskaera', 'Erregistroa', 'Izenburua', 'Taula', 'Irudia', 'Sinadura'],
  letteredItemHeads: ['Puntua', 'Aukera', 'Plana', 'Artikulua', 'Klausula', 'Letra', 'Taldea', 'Mota', 'Eredua', 'Maila', 'Fasea', 'Eremua', 'Blokea', 'Zatia', 'Kasua'],
  honorifics: ['Jn', 'And', 'Dr', 'Dra', 'Prof', 'Sr', 'Sra'],
  legalHeads: ['Lege Organikoa', 'Errege Dekretua', 'Dekretua', 'Araudia', 'Zuzentaraua', 'Hitzarmena', 'Estatutua', 'Agindua', 'Ebazpena', 'Epaia', 'Legea', 'artikulua', 'art\\.'],
  legalContinuation: '(?:\\p{Lu}\\p{L}*|\\d+(?:\\/(?:\\d+|CE|UE))*)',
  titleQualifiers: ['Orokorra', 'Sanitarioa', 'Klinikoa', 'Forentsea', 'Soziala', 'Titularra'],
  institutionHeads: ['Gizarte Segurantza', 'Zerga Agentzia', 'Ogasuna', 'Ministerioa', 'Eusko Jaurlaritza', 'Legebiltzarra', 'Ertzaintza'],
  institutionContinuation: '(?:\\p{Lu}\\p{L}*|\\d+)',
  streetKeywords: ['Kalea', 'Etorbidea', 'Plaza', 'Pasealekua', 'Bidea', 'Zumardia'],
};
