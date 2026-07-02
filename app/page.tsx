export default function Home() {
  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10 text-slate-900">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow-sm">
        <p className="mb-2 text-sm font-medium text-blue-600">
          West Bay Surf Club
        </p>

        <h1 className="mb-4 text-3xl font-bold">
          西灣衝浪社內部系統
        </h1>

        <p className="mb-8 text-slate-600">
          這是給社員與幹部使用的內部網站。第一版會先完成社員登入、社員資料、公告、租板日期登記與後台管理。
        </p>

        <div className="grid gap-4">
          <div className="rounded-xl border border-slate-200 p-4">
            <h2 className="font-semibold">社員功能</h2>
            <p className="mt-1 text-sm text-slate-600">
              Google 登入、填寫基本資料、查看公告、登記租板日期。
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <h2 className="font-semibold">幹部功能</h2>
            <p className="mt-1 text-sm text-slate-600">
              新增、編輯、刪除公告，開放可租板日期。
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <h2 className="font-semibold">管理員功能</h2>
            <p className="mt-1 text-sm text-slate-600">
              管理社員等級：pending、member、officer、admin。
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}