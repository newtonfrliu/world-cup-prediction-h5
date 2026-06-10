export const teamMeta: Record<string, { cn: string; flag: string }> = {
  Algeria: {
    cn: "阿尔及利亚",
    flag: "🇩🇿",
  },
  Argentina: {
    cn: "阿根廷",
    flag: "🇦🇷",
  },
  Australia: {
    cn: "澳大利亚",
    flag: "🇦🇺",
  },
  Austria: {
    cn: "奥地利",
    flag: "🇦🇹",
  },
  Belgium: {
    cn: "比利时",
    flag: "🇧🇪",
  },
  "Bosnia & Herzegovina": {
    cn: "波黑",
    flag: "🇧🇦",
  },
  Brazil: {
    cn: "巴西",
    flag: "🇧🇷",
  },
  Canada: {
    cn: "加拿大",
    flag: "🇨🇦",
  },
  "Cape Verde": {
    cn: "佛得角",
    flag: "🇨🇻",
  },
  Colombia: {
    cn: "哥伦比亚",
    flag: "🇨🇴",
  },
  Croatia: {
    cn: "克罗地亚",
    flag: "🇭🇷",
  },
  Curacao: {
    cn: "库拉索",
    flag: "🇨🇼",
  },
  "Curaçao": {
    cn: "库拉索",
    flag: "🇨🇼",
  },
  "Czech Republic": {
    cn: "捷克",
    flag: "🇨🇿",
  },
  "DR Congo": {
    cn: "刚果民主共和国",
    flag: "🇨🇩",
  },
  Ecuador: {
    cn: "厄瓜多尔",
    flag: "🇪🇨",
  },
  Egypt: {
    cn: "埃及",
    flag: "🇪🇬",
  },
  England: {
    cn: "英格兰",
    flag: "🏴",
  },
  France: {
    cn: "法国",
    flag: "🇫🇷",
  },
  Germany: {
    cn: "德国",
    flag: "🇩🇪",
  },
  Ghana: {
    cn: "加纳",
    flag: "🇬🇭",
  },
  Haiti: {
    cn: "海地",
    flag: "🇭🇹",
  },
  Iran: {
    cn: "伊朗",
    flag: "🇮🇷",
  },
  Iraq: {
    cn: "伊拉克",
    flag: "🇮🇶",
  },
  "Ivory Coast": {
    cn: "科特迪瓦",
    flag: "🇨🇮",
  },
  Japan: {
    cn: "日本",
    flag: "🇯🇵",
  },
  Jordan: {
    cn: "约旦",
    flag: "🇯🇴",
  },
  Mexico: {
    cn: "墨西哥",
    flag: "🇲🇽",
  },
  Morocco: {
    cn: "摩洛哥",
    flag: "🇲🇦",
  },
  Netherlands: {
    cn: "荷兰",
    flag: "🇳🇱",
  },
  "New Zealand": {
    cn: "新西兰",
    flag: "🇳🇿",
  },
  Norway: {
    cn: "挪威",
    flag: "🇳🇴",
  },
  Panama: {
    cn: "巴拿马",
    flag: "🇵🇦",
  },
  Paraguay: {
    cn: "巴拉圭",
    flag: "🇵🇾",
  },
  Portugal: {
    cn: "葡萄牙",
    flag: "🇵🇹",
  },
  Qatar: {
    cn: "卡塔尔",
    flag: "🇶🇦",
  },
  "Saudi Arabia": {
    cn: "沙特阿拉伯",
    flag: "🇸🇦",
  },
  Scotland: {
    cn: "苏格兰",
    flag: "🏴",
  },
  Senegal: {
    cn: "塞内加尔",
    flag: "🇸🇳",
  },
  "South Africa": {
    cn: "南非",
    flag: "🇿🇦",
  },
  "South Korea": {
    cn: "韩国",
    flag: "🇰🇷",
  },
  Spain: {
    cn: "西班牙",
    flag: "🇪🇸",
  },
  Sweden: {
    cn: "瑞典",
    flag: "🇸🇪",
  },
  Switzerland: {
    cn: "瑞士",
    flag: "🇨🇭",
  },
  Tunisia: {
    cn: "突尼斯",
    flag: "🇹🇳",
  },
  Turkey: {
    cn: "土耳其",
    flag: "🇹🇷",
  },
  Uruguay: {
    cn: "乌拉圭",
    flag: "🇺🇾",
  },
  USA: {
    cn: "美国",
    flag: "🇺🇸",
  },
  Uzbekistan: {
    cn: "乌兹别克斯坦",
    flag: "🇺🇿",
  },
};

export function getTeamDisplayName(team: string): string {
  const meta = teamMeta[team];

  if (!meta) {
    return team;
  }

  return `${meta.flag} ${meta.cn}`;
}

export const worldCupTeams = [
  "USA",
  "Mexico",
  "South Africa",
  "South Korea",
  "Czech Republic",
  "Canada",
  "Bosnia & Herzegovina",
  "Paraguay",
  "Haiti",
  "Scotland",
  "Australia",
  "Turkey",
  "Brazil",
  "Morocco",
  "Qatar",
  "Switzerland",
  "Ivory Coast",
  "Ecuador",
  "Germany",
  "Curacao",
  "Netherlands",
  "Japan",
  "Sweden",
  "Tunisia",
  "Saudi Arabia",
  "Uruguay",
  "Spain",
  "Cape Verde",
  "Iran",
  "New Zealand",
  "Belgium",
  "Egypt",
  "France",
  "Senegal",
  "Iraq",
  "Norway",
  "Argentina",
  "Algeria",
  "Austria",
  "Jordan",
  "Ghana",
  "Panama",
  "England",
  "Croatia",
  "Portugal",
  "DR Congo",
  "Uzbekistan",
  "Colombia",
];
