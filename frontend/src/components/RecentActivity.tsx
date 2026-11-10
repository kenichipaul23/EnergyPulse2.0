
const activities = [
  {
    title: 'Dataset Upload',
    description: 'Sample energy dataset uploaded',
    time: 'Today · 9:30 AM',
    status: 'success',
    label: 'Completed',
    icon: '↑',
  },
  {
    title: 'High Consumption Detected',
    description: 'Energy usage exceeded the demo threshold',
    time: 'Today · 11:45 AM',
    status: 'warning',
    label: 'Warning',
    icon: '⚡',
  },
  {
    title: 'Peak-Load Event',
    description: 'Illustrative critical demand event',
    time: 'Today · 12:00 PM',
    status: 'critical',
    label: 'Critical',
    icon: '!',
  },
  {
    title: 'System Status',
    description: 'EnergyPulse backend connection active',
    time: 'Today · 12:15 PM',
    status: 'info',
    label: 'Online',
    icon: '✓',
  },
]

const statusStyles = {
  success: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
}

function RecentActivity() {
  return (
    <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 mb-8">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-800">
          Recent Energy Activity
        </h3>
        <p className="text-sm text-slate-500 mt-1">
          Latest system and energy monitoring events
        </p>
      </div>

      <div className="space-y-4">
        {activities.map((activity, index) => (
          <div
            key={index}
            className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4 last:border-0 last:pb-0"
          >
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${statusStyles[activity.status as keyof typeof statusStyles]}`}>
                {activity.icon}
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-800">
                  {activity.title}
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  {activity.description}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {activity.time}
                </p>
              </div>
            </div>

            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusStyles[activity.status as keyof typeof statusStyles]}`}>
              {activity.label}
            </span>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400 mt-5">
        Illustrative sample activities. Actual records will come from the system.
      </p>
    </section>
  )
}

export default RecentActivity
