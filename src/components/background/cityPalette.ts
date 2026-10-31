// Ref: plan-fase7-pantallas.md D-P1 (la ciudad es una ilustración: sus colores viven SOLO en este archivo, con paleta
// de día y de noche; excepción de DF7-11 con ese motivo) y D-P4 (la de noche, cuando el tema sea oscuro);
// sistema-visual-paxfide-web-enmienda-1.md R-F6 (versión oscura propia, no un filtro). Sin texto encima (R-F1), así
// que la regla de pares de contraste no aplica. Valores tomados de paxfide-home.html.

type Box = { top: string; left: string; right: string };

export interface CityPalette {
  sky: readonly (readonly [number, string])[];
  star: string;
  shadow: (a: number) => string;
  grass: string; soilLeft: string; soilRight: string;
  meadowLight: string; meadowDark: string; transparent: string;
  path: string; sand: string; water: string; waterChannel: string;
  stream: (a: number) => string;
  roadEdge: string; road: string; roadLine: string;
  bridge: Box;
  plazaOrg: Box; plazaHub: Box; plazaHome: Box; plazaHomeInner: Box; plazaVilla: Box; plazaSchool: Box; plazaRiver: Box;
  court: string; courtLine: string; deck: Box;
  flowers: readonly [string, string, string, string, string];
  tuftBlades: readonly [string, string, string];
  tuftGlint: string;
  trees: Record<'shade' | 'guayacan' | 'jacaranda' | 'pine', { trunk: string; canopy: readonly [string, string, string] }>;
  palmTrunk: string; palmLeaves: readonly [string, string, string, string];
  bush: string; bushAlt: string; bushHighlight: string;
  lampPole: string; lampBulb: string; lampGlow: (a: number) => string; lampGlowEnd: string;
  windowLit: (a: number) => string; windowOff: string;
  liveries: readonly { cargo: Box; cab: Box }[];
  headlight: (a: number) => string; headlightEnd: string;
  people: readonly [string, string, string, string, string];
  personBody: string | null; personHead: string;
  cloud: string; cloudShadow: number;
  // Edificios y objetos de cada barrio
  orgBase: Box; orgTop: Box; mill: string; millBlade: string; millHub: string;
  hubBase: Box; hubPanel: Box; crateGate: Box; crate1: Box; crate2: Box; crate3: Box;
  tower: Box; towerBlock: Box; wave: (a: number) => string;
  hall: Box; hallRoof: Box; hallTower: Box; hallTowerRoof: Box; clockFace: string; clockHands: string;
  fountain: Box; fountainInner: Box; jet: string; drops: string;
  house: Box; houseRoof: Box; smoke: (a: number) => string;
  school: Box; schoolPanel: Box; ball: string; mast: string; tank: Box;
  riverHouse: Box; riverHouseRoof: Box;
  boatWake: string; boatHull: Box; boatCabin: Box;
  bird: string; butterflies: readonly [string, string, string, string];
  leaves: readonly [string, string, string];
  firefly: (a: number) => string; fireflyEnd: string;
  tagBlue: string; tagGreen: string; tagYellow: string;
  tagDarkBg: string; tagBorder: string; tagTextLight: string; tagTextDark: string;
}

const LIVERIES = [
  { cargo: { top: '#F8CF7E', left: '#D9962C', right: '#F3B544' }, cab: { top: '#4E9155', left: '#1B5141', right: '#20604C' } },
  { cargo: { top: '#8CC3DE', left: '#255E79', right: '#327DA2' }, cab: { top: '#EBF5F9', left: '#B8D4E3', right: '#9BC0D4' } },
  { cargo: { top: '#A8D5AE', left: '#2E7550', right: '#4E9155' }, cab: { top: '#F3B544', left: '#D9962C', right: '#785008' } },
] as const;

