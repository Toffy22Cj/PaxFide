// Ref: plan-fase7-pantallas.md D-P1 (el mundo de la landing es una ilustración: sus colores viven SOLO en este
// archivo, con paleta de día y de noche; excepción de DF7-11 con ese motivo) y D-P4 (la de noche, cuando el tema sea
// oscuro); sistema-visual-paxfide-web-enmienda-1.md R-F6. Sin texto encima (R-F1), así que la regla de pares de
// contraste no aplica. Valores tomados de paxfide-landing.html.

type Box = readonly [string, string, string];
type Alpha = (a: number) => string;

export interface WorldPalette {
  ground: string;
  meadows: readonly string[];
  sun: string; sunGlow: string; sunGlowEnd: string;
  moon: string; moonGlow: string; moonGlowEnd: string; starWhite: string; starGold: string;
  riverBank: string; riverWater: string; riverDeep: string; riverGlint: Alpha | null;
  crops: readonly (readonly [string, string])[];
  roadBase: string; roadSurface: string; roadDash: string;
  tuft: string; flowerStem: string; flowers: readonly string[]; flowerCenter: string; flowersVisible: boolean;
  firefly: string; firefliesVisible: boolean;
  shadow: Alpha; shadowSoft: number; shadowStrong: number;
  bushes: readonly string[]; bushHighlight: string;
  fincaWall: Box; fincaRoof: string; fincaRoofSide: string; fincaWindow: string;
  palmTrunk: string; palmLeaf: string; trunk: string; bloom: string; bloomShade: string;
  trees: readonly string[]; treeHighlight: string;
  skin: string; shirts: readonly string[];
  coinEdge: string; coinFace: string;
  beamNear: Alpha; beamMid: Alpha; beamEnd: string; headlights: boolean;
  chassis: Box; cab: Box; cabWindow: string; wheel: string;
  moto: Box; motoLight: string;
  crate: Box; crateStrap: string; qrLight: string; ink: string;
  chainLit: Box; chainOff: Box; chainLink: Alpha; merkleLine: Alpha; anchorBeam: Alpha; anchorBeamEnd: string; anchorGold: Box;
  terminal: Box; terminalScreen: string; heart: string;
  fund: Box; fundGlass: string;
  warehouseFloor: string; warehouseWall: Box; shelf: Box;
  house: Box; houseRoof: string; houseRoofSide: string; houseRoofBack: string; door: string; houseWindow: string;
  check: string; checkMark: string;
  cloudBase: string; cloudBody: string; cloudHighlight: string; cloudAlpha: number; cloudShadow: Alpha;
}

const SHARED = {
  sun: '#F9B829', sunGlow: '#F9B829', sunGlowEnd: 'rgba(249, 184, 41, 0)',
  moon: '#FDF4E2', moonGlow: '#8CC3DE', moonGlowEnd: 'rgba(140, 195, 222, 0)', starWhite: '#FFFFFF', starGold: '#F9B829',
  flowers: ['#FFFFFF', '#F9B829', '#F8CF7E', '#8CC3DE', '#FF8A80'], flowerCenter: '#F3B544', firefly: '#F3D544',
  shadow: (a: number) => `rgba(27, 81, 65, ${a})`,
  skin: '#7A5236', shirts: ['#2B84B7', '#F3B544', '#3BA756', '#1B5141', '#255E79'],
  coinEdge: '#C98A22', coinFace: '#F3B544',
  beamNear: (a: number) => `rgba(255, 245, 180, ${a})`, beamMid: (a: number) => `rgba(255, 235, 140, ${a})`, beamEnd: 'rgba(255, 235, 140, 0)',
  chassis: ['#E4EAE4', '#B8C4BE', '#CBD5D0'], cab: ['#4E9155', '#1B5141', '#20604C'], cabWindow: '#CDE7EE', wheel: '#22302B',
  moto: ['#2B84B7', '#1C5D85', '#226C98'],
  crate: ['#F8CF7E', '#D9962C', '#F3B544'], crateStrap: 'rgba(201, 138, 34, 0.8)', qrLight: '#FFFFFF', ink: '#1B5141',
  chainOff: ['#F4F6F2', '#D5DDD6', '#E4EAE4'], anchorBeamEnd: 'rgba(243, 181, 68, 0)', anchorGold: ['#FFE3A3', '#C98A22', '#F3B544'],
  terminal: ['#2B3A35', '#16211D', '#22302B'], terminalScreen: '#EEF6EF', heart: '#4E9155',
  fund: ['#5FA57A', '#1B5141', '#20604C'], fundGlass: 'rgba(255, 255, 255, 0.18)',
  warehouseWall: ['#F4F6F2', '#E9EEEA', '#DDE4DF'], shelf: ['#C79B5E', '#9C7340', '#B4884F'],
  house: ['#FFFFFF', '#F2F2EC', '#E1E6E0'], houseRoof: '#20604C', houseRoofSide: '#E1E6E0', houseRoofBack: '#2E7550', door: '#785008',
  check: '#4E9155', checkMark: '#FFFFFF',
} as const;

