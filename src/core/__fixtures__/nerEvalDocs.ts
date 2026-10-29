import { parseAnnotated, type EvalDocument } from '../nerEval';

// Synthetic, invented people and companies; nothing here is real personal data.
// Written by the author of P39 and not yet reviewed by a native speaker of
// each language — acceptance numbers are therefore indicative, not final.
// `tuning` documents may be used to choose thresholds; `acceptance` ones must
// not influence any model setting.
const doc = (id: string, language: EvalDocument['language'], kind: string, split: EvalDocument['split'], annotated: string): EvalDocument =>
  ({ id, language, kind, split, ...parseAnnotated(annotated) });

export const NER_EVAL_DOCS: readonly EvalDocument[] = [
  // ---- Spanish
  doc('es-prose-1', 'es', 'prose', 'tuning',
    'Estimado {{NAME|Joaquín Beltrán Ortega}}: le escribimos desde {{COMPANY|Distribuciones Almaraz S.L.}} para confirmar su pedido. ' +
    'Enviaremos el paquete a {{ADDRESS|Calle del Olmo 14, 3º B}}, {{LOCATION|Valladolid}}. Su teléfono de contacto es {{PHONE|+34 983 112 204}} ' +
    'y su correo {{EMAIL|jbeltran@almaraz-demo.example}}. Su DNI {{ID|12345678Z}} consta en el expediente.'),
  doc('es-table-1', 'es', 'markdown-table', 'acceptance',
    '| Nombre | Ciudad | Teléfono |\n|---|---|---|\n| {{NAME|Carmen Soler Ruiz}} | {{LOCATION|Zaragoza}} | {{PHONE|976 555 018}} |\n' +
    '| {{NAME|Íñigo Larrea}} | {{LOCATION|Bilbao}} | {{PHONE|944 555 071}} |\n\nResponsable: {{NAME|Elvira Montes}}, de {{COMPANY|Hortalizas del Ebro S.A.}}.'),
  doc('es-ambiguous-1', 'es', 'ambiguous-names', 'tuning',
    'Hablé con {{NAME|Rosa}} sobre la rosa roja del jardín. {{NAME|Pilar Mena}} revisó el pilar de la entrada y el mar estaba en calma; ' +
    'después llamó a {{NAME|Mar Ibáñez}}. El sol de {{NAME|Soledad Ríos}} brillaba sobre el campo.'),
  doc('es-ocr-1', 'es', 'ocr', 'acceptance',
    'Informe de visita. Paciente: {{NAME|Mar1a Fern4ndez Gil}}. Domicilio: {{ADDRESS|Avda. de la Constituci0n 27}}, {{LOCATION|Sevilla}}. ' +
    'NIE {{ID|X1234567L}}. Atendida por la {{NAME|Dra. Beatriz Camacho}} en {{COMPANY|Clínica San Rafael S.A.}}.'),
  // ---- Galician
  doc('gl-prose-1', 'gl', 'prose', 'tuning',
    'Boa tarde, {{NAME|Xoán Carballo Pena}}. Escribímoslle desde {{COMPANY|Conservas Rías Baixas S.L.}} para confirmar a entrega en ' +
    '{{ADDRESS|Rúa do Castro 8, 2º}}, {{LOCATION|Pontevedra}}. Pode chamar ao {{PHONE|986 120 334}} ou escribir a {{EMAIL|xcarballo@riasbaixas-demo.example}}. ' +
    'O seu DNI {{ID|87654321X}} xa está rexistrado.'),
  doc('gl-list-1', 'gl', 'names-list', 'acceptance',
    'Asistentes á reunión:\n- {{NAME|Uxía Seoane}}\n- {{NAME|Brais Taboada Lema}}\n- {{NAME|Noelia Rouco}}\n- {{NAME|Anxo Vilariño}}\n\n' +
    'A xuntanza foi en {{LOCATION|Ourense}}, na sede de {{COMPANY|Cooperativa Miño Vivo}}.'),
  doc('gl-ambiguous-1', 'gl', 'ambiguous-names', 'tuning',
    'Falei con {{NAME|Rosa}} sobre a rosa do xardín. {{NAME|Mar Castro}} mirou o mar desde o peirao de {{LOCATION|Muros}}, e {{NAME|Sol Prieto}} agardaba ao sol.'),
  doc('gl-url-1', 'gl', 'url-and-contact', 'acceptance',
    'Consulte https://rexistro-demo.example/expediente/4471 ou escriba a {{EMAIL|lucia.paz@concello-demo.example}}. ' +
    'Atendeuna {{NAME|Lucía Paz Outeiro}} do {{COMPANY|Concello de Betanzos}}, en {{ADDRESS|Praza da Constitución 1}}.'),
  // ---- Portuguese
  doc('pt-prose-1', 'pt', 'prose', 'tuning',
    'Caro {{NAME|António Ferreira Lopes}}, escrevemos da {{COMPANY|Transportes Douro Lda.}} para confirmar a entrega na ' +
    '{{ADDRESS|Rua das Flores 45, 2.º Esq.}}, {{LOCATION|Porto}}. Contacte-nos pelo {{PHONE|+351 222 334 455}} ou {{EMAIL|aferreira@douro-demo.example}}. ' +
    'O seu NIF {{ID|123456789}} consta do processo.'),
  doc('pt-table-1', 'pt', 'markdown-table', 'acceptance',
    '| Nome | Cidade |\n|---|---|\n| {{NAME|Inês Carvalho}} | {{LOCATION|Coimbra}} |\n| {{NAME|Tiago Mendonça}} | {{LOCATION|Faro}} |\n\n' +
    'Gestora do contrato: {{NAME|Margarida Sá Pinto}}, da {{COMPANY|Azeites do Alentejo S.A.}}.'),
  doc('pt-ambiguous-1', 'pt', 'ambiguous-names', 'tuning',
    'Falei com {{NAME|Rosa}} sobre a rosa vermelha. {{NAME|Luz Teixeira}} ligou a luz do corredor e {{NAME|Esperança Dias}} falou da esperança de todos.'),
  doc('pt-ocr-1', 'pt', 'ocr', 'acceptance',
    'Relat0rio clínico. Utente: {{NAME|J0ão Batista Rocha}}. Morada: {{ADDRESS|Travessa do Carmo 9}}, {{LOCATION|Braga}}. ' +
    'Seguimento na {{COMPANY|Clínica Santa Luzia Lda.}} pela {{NAME|Dra. Helena Gouveia}}.'),
  // ---- English
  doc('en-prose-1', 'en', 'prose', 'tuning',
    'Dear {{NAME|Margaret Holloway}}, we are writing from {{COMPANY|Brightwater Logistics Ltd.}} to confirm delivery to ' +
    '{{ADDRESS|22 Elm Terrace, Flat 4}}, {{LOCATION|Leeds}}. Reach us on {{PHONE|+44 113 496 0123}} or {{EMAIL|mholloway@brightwater-demo.example}}. ' +
    'Your account {{ID|GB29NWBK60161331926819}} is on file.'),
  doc('en-list-1', 'en', 'names-list', 'acceptance',
    'Attendees:\n- {{NAME|Oliver Grant}}\n- {{NAME|Priya Natarajan}}\n- {{NAME|Dmitri Volkov}}\n\nMeeting held in {{LOCATION|Manchester}} at the offices of {{COMPANY|Harlow & Finch LLP}}.'),
  doc('en-ambiguous-1', 'en', 'ambiguous-names', 'tuning',
    'I spoke to {{NAME|Rose}} about the rose garden. {{NAME|April Stone}} said April would be wet, and {{NAME|Will Hart}} said he will visit the hart sanctuary.'),
  // ---- Catalan
  doc('ca-prose-1', 'ca', 'prose', 'tuning',
    'Estimat {{NAME|Jordi Puig Ferrer}}: li escrivim des de {{COMPANY|Conserves del Delta S.L.}} per confirmar el lliurament a ' +
    '{{ADDRESS|Carrer del Pi 14, 2n 1a}}, {{LOCATION|Girona}}. El seu telèfon de contacte és {{PHONE|972 555 013}} i el correu ' +
    '{{EMAIL|jpuig@delta-demo.example}}. El seu DNI {{ID|12345678Z}} consta a l\'expedient.'),
  doc('ca-list-1', 'ca', 'names-list', 'acceptance',
    'Assistents:\n- {{NAME|Núria Casals}}\n- {{NAME|Oriol Vilaseca Mas}}\n- {{NAME|Mireia Soler}}\n\n' +
    'La reunió va ser a {{LOCATION|Tarragona}}, a la seu de {{COMPANY|Cooperativa Camp Obert}}.'),
  // ---- Basque
  doc('eu-prose-1', 'eu', 'prose', 'tuning',
    'Agur {{NAME|Mikel Etxeberria Goikoetxea}}. Mezu hau {{COMPANY|Arrantzale Kooperatiba}} enpresak bidaltzen dizu entrega baieztatzeko: ' +
    '{{ADDRESS|Kale Nagusia 14, 2. ezk.}}, {{LOCATION|Donostia}}. Telefonoa {{PHONE|943 555 021}} eta posta {{EMAIL|metxeberria@arrantza-demo.example}}. ' +
    'Zure NANa {{ID|12345678Z}} espedientean dago.'),
  doc('eu-list-1', 'eu', 'names-list', 'acceptance',
    'Bileraren partaideak:\n- {{NAME|Amaia Zubiria}}\n- {{NAME|Iker Aranburu Lasa}}\n- {{NAME|Leire Olaizola}}\n\n' +
    'Bilera {{LOCATION|Gasteiz}}-en egin zen, {{COMPANY|Eroski Taldea}} egoitzan.'),
  doc('mixed-1', 'es', 'multilingual-paragraph', 'acceptance',
    'Resumen / Resumo / Summary. {{NAME|Carlos Vega}} (Madrid) escribió a {{NAME|Sara Neves}} em {{LOCATION|Lisboa}}; ' +
    'tamén copiaron a {{NAME|Martiño Lago}} in {{LOCATION|Vigo}}. Contact: {{EMAIL|c.vega@mixto-demo.example}}.'),
];