/** Lo que no cambia entre el día y la noche (en el prototipo no pasa por `pick`). */
const SHARED = {
  shadow: (a: number) => `rgba(18,38,28,${a})`,
  transparent: 'rgba(0,0,0,0)',
  lampGlow: (a: number) => `rgba(249,199,94,${a})`, lampGlowEnd: 'rgba(249,199,94,0)',
  windowLit: (a: number) => `rgba(249,199,94,${a})`,
  liveries: LIVERIES,
  headlight: (a: number) => `rgba(255,245,190,${a})`, headlightEnd: 'rgba(255,245,190,0)',
  people: ['#F3B544', '#327DA2', '#E86A5C', '#4E9155', '#B395E0'],
  court: '#327DA2', courtLine: '#EBF5F9',
  deck: { top: '#C68B59', left: '#8B5A2B', right: '#6E4720' },
  millBlade: '#F8FAFA', millHub: '#F3B544',
  hubPanel: { top: '#8CC3DE', left: '#255E79', right: '#3688B0' },
  crateGate: { top: '#F3B544', left: '#D9962C', right: '#785008' },
  crate1: { top: '#F8CF7E', left: '#D9962C', right: '#F3B544' },
  crate2: { top: '#A8D5AE', left: '#20604C', right: '#4E9155' },
  crate3: { top: '#8CC3DE', left: '#255E79', right: '#327DA2' },
  tower: { top: '#255E79', left: '#1B5141', right: '#133B2F' },
  towerBlock: { top: '#F8CF7E', left: '#F3B544', right: '#D9962C' },
  wave: (a: number) => `rgba(243,181,68,${a})`,
  hallRoof: { top: '#F3B544', left: '#D9962C', right: '#9E6B14' },
  hallTowerRoof: { top: '#F8CF7E', left: '#F3B544', right: '#B87D19' },
  clockFace: '#FFFFFF', clockHands: '#1B5141',
  fountain: { top: '#3688B0', left: '#20604C', right: '#1B5141' },
  fountainInner: { top: '#79BFDF', left: '#255E79', right: '#1E4E63' },
  jet: '#EBF5F9', drops: 'rgba(235,245,249,.9)',
  houseRoof: { top: '#4E9155', left: '#2E7550', right: '#1B5141' },
  smoke: (a: number) => `rgba(240,245,240,${a})`,
  schoolPanel: { top: '#3688B0', left: '#255E79', right: '#1B4357' },
  ball: '#F3B544', mast: '#8FAFAF',
  tank: { top: '#79BFDF', left: '#327DA2', right: '#255E79' },
  riverHouseRoof: { top: '#F3B544', left: '#D9962C', right: '#9E6B14' },
  boatWake: 'rgba(235,245,249,.6)',
  boatHull: { top: '#FAFDF9', left: '#255E79', right: '#1B5141' },
  boatCabin: { top: '#F8CF7E', left: '#D9962C', right: '#F3B544' },
  butterflies: ['#F3B544', '#FFFFFF', '#B395E0', '#E86A5C'],
  leaves: ['#F3B544', '#5CB868', '#F8CF7E'],
  firefly: (a: number) => `rgba(255,235,120,${a})`, fireflyEnd: 'rgba(255,235,120,0)',
  tuftGlint: 'rgba(236,255,210,.85)',
  bushAlt: '#59B36C',
  tagBlue: '#3688B0',
  tagGreen: '#4E9155',
  tagYellow: '#F3B544',
  tagDarkBg: 'rgba(16,38,29,.85)',
  tagBorder: 'rgba(255,255,255,.25)',
  tagTextLight: '#FFFFFF',
  tagTextDark: '#1B5141',
} as const;

const plaza = (top: string, left = '#20604C', right = '#1B5141'): Box => ({ top, left, right });

export const CITY_DAY: CityPalette = {
  ...SHARED,
  sky: [[0, '#E4F2F7'], [0.55, '#E6F2DE'], [1, '#C6DEBB']],
  star: '#EEF6EF',
  grass: '#5DAE69', soilLeft: '#8A6B47', soilRight: '#6E5236',
  meadowLight: 'rgba(120,196,110,.55)', meadowDark: 'rgba(58,130,70,.45)',
  path: '#D6C6A3', sand: '#CDBF9F', water: '#2D81AA', waterChannel: 'rgba(121,191,223,.35)',
  stream: (a) => `rgba(255,255,255,${a})`,
  roadEdge: '#C7D4CA', road: '#556960', roadLine: 'rgba(255,255,255,.7)',
  bridge: { top: '#33473C', left: '#255E79', right: '#1B5141' },
  plazaOrg: plaza('#C9E0C1'), plazaHub: plaza('#D5E0E3', '#255E79', '#1B4357'), plazaHome: plaza('#EBF3E6'),
  plazaHomeInner: plaza('#DCEAD5', '#4E9155', '#20604C'), plazaVilla: plaza('#D6E8CE'), plazaSchool: plaza('#D9EAD2'),
  plazaRiver: plaza('#D5E8CE'),
  flowers: ['#F3B544', '#FFFFFF', '#E86A5C', '#B395E0', '#F8CF7E'],
  tuftBlades: ['#3E8C47', '#6BBE72', '#4FA058'],
  trees: {
    shade: { trunk: '#6B482A', canopy: ['#2E723D', '#419652', '#59B36C'] },
    guayacan: { trunk: '#5E3E20', canopy: ['#D9962C', '#F3B544', '#F8CF7E'] },
    jacaranda: { trunk: '#4A3326', canopy: ['#6C4F94', '#8E6CBF', '#B395E0'] },
    pine: { trunk: '#5B3A1E', canopy: ['#1F5E3A', '#2E7550', '#3E8C5A'] },
  },
  palmTrunk: '#8B5A2B', palmLeaves: ['#4E9155', '#2E7550', '#74B56C', '#20604C'],
  bush: '#4E9155', bushAlt: '#59B36C', bushHighlight: 'rgba(255,255,255,.18)',
  lampPole: '#405656', lampBulb: '#FFFFFF',
  windowOff: 'rgba(215,235,245,.92)',
  personBody: null, personHead: '#8B5A3C',
  cloud: 'rgba(255,255,255,.88)', cloudShadow: 0.07,
  orgBase: { top: '#4E9155', left: '#EBF5EC', right: '#CFE3D1' }, orgTop: { top: '#74B56C', left: '#D9ECF2', right: '#B7D8E6' },
  mill: '#FFFFFF',
  hubBase: { top: '#327DA2', left: '#EBF2F5', right: '#C9D9E0' },
  hall: { top: '#FAFDF9', left: '#F4F9F2', right: '#DAE6D6' }, hallTower: { top: '#FAFDF9', left: '#FFFFFF', right: '#E2ECE0' },
  house: { top: '#FAFDF9', left: '#F7FAF5', right: '#DCE8D8' },
  school: { top: '#255E79', left: '#FDF4E2', right: '#E8D6B5' },
  riverHouse: { top: '#FAFDF9', left: '#F4F9F2', right: '#D8E6D4' },
  bird: '#20604C',
};

