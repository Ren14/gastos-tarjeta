import { useProjection } from '../hooks/useProjection'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function MonthCard({ data, onClick }) {
    const sortedCards = [...data.by_card]
        .filter(c => c.total > 0)
        .sort((a, b) => b.total - a.total)

    const emptyCards = data.by_card.filter(c => c.total === 0)

    if (!data.has_data) {
        return (
            <div className="border-2 border-dashed border-gray-200 rounded-xl px-4 py-3 mb-3 opacity-60">
                <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-gray-400 uppercase tracking-wide">
            {MONTHS[data.month - 1]} {data.year}
          </span>
                    <span className="text-xs text-gray-400">Sin datos aún</span>
                </div>
            </div>
        )
    }

    return (
        <div
            onClick={() => onClick(data.month, data.year)}
            className="bg-white border border-gray-200 rounded-xl px-4 py-3 mb-3 cursor-pointer hover:border-gray-400 transition-colors"
        >
            <div className="flex justify-between items-center mb-3">
        <span className="text-sm font-bold uppercase tracking-wide">
          {MONTHS[data.month - 1]} {data.year}
        </span>
                <span className="text-lg font-bold text-red-600">
          ${data.total.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
        </span>
            </div>
            <div className="border-t border-gray-100 pt-2 flex flex-col gap-1">
                {sortedCards.map(c => (
                    <div key={c.card_id} className="flex justify-between text-xs">
                        <span className="text-gray-600">{c.card_name}</span>
                        <span className="font-semibold">
              ${c.total.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
            </span>
                    </div>
                ))}
                {emptyCards.map(c => (
                    <div key={c.card_id} className="flex justify-between text-xs">
                        <span className="text-gray-300">{c.card_name}</span>
                        <span className="text-gray-300">$0</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

export function Projection({ onNavigateToDashboard }) {
    const { projection, loading } = useProjection(6)

    if (loading) return <p className="text-center text-gray-400 py-8">Loading...</p>

    return (
        <div>
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                Projection — next 6 months
            </h2>
            {projection.map(data => (
                <MonthCard
                    key={`${data.month}-${data.year}`}
                    data={data}
                    onClick={onNavigateToDashboard}
                />
            ))}
        </div>
    )
}