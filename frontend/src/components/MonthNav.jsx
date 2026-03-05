export function MonthNav({ month, year, onChange }) {
    const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
        'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

    function prev() {
        if (month === 1) onChange(12, year - 1)
        else onChange(month - 1, year)
    }

    function next() {
        if (month === 12) onChange(1, year + 1)
        else onChange(month + 1, year)
    }

    return (
        <div className="flex justify-between items-center px-4 py-3 bg-white border border-gray-200 rounded-xl mb-4">
            <button onClick={prev} className="text-gray-500 text-xl font-bold px-2">‹</button>
            <span className="font-bold text-sm tracking-wide uppercase">
        {MONTHS[month - 1]} {year}
      </span>
            <button onClick={next} className="text-gray-500 text-xl font-bold px-2">›</button>
        </div>
    )
}