export const CITY_NIGHT: CityPalette = {
  ...SHARED,
  sky: [[0, '#06110C'], [1, '#0E2419']],
  star: '#EEF6EF',
  grass: '#10291E', soilLeft: '#2A1E14', soilRight: '#1E150E',
  meadowLight: 'rgba(40,90,60,.35)', meadowDark: 'rgba(5,20,14,.4)',
  path: '#1F3529', sand: '#1E382C', water: '#14384A', waterChannel: 'rgba(40,100,130,.35)',
  stream: (a) => `rgba(121,191,223,${a * 0.5})`,
  roadEdge: '#13281E', road: '#1C382C', roadLine: 'rgba(243,181,68,.45)',
  bridge: { top: '#20382D', left: '#255E79', right: '#1B5141' },
  plazaOrg: plaza('#1B3F2F'), plazaHub: plaza('#1B333E', '#255E79', '#1B4357'), plazaHome: plaza('#1B3B2E'),
  plazaHomeInner: plaza('#234B3B', '#4E9155', '#20604C'), plazaVilla: plaza('#1B3A2D'), plazaSchool: plaza('#1D3B2E'),
  plazaRiver: plaza('#1B3D2F'),
  flowers: ['#F3B544', '#FFFFFF', '#E86A5C', '#B395E0', '#F8CF7E'],
  tuftBlades: ['#1E4A35', '#2B6145', '#22553C'],
  trees: {
    shade: { trunk: '#4A3423', canopy: ['#143B29', '#1C4E37', '#255E44'] },
    guayacan: { trunk: '#3E2914', canopy: ['#8B6816', '#B88B22', '#D9A42C'] },
    jacaranda: { trunk: '#33231A', canopy: ['#3D2D54', '#583F7A', '#74569C'] },
    pine: { trunk: '#3A2614', canopy: ['#0F2E1E', '#163D29', '#1E4D34'] },
  },
  palmTrunk: '#5A3A1C', palmLeaves: ['#1E4A35', '#173D2B', '#2B6145', '#123325'],
  bush: '#1C4A33', bushAlt: '#1E4A35', bushHighlight: 'rgba(255,255,255,.05)',
  lampPole: '#8FAFAF', lampBulb: '#F9C75E',
  windowOff: 'rgba(40,70,80,.9)',
  personBody: '#9FB8AE', personHead: '#C9D9D2',
  cloud: 'rgba(220,235,230,.14)', cloudShadow: 0.03,
  orgBase: { top: '#4E9155', left: '#1F4B38', right: '#153628' }, orgTop: { top: '#74B56C', left: '#255E79', right: '#1B465B' },
  mill: '#B8D0C5',
  hubBase: { top: '#327DA2', left: '#1D3E4F', right: '#142C38' },
  hall: { top: '#FAFDF9', left: '#214838', right: '#163327' }, hallTower: { top: '#FAFDF9', left: '#265340', right: '#1A3B2D' },
  house: { top: '#FAFDF9', left: '#244D3C', right: '#18362A' },
  school: { top: '#255E79', left: '#2D3E35', right: '#1F2C25' },
  riverHouse: { top: '#FAFDF9', left: '#234D3C', right: '#173629' },
  bird: '#A8D5AE',
};

/** En el prototipo, el día y la noche se cortan en 0,5 (`NIGHT(n)`); los brillos usan `n` continuo. */
export const cityPalette = (night: number): CityPalette => (night > 0.5 ? CITY_NIGHT : CITY_DAY);
