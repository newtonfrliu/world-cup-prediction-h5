import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type SquadPlayer = {
  country: string;
  player_name: string;
  player_name_en?: string;
  name_on_shirt?: string;
};

type SquadsFile = {
  players: SquadPlayer[];
};

type PlayerNameZhMap = Record<string, Record<string, string>>;

const squadsPath = path.join(process.cwd(), "data", "fifa-2026-squads.json");
const zhMapPath = path.join(process.cwd(), "data", "player-name-zh-map.json");

const syllables: Record<string, string> = {
  A: "阿",
  AB: "阿布",
  ABD: "阿卜德",
  ABDUL: "阿卜杜勒",
  ACE: "阿塞",
  ACH: "阿赫",
  AD: "阿德",
  ADR: "阿德里",
  AH: "阿赫",
  AI: "艾",
  AK: "阿克",
  AL: "阿尔",
  ALE: "阿莱",
  ALEX: "亚历克斯",
  AM: "阿姆",
  AN: "安",
  AND: "安德",
  ANDER: "安德尔",
  ANDRE: "安德烈",
  ANTO: "安托",
  ANTON: "安东",
  AR: "阿尔",
  ARM: "阿姆",
  AU: "奥",
  AUR: "奥雷",
  AY: "艾",
  BA: "巴",
  BAL: "巴尔",
  BAR: "巴尔",
  BE: "贝",
  BEN: "本",
  BER: "贝尔",
  BERN: "贝恩",
  BI: "比",
  BO: "博",
  BRA: "布拉",
  BRE: "布雷",
  BRO: "布罗",
  BRU: "布鲁",
  BU: "布",
  CA: "卡",
  CAR: "卡尔",
  CAS: "卡斯",
  CE: "塞",
  CHA: "查",
  CHE: "切",
  CHI: "奇",
  CHO: "乔",
  CHRIS: "克里斯",
  CI: "西",
  CLA: "克拉",
  CLE: "克莱",
  CO: "科",
  COL: "科尔",
  CON: "孔",
  CRIS: "克里斯",
  CU: "库",
  DA: "达",
  DAN: "丹",
  DAR: "达尔",
  DE: "德",
  DEL: "德尔",
  DEM: "登",
  DEN: "登",
  DI: "迪",
  DIA: "迪亚",
  DIE: "迭",
  DJ: "吉",
  DO: "多",
  DOM: "多姆",
  DON: "东",
  DOS: "多斯",
  DU: "杜",
  EA: "埃",
  ED: "埃德",
  EDE: "埃德",
  EL: "埃尔",
  EM: "埃姆",
  EN: "恩",
  ER: "埃尔",
  ET: "埃特",
  EU: "尤",
  FA: "法",
  FAB: "法布",
  FE: "费",
  FEL: "费利",
  FER: "费尔",
  FI: "菲",
  FLO: "弗洛",
  FO: "福",
  FRA: "弗拉",
  FRAN: "弗朗",
  FRE: "弗雷",
  FU: "富",
  GA: "加",
  GAB: "加布",
  GAR: "加尔",
  GE: "热",
  GEO: "乔",
  GHA: "加",
  GI: "吉",
  GIO: "乔",
  GO: "戈",
  GON: "贡",
  GOR: "戈尔",
  GRA: "格拉",
  GRE: "格雷",
  GUE: "盖",
  GUI: "吉",
  HA: "哈",
  HAD: "哈德",
  HAM: "哈姆",
  HAN: "汉",
  HAR: "哈",
  HE: "赫",
  HEN: "亨",
  HER: "埃尔",
  HI: "希",
  HO: "霍",
  HOU: "胡",
  HU: "胡",
  IB: "伊布",
  IG: "伊格",
  IL: "伊尔",
  IN: "因",
  IS: "伊斯",
  ISA: "伊萨",
  JA: "贾",
  JAC: "雅克",
  JAM: "贾姆",
  JAN: "扬",
  JE: "杰",
  JER: "杰尔",
  JO: "若",
  JON: "乔纳",
  JOR: "乔尔",
  JOS: "若斯",
  JU: "朱",
  JUL: "胡利",
  KA: "卡",
  KAR: "卡尔",
  KE: "凯",
  KEN: "肯",
  KHA: "哈",
  KHO: "霍",
  KI: "基",
  KO: "科",
  KON: "孔",
  KU: "库",
  KY: "凯",
  LA: "拉",
  LAM: "拉姆",
  LAN: "朗",
  LAU: "劳",
  LE: "勒",
  LEO: "莱奥",
  LI: "利",
  LIS: "利斯",
  LO: "洛",
  LOU: "路",
  LU: "卢",
  LUC: "卢卡",
  LUIS: "路易斯",
  MA: "马",
  MAG: "马格",
  MAL: "马尔",
  MAN: "曼",
  MAR: "马尔",
  MAT: "马特",
  MAX: "马克斯",
  MB: "姆巴",
  ME: "梅",
  MEM: "孟",
  MI: "米",
  MIG: "米格",
  MO: "莫",
  MOR: "莫尔",
  MU: "穆",
  NA: "纳",
  NAS: "纳斯",
  NE: "内",
  NEL: "内尔",
  NI: "尼",
  NIC: "尼克",
  NO: "诺",
  NU: "努",
  OA: "奥",
  OC: "奥克",
  OL: "奥尔",
  OM: "奥姆",
  ON: "昂",
  OS: "奥斯",
  OU: "乌",
  PA: "帕",
  PAL: "帕尔",
  PAR: "帕尔",
  PAT: "帕特",
  PE: "佩",
  PED: "佩德",
  PER: "佩尔",
  PHI: "菲",
  PI: "皮",
  PO: "波",
  PRI: "普里",
  QA: "卡",
  QU: "夸",
  RA: "拉",
  RAF: "拉斐",
  RAH: "拉赫",
  RAM: "拉姆",
  RAN: "兰",
  RAU: "劳",
  RE: "雷",
  REN: "雷纳",
  RI: "里",
  RIC: "里克",
  RO: "罗",
  ROD: "罗德",
  ROM: "罗姆",
  RUB: "鲁本",
  RU: "鲁",
  SA: "萨",
  SAM: "萨姆",
  SAN: "桑",
  SE: "塞",
  SEN: "森",
  SER: "塞尔",
  SHA: "沙",
  SHE: "谢",
  SI: "西",
  SID: "西德",
  SIL: "席尔",
  SO: "索",
  SOL: "索尔",
  STE: "斯特",
  SU: "苏",
  TA: "塔",
  TAH: "塔",
  TAN: "坦",
  TE: "特",
  THE: "特",
  THI: "蒂",
  TI: "蒂",
  TO: "托",
  TOM: "托姆",
  TRE: "特雷",
  TU: "图",
  UM: "乌姆",
  US: "乌斯",
  VA: "瓦",
  VAL: "瓦尔",
  VAN: "范",
  VE: "维",
  VIC: "维克",
  VIN: "维尼",
  VIR: "维尔",
  WA: "瓦",
  WAL: "瓦尔",
  WAR: "瓦尔",
  WE: "韦",
  WI: "威",
  WIL: "威尔",
  WO: "沃",
  YA: "亚",
  YAH: "亚赫",
  YO: "约",
  YOU: "尤",
  ZA: "扎",
  ZAI: "扎伊",
  ZE: "泽",
  ZI: "齐",
};

