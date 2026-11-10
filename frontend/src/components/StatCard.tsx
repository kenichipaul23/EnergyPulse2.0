
type StatCardProps = {
  title: string
  value: string
  subtitle: string
  icon: string
  color: 'blue' | 'green' | 'amber' | 'purple'
}

const colorStyles = {
  blue: {
    background: 'bg-blue-50',
    icon: 'text-blue-600',
    border: 'border-l-blue-500',
  },
  green: {
    background: 'bg-green-50',
    icon: 'text-green-600',
    border: 'border-l-green-500',
  },
  amber: {
    background: 'bg-amber-50',
    icon: 'text-amber-600',
    border: 'border-l-amber-500',
  },
  purple: {
    background: 'bg-purple-50',
    icon: 'text-purple-600',
    border: 'border-l-purple-500',
  },
}

function StatCard({ title, value, subtitle, icon, color }: StatCardProps) {
  const style = colorStyles[color]

  return (
    <div className={`bg-white rounded-xl p-6 shadow-sm border border-slate-200 border-l-4 ${style.border}`}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">{title}</p>
        <span className={`text-xl ${style.icon} ${style.background} rounded-lg p-2`}>
          {icon}
        </span>
      </div>

      <h3 className="text-2xl font-bold text-slate-800">
        {value}
      </h3>

      <p className="text-xs text-slate-400 mt-2">
        {subtitle}
      </p>
    </div>
  )
}

export default StatCard
