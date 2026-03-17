export function CardDropdown({ cards, selectedId, onChange }) {
    return (
        <select
            value={selectedId ?? ''}
            onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
            className="w-full px-4 py-2 bg-white dark:bg-gray-800 dark:border-gray-400 dark:text-gray-100 border-2 border-gray-900 rounded-xl text-sm font-bold mb-4 appearance-none"
        >
            <option value="">🗂️ Todas las tarjetas</option>
            {cards.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
            ))}
        </select>
    )
}