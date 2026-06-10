import Link from "next/link";

const rounds = [
  {
    name: "32强",
    matches: [
      ["阿根廷", "日本"],
      ["法国", "巴西"],
      ["美国", "摩洛哥"],
      ["英格兰", "韩国"],
      ["西班牙", "加拿大"],
      ["葡萄牙", "墨西哥"],
      ["德国", "乌拉圭"],
      ["荷兰", "澳大利亚"],
    ],
  },
  {
    name: "16强",
    matches: [
      ["阿根廷", "巴西"],
      ["美国", "英格兰"],
      ["西班牙", "葡萄牙"],
      ["德国", "荷兰"],
    ],
  },
  {
    name: "8强",
    matches: [
      ["阿根廷", "英格兰"],
      ["葡萄牙", "荷兰"],
    ],
  },
  {
    name: "4强",
    matches: [["阿根廷", "葡萄牙"]],
  },
  {
    name: "决赛",
    matches: [["阿根廷", "法国"]],
  },
  {
    name: "冠军",
    matches: [["阿根廷", ""]],
  },
];

export default function BracketPage() {
  return (
    <main className="min-h-screen bg-[#f6f3ec] px-4 py-6 text-[#1f2933]">
      <section className="mx-auto w-full max-w-6xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase text-[#d64545]">
              Knockout Bracket
            </p>
            <h1 className="mt-2 text-3xl font-black text-[#102a43]">
              世界杯晋级之路
            </h1>
          </div>
          <Link
            href="/"
            className="rounded-md border border-[#cbd2d9] bg-white px-3 py-2 text-sm font-semibold text-[#334e68]"
          >
            首页
          </Link>
        </div>

        <div className="overflow-x-auto pb-4">
          <div className="grid min-w-[980px] grid-cols-6 gap-4">
            {rounds.map((round) => (
              <section key={round.name} className="min-w-0">
                <h2 className="mb-3 text-center text-sm font-black text-[#102a43]">
                  {round.name}
                </h2>
                <div className="flex min-h-[620px] flex-col justify-around gap-4">
                  {round.matches.map(([homeTeam, awayTeam], index) => (
                    <article
                      key={`${round.name}-${homeTeam}-${awayTeam}-${index}`}
                      className="rounded-lg border border-[#d9e2ec] bg-white p-3 shadow-sm"
                    >
                      <div className="flex h-10 items-center border-b border-[#edf2f7] text-sm font-semibold text-[#102a43]">
                        {homeTeam}
                      </div>
                      <div className="flex h-10 items-center text-sm font-semibold text-[#102a43]">
                        {awayTeam || "待定"}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
