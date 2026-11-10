
const consumptionData = [
  { time: '6 AM', usage: 32 },
  { time: '7 AM', usage: 45 },
  { time: '8 AM', usage: 38 },
  { time: '9 AM', usage: 52 },
  { time: '10 AM', usage: 68 },
  { time: '11 AM', usage: 84 },
  { time: '12 PM', usage: 96 },
  { time: '1 PM', usage: 73 },
  { time: '2 PM', usage: 58 },
  { time: '3 PM', usage: 49 },
  { time: '4 PM', usage: 62 },
  { time: '5 PM', usage: 88 },
]

function ConsumptionChart() {
  return (
    <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
      <div className="flex flex-wrap justify-between items-start gap-3 mb-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">
            Energy Consumption Trend
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Hourly power usage (sample data)
          </p>
        </div>

        <span className="text-xs bg-blue-50 text-blue-700 px-3 py-2 rounded-lg">
          Today · Demo
        </span>
      </div>

      <div className="flex items-end gap-3 h-64 border-b border-slate-200 pb-2">
        {consumptionData.map((item) => {
          const color =
            item.usage >= 85
              ? 'bg-red-500'
              : item.usage >= 65
                ? 'bg-amber-400'
                : 'bg-blue-500'

          return (
            <div
              key={item.time}
              className="flex-1 h-full flex flex-col justify-end items-center gap-2"
            >
              <span className="text-xs text-slate-500">
                {item.usage}
              </span>

              <div
                className={`w-full max-w-10 rounded-t-md ${color}`}
                style={{ height: `${item.usage}%` }}
                title={`${item.usage} kWh`}
              />

              <span className="text-xs text-slate-400 whitespace-nowrap">
                {item.time}
              </span>
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-5 mt-6 text-xs text-slate-600">
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-blue-500" />
          Normal
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-amber-400" />
          High
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-red-500" />
          Peak
        </span>
      </div>
    </section>
  )
}

export default ConsumptionChart