const letters: Record<string, string> = {
  A: "阿",
  B: "布",
  C: "克",
  D: "德",
  E: "埃",
  F: "夫",
  G: "格",
  H: "赫",
  I: "伊",
  J: "杰",
  K: "克",
  L: "勒",
  M: "姆",
  N: "恩",
  O: "奥",
  P: "普",
  Q: "库",
  R: "尔",
  S: "斯",
  T: "特",
  U: "乌",
  V: "维",
  W: "沃",
  X: "克斯",
  Y: "伊",
  Z: "兹",
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function transliterateToken(token: string) {
  let rest = token;
  let output = "";
  const keys = Object.keys(syllables).sort((a, b) => b.length - a.length);

  while (rest.length > 0) {
    const matched = keys.find((key) => rest.startsWith(key));

    if (matched) {
      output += syllables[matched];
      rest = rest.slice(matched.length);
      continue;
    }

    output += letters[rest[0]] ?? "";
    rest = rest.slice(1);
  }

  return output;
}

function transliterateName(name: string) {
  const normalized = normalize(name);

  if (!normalized) {
    return "未命名球员";
  }

  return normalized
    .split(" ")
    .filter(Boolean)
    .map(transliterateToken)
    .join("·");
}

const squads = JSON.parse(readFileSync(squadsPath, "utf8")) as SquadsFile;
const zhMap = JSON.parse(readFileSync(zhMapPath, "utf8")) as PlayerNameZhMap;

for (const player of squads.players) {
  const officialName = player.player_name_en ?? player.player_name;
  zhMap[player.country] ??= {};

  if (!zhMap[player.country][officialName]) {
    zhMap[player.country][officialName] = transliterateName(officialName);
  }
}

const sortedMap: PlayerNameZhMap = {};
for (const country of Object.keys(zhMap).sort((a, b) => a.localeCompare(b))) {
  sortedMap[country] = {};
  for (const key of Object.keys(zhMap[country]).sort((a, b) =>
    a.localeCompare(b),
  )) {
    sortedMap[country][key] = zhMap[country][key];
  }
}

writeFileSync(zhMapPath, `${JSON.stringify(sortedMap, null, 2)}\n`, "utf8");

const totalPlayers = squads.players.length;
const totalMapped = squads.players.filter((player) => {
  const officialName = player.player_name_en ?? player.player_name;
  return Boolean(sortedMap[player.country]?.[officialName]);
}).length;

console.log(`total players = ${totalPlayers}`);
console.log(`mapped = ${totalMapped}`);
console.log(`missing = ${totalPlayers - totalMapped}`);

