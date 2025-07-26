import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface SupplementInfoModalProps {
  dsldId: string;
  open: boolean;
  onClose: () => void;
}

export function SupplementInfoModal({ dsldId, open, onClose }: SupplementInfoModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState<any>(null);

  useEffect(() => {
    if (!open || !dsldId) return;
    setLoading(true);
    setError(null);
    setLabel(null);
    fetch(`https://api.ods.od.nih.gov/dsld/v9/label/${dsldId}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch label');
        return res.json();
      })
      .then(data => setLabel(data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [dsldId, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-lg w-full relative" onClick={e => e.stopPropagation()}>
        <button className="absolute top-2 right-2 text-gray-500 hover:text-red-600 text-2xl font-bold" onClick={onClose}>×</button>
        <h2 className="text-xl font-bold mb-2">Supplement Info</h2>
        {loading && <div className="text-blue-600">Loading...</div>}
        {error && <div className="text-red-600">{error}</div>}
        {label && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {label.thumbnail ? (
                <img src={label.thumbnail} alt={label.fullName} className="w-16 h-16 rounded object-cover border" />
              ) : (
                <div className="w-16 h-16 rounded bg-gray-200 flex items-center justify-center text-gray-400 border">?</div>
              )}
              <div>
                <div className="font-semibold text-lg">{label.fullName}</div>
                {label.brandName && <div className="text-gray-500 text-sm">{label.brandName}</div>}
                {label.upcSku && <div className="text-xs text-gray-400">UPC: {label.upcSku}</div>}
              </div>
            </div>
            {label.netContents && label.netContents.length > 0 && (
              <div className="text-sm text-gray-700">Net Contents: {label.netContents.map((nc: any) => `${nc.quantity} ${nc.unit}`).join(', ')}</div>
            )}
            {label.servingSizes && label.servingSizes.length > 0 && (
              <div className="text-sm text-gray-700">Serving Size: {label.servingSizes.map((ss: any) => `${ss.minQuantity || ''}${ss.unit || ''}`).join(', ')}</div>
            )}
            {label.ingredientRows && label.ingredientRows.length > 0 && (
              <div>
                <div className="font-semibold mb-1">Ingredients:</div>
                <ul className="list-disc list-inside text-sm text-gray-700">
                  {label.ingredientRows.map((row: any, idx: number) => (
                    <li key={idx}>{row.name}{row.quantity && row.quantity.length > 0 ? `: ${row.quantity.map((q: any) => `${q.quantity}${q.unit || ''}`).join(', ')}` : ''}</li>
                  ))}
                </ul>
              </div>
            )}
            {label.otheringredients && label.otheringredients.text && (
              <div className="text-sm text-gray-700">Other Ingredients: {label.otheringredients.text}</div>
            )}
            {label.pdf && (
              <div className="mt-2"><a href={label.pdf} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">View Label PDF</a></div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 