export const WORLD_DAY: WorldPalette = {
  ...SHARED,
  ground: '#7FBA72', meadows: ['#74B468', '#86C277', '#6CA85F', '#8EC780'],
  riverBank: '#BAC9A3', riverWater: '#4CA6CC', riverDeep: '#3990B6', riverGlint: (a) => `rgba(255, 255, 255, ${a})`,
  crops: [['#6FA45C', '#578546'], ['#74A862', '#5D8B4D'], ['#6BA057', '#558245'], ['#72A55F', '#5A864A']],
  roadBase: '#B8C8B5', roadSurface: '#CAD8C6', roadDash: '#F3B544',
  tuft: '#57A364', flowerStem: '#3E7D52', flowersVisible: true, firefliesVisible: false,
  shadowSoft: 0.08, shadowStrong: 0.12,
  bushes: ['#3BA756', '#2E8548', '#4DAE60', '#2B84B7'], bushHighlight: 'rgba(255, 255, 255, 0.22)',
  fincaWall: ['#FFFFFF', '#E6EAE4', '#F4F7F2'], fincaRoof: '#C85A32', fincaRoofSide: '#AA4925', fincaWindow: '#7CB0C6',
  palmTrunk: '#6A4622', palmLeaf: '#2D8249', trunk: '#785028', bloom: '#F9B829', bloomShade: '#D9962C',
  trees: ['#4E9155', '#3F8150', '#2E7550', '#63A266'], treeHighlight: 'rgba(255, 255, 255, 0.2)',
  headlights: false, motoLight: '#F3B544',
  chainLit: ['#8CC3DE', '#255E79', '#327DA2'],
  chainLink: (a) => `rgba(54, 136, 176, ${a})`, merkleLine: (a) => `rgba(50, 125, 162, ${a})`, anchorBeam: (a) => `rgba(243, 181, 68, ${a})`,
  warehouseFloor: '#E4EAE4', houseWindow: '#CDE7EE',
  cloudBase: '#C4DCD3', cloudBody: '#F6FAF7', cloudHighlight: '#FFFFFF', cloudAlpha: 0.95,
  cloudShadow: (a) => `rgba(18, 55, 36, ${a})`,
};

export const WORLD_NIGHT: WorldPalette = {
  ...SHARED,
  ground: '#0C2016', meadows: ['#0A1D14', '#0E2419', '#081710'],
  riverBank: '#13281E', riverWater: '#123A4D', riverDeep: '#0E2E3E', riverGlint: null,
  crops: [['#0D2117', '#132D20'], ['#0D2117', '#132D20'], ['#0D2117', '#132D20'], ['#0D2117', '#132D20']],
  roadBase: '#14251E', roadSurface: '#1C3229', roadDash: '#F8CF7E',
  tuft: '#244D3C', flowerStem: '#244D3C', flowersVisible: false, firefliesVisible: true,
  shadowSoft: 0.22, shadowStrong: 0.26,
  bushes: ['#14382A', '#112E22', '#1A4836', '#183540'], bushHighlight: 'rgba(255, 255, 255, 0.06)',
  fincaWall: ['#D0D5CF', '#9EA59D', '#B5BCB4'], fincaRoof: '#6E2C1A', fincaRoofSide: '#5A2214', fincaWindow: '#FFE3A3',
  palmTrunk: '#3B2918', palmLeaf: '#153828', trunk: '#3B2918', bloom: '#B38118', bloomShade: '#805A0E',
  trees: ['#133324', '#102B1F', '#184230', '#153629'], treeHighlight: 'rgba(255, 255, 255, 0.07)',
  headlights: true, motoLight: '#FFE3A3',
  chainLit: ['#56C8F5', '#164E63', '#0284C7'],
  chainLink: (a) => `rgba(56, 189, 248, ${a})`, merkleLine: (a) => `rgba(56, 189, 248, ${a})`, anchorBeam: (a) => `rgba(249, 184, 41, ${a})`,
  warehouseFloor: '#1C3028', houseWindow: '#FFE3A3',
  cloudBase: '#142C3D', cloudBody: '#224760', cloudHighlight: '#6EACD4', cloudAlpha: 0.86,
  cloudShadow: (a) => `rgba(18, 55, 36, ${a})`,
};

/** Paleta para la mezcla `night` (0 día, 1 noche): sigue el tema efectivo (C-1). */
export const worldPalette = (night: number): WorldPalette => (night > 0.5 ? WORLD_NIGHT : WORLD_DAY);
