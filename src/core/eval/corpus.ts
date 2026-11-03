// M06-02: hand-labelled evaluation documents. All people, IDs, accounts and
// addresses are invented; IDs and IBANs carry valid checksums so the rules
// treat them as real. Markup: see ./score.ts.
//
// Labelling policy (keep it consistent when adding documents):
// - NAME: every mention of a private person, including surname-only and
//   first-name-only mentions; honorifics (Dona, Sr., Dr.) stay outside.
// - ADDRESS: the whole street address (street, number, floor, door, postcode,
//   town). LOCATION?: towns/regions mentioned on their own — optional.
// - COMPANY: private companies a person deals with. Departments, schools,
//   hospitals, courts and banks are NOT labelled: hiding them is an
//   over-flag (they rarely identify anyone and hiding them hurts the text).
//   Public bodies the app hides as COMPANY by design (Concello, Deputación,
//   Universidade, Instituto…) are optional (`COMPANY?`), as are
//   institutional emails/phones.
// - MONEY?, ID_CODE?: optional — useful to hide, not personal on their own.
// - Dates, laws and citations are never labelled.

export interface CorpusDocument {
  id: string;
  lang: 'gl' | 'es' | 'en';
  markup: string;
}

export const CORPUS: CorpusDocument[] = [
  {
    id: 'gl-servizos-sociais',
    lang: 'gl',
    markup: `Concello de {LOCATION?|Lugo}
Departamento de Servizos Sociais

Asunto: Resolución da axuda de emerxencia social. Expediente {ID_CODE?|SS-2025/0412}.

Dona {NAME|María do Carme Fernández Rodríguez}, con DNI {DNI|33445566R}, veciña da {ADDRESS|rúa do Progreso, 14, 2º esquerda, 27001 Lugo}, presentou a solicitude o día 3 de marzo de 2025.
O seu fillo, {NAME|Xoán Castro Fernández}, de 12 anos, está escolarizado no CEIP Rosalía de Castro.
A traballadora social, {NAME|Uxía Pereira Lamas}, emitiu informe favorable. O expediente foi revisado por {NAME|Brais Otero}.
Para calquera dúbida pode contactar co teléfono {PHONE?|982 297 100} ou no correo {EMAIL?|servizossociais@concellodelugo.gal}.
A contía de {MONEY?|1.200,00 €} ingresarase na conta {IBAN|ES9121000418450200051332} da Caixa Rural Galega.
Asinado en {LOCATION?|Lugo}, a 15 de abril de 2025.
O Alcalde, {NAME|Miguel Fernández Méndez}
Segundo a Lei 13/2008, do 3 de decembro, de servizos sociais de Galicia, e o Decreto 99/2012.
Nota: a Sra. {NAME|Fernández} debe achegar o certificado de empadroamento antes do 30 de maio.`,
  },
  {
    id: 'gl-informe-clinico',
    lang: 'gl',
    markup: `Servizo Galego de Saúde
Complexo Hospitalario Universitario de Santiago
Servizo de Medicina Interna

INFORME DE ALTA

Paciente: {NAME|Antía Varela Souto}
Data de nacemento: 14/02/1961
NHC: {ID_CODE?|1048833}
Enderezo: {ADDRESS|Avenida de Lugo, 112, 5º B, 15702 Santiago de Compostela}
Teléfono de contacto: {PHONE|636 412 908}

A paciente ingresa por febre e tose de cinco días de evolución. Acompáñaa o seu marido, {NAME|Manuel Rei Castiñeiras}, que achega a medicación habitual.
Antecedentes: hipertensión arterial en tratamento co Dr. {NAME|Suárez}, do Centro de Saúde de Conxo.
Durante o ingreso a {NAME|Antía} evoluciona favorablemente con antibioterapia intravenosa.
Diagnóstico principal: pneumonía adquirida na comunidade.
Revisión en consulta externa coa Dra. {NAME|Lorenzo Pazos} en catro semanas.

Médico responsable: Dr. {NAME|Diego Míguez Bouzas}. Nº colexiado {ID_CODE?|151509876}.`,
  },
  {
    id: 'gl-contrato-arrendamento',
    lang: 'gl',
    markup: `CONTRATO DE ARRENDAMENTO DE VIVENDA

En {LOCATION?|Vigo}, a 1 de setembro de 2024.

REUNIDOS

Dunha parte, como ARRENDADOR, don {NAME|Ramón Costas Iglesias}, maior de idade, con DNI {DNI|44556677L} e domicilio na {ADDRESS|praza de Compostela, 7, 3º, 36201 Vigo}.
Doutra parte, como ARRENDATARIA, dona {NAME|Sabela Domínguez Vilas}, con NIE {NIE|X1234567L}, e correo electrónico {EMAIL|sabela.dominguez@gmail.com}.

EXPOÑEN

I. Que o señor {NAME|Costas} é propietario da vivenda situada na {ADDRESS|rúa de Urzaiz, 85, 4º D, 36204 Vigo}, inscrita no Rexistro da Propiedade nº 2 de {LOCATION?|Vigo}.
II. Que a renda mensual será de {MONEY?|650 euros}, que a arrendataria aboará mediante transferencia á conta {IBAN|ES7320800000123456789012}.
III. Que a fianza, equivalente a unha mensualidade, depositarase no {COMPANY?|Instituto Galego da Vivenda e Solo} segundo a Lei 29/1994, de arrendamentos urbanos.

E en proba de conformidade, asinan {NAME|Ramón Costas Iglesias} e {NAME|Sabela Domínguez Vilas}.`,
  },
  {
    id: 'gl-correo',
    lang: 'gl',
    markup: `Asunto: Re: reunión do venres

Ola {NAME|Iria},

grazas polo resumo. Falei con {NAME|Roi} e confirmou que pode vir ás 10:00. O cliente, {COMPANY|Conservas Miñoto S.L.}, quere pechar o orzamento antes de final de mes.
Se hai algún problema chámame ao {PHONE|699 123 456} ou escríbelle directamente a {NAME|Noa Barreiro} ({EMAIL|noa.barreiro@conservasminoto.gal}).

Unha aperta,
{NAME|Martiño Lago}
Xefe de proxecto
{COMPANY|Deseño Atlántico S.L.} · {ADDRESS|Avenida de Madrid, 23, baixo, 15009 A Coruña}`,
  },
  {
    id: 'gl-acta-comunidade',
    lang: 'gl',
    markup: `ACTA DA XUNTA ORDINARIA DA COMUNIDADE DE PROPIETARIOS
{ADDRESS|Rúa da Raíña, 21, 15001 A Coruña}

Asistentes: {NAME|Carmela Novo Pena} (1º A), {NAME|Xosé Manuel Bermúdez} (2º B), {NAME|Lucía Rial} (3º A) e, en representación da administración de fincas {COMPANY|Xestión Integral Miño S.L.}, {NAME|Paulo Seoane}.

1. O presidente, {NAME|Xosé Manuel Bermúdez}, informa da reparación do tellado, orzada en {MONEY?|8.400 €}.
2. A veciña do 3º A, {NAME|Lucía Rial}, reclama a débeda pendente do baixo comercial.
3. Acórdase domiciliar as cotas na conta {IBAN|ES6000491500051234567892}.

Sen máis asuntos que tratar, levántase a sesión. O secretario, {NAME|Bermúdez}, dá fe.`,
  },
  {
    id: 'gl-escola',
    lang: 'gl',
    markup: `IES Eduardo Pondal
Departamento de Orientación

Estimada familia:

Comunicámoslles que o alumno {NAME|Breixo Ares Lema}, do grupo 2º ESO B, faltou ás clases os días 10, 11 e 12 de febreiro.
Pregamos que a nai, {NAME|Olalla Lema Toural}, ou o pai, {NAME|Andrés Ares}, se poñan en contacto coa titora, {NAME|Rebeca Mosquera}, no teléfono {PHONE?|981 512 400}.
Lembramos que segundo o protocolo da Consellería de Educación as faltas deben xustificarse nun prazo de tres días.

Atentamente,
A xefa de estudos, {NAME|Montserrat Gil Taboada}`,
  },
  {
    id: 'gl-factura',
    lang: 'gl',
    markup: `FACTURA Nº {ID_CODE?|2025-0187}

Emisor: {COMPANY|Carpintaría Fontán S.L.} · CIF {VAT_NUMBER|B15123458}
{ADDRESS|Estrada de Santiago, km 4, 15895 Ames}

Cliente: {NAME|Uxío Figueiras Castro} · DNI {DNI|76543210S}
{ADDRESS|Lugar de Bertamiráns, 33, 15220 Ames}

Concepto: substitución de fiestras de aluminio.
Base impoñible: {MONEY?|2.300,00 €} · IVE 21 %: {MONEY?|483,00 €} · Total: {MONEY?|2.783,00 €}
Forma de pagamento: transferencia a {IBAN|ES9420805801101234567891} (Abanca).`,
  },
  {
    id: 'gl-denuncia',
    lang: 'gl',
    markup: `Policía Local de {LOCATION?|Ourense}

COMPARECENCIA

Na dependencia policial comparece {NAME|Rosalía Vázquez Nóvoa}, con DNI {DNI|35987412W}, con domicilio en {ADDRESS|Travesía de Vigo, 5, 2º, 32003 Ourense} e teléfono {PHONE|611 222 333}.
Manifesta que o día 2 de xuño, arredor das 22:00, no {ADDRESS|camiño do Vao, 18, 32005 Ourense}, o seu veciño {NAME|Alberte Prieto} lle causou danos no vehículo.
Como testemuña cita a {NAME|Daniel Cid Feijoo}, empregado de {COMPANY|Talleres Auria S.L.}.
O axente instrutor, con número {ID_CODE?|OU-4417}, dá traslado ao Xulgado de Instrución nº 1 de {LOCATION?|Ourense} segundo o artigo 13 da Lei de Enxuizamento Criminal.`,
  },
  {
    id: 'es-demanda',
    lang: 'es',
    markup: `AL JUZGADO DE PRIMERA INSTANCIA DE {LOCATION?|MADRID}

Doña {NAME|Elena Martín Robles}, Procuradora de los Tribunales, en nombre y representación de don {NAME|Javier Ortega Sanz}, mayor de edad, con DNI {DNI|32654789X} y domicilio en {ADDRESS|calle de Alcalá, 214, 3º izquierda, 28028 Madrid}, ante el Juzgado comparezco y DIGO:

Que interpongo DEMANDA de juicio verbal contra la mercantil {COMPANY|Reformas Castellanas S.L.}, con CIF {VAT_NUMBER|B27654326}, en reclamación de {MONEY?|4.850 euros}.

HECHOS

Primero.- El señor {NAME|Ortega} contrató con la demandada la reforma de su cocina, abonando el importe mediante transferencia desde la cuenta {IBAN|ES1730700010231234567890} de Caja Rural.
Segundo.- Según el artículo 1101 del Código Civil, quedan sujetos a la indemnización de los daños quienes incurran en dolo o negligencia.

Firmado: {NAME|Elena Martín Robles}`,
  },
  {
    id: 'es-email-rrhh',
    lang: 'es',
    markup: `Hola {NAME|Marta},

te paso los datos del nuevo fichaje para el alta en la Seguridad Social:
- Nombre: {NAME|Andrés Gil Navarro}
- NIE: {NIE|Y7654321G}
- Teléfono: {PHONE|+34 655 987 321}
- Correo: {EMAIL|andres.gil.navarro@outlook.es}
- Domicilio: {ADDRESS|avenida de la Constitución, 45, 1º C, 41001 Sevilla}
- Cuenta para la nómina: {IBAN|ES7900810216870001234567}

Empieza el lunes en el equipo de {NAME|Raúl}. Avísame si falta algo.

Un saludo,
{NAME|Pilar Esteban}
Departamento de Recursos Humanos`,
  },
  {
    id: 'es-informe-clinico',
    lang: 'es',
    markup: `Hospital Universitario La Paz
Servicio de Cardiología

Paciente: {NAME|Francisco Javier Moreno Díaz}, 67 años.
DNI: {DNI|53112233N}

Motivo de consulta: dolor torácico. Acude acompañado de su hija, {NAME|Cristina Moreno}.
Antecedentes: diabetes mellitus tipo 2 en seguimiento por la Dra. {NAME|Herrera} en el Centro de Salud de Chamberí.
Plan: ecocardiograma y revisión en tres meses. Contacto: {PHONE|617 445 102}.

Fdo.: Dr. {NAME|Luis Navarro Pastor}`,
  },
  {
    id: 'en-hr-email',
    lang: 'en',
    markup: `Hi {NAME|Sarah},

Following up on our call with {NAME|James Whitaker} from {COMPANY|Brightline Logistics Ltd}. He confirmed the contract renewal and asked that invoices go to {EMAIL|j.whitaker@brightline-logistics.co.uk}.
Please also update the emergency contact for {NAME|Tom Ellis}: his partner {NAME|Olivia Grant}, phone {PHONE|+44 7700 900123}.
The Department of Finance will review the budget on Monday.

Best regards,
{NAME|Daniel Hughes}
Operations Manager`,
  },
  {
    id: 'en-letter',
    lang: 'en',
    markup: `Dear Mr {NAME|Patel},

Thank you for your letter regarding the property at {ADDRESS|14 Elm Grove, Bristol BS6 7JT}.
Our surveyor, {NAME|Rachel Moore}, will visit on 12 May. If that is not convenient, please call her on {PHONE|0117 496 0123}.
Under the Landlord and Tenant Act 1985 we are responsible for repairs to the structure and exterior.

Yours sincerely,
{NAME|Michael Barnes}
{COMPANY|Harbourside Lettings Ltd}`,
  },
];
