import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline'

function ConfirmationModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = 'Confirm Action', 
  description = 'Are you sure you want to proceed? This action may be irreversible.',
  confirmText = 'Proceed',
  cancelText = 'Cancel',
  type = 'danger' 
}) {
  if (!isOpen) return null

  const isDanger = type === 'danger'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" 
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div className="relative w-full max-w-sm overflow-hidden rounded-[32px] bg-white p-8 shadow-2xl shadow-slate-950/40 ring-1 ring-slate-200 animate-in zoom-in-95 slide-in-from-bottom-8 duration-500 ease-out">
        <div className="flex flex-col items-center text-center">
          {/* Icon Header */}
          <div className={`mb-6 flex h-16 w-16 items-center justify-center rounded-2xl rotate-3 transition-transform hover:rotate-0 ${isDanger ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-200' : 'bg-teal-50 text-teal-600 ring-1 ring-teal-200'}`}>
            <ExclamationTriangleIcon className="h-8 w-8" />
          </div>
          
          <h3 className="text-2xl font-black tracking-tight text-slate-900 leading-tight">
            {title}
          </h3>
          <p className="mt-4 text-[13px] font-bold leading-relaxed text-slate-500">
            {description}
          </p>
        </div>

        {/* Actions */}
        <div className="mt-10 flex flex-col gap-3">
          <button
            type="button"
            className={`w-full rounded-2xl py-4 text-[11px] font-black uppercase tracking-[0.2em] transition-all active:scale-[0.98] ${
              isDanger 
                ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-xl shadow-rose-900/20' 
                : 'bg-teal-600 text-white hover:bg-teal-700 shadow-xl shadow-teal-900/20'
            }`}
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmText}
          </button>
          <button
            type="button"
            className="w-full rounded-2xl py-4 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all"
            onClick={onClose}
          >
            {cancelText}
          </button>
        </div>

        {/* Close Button */}
        <button 
          className="absolute right-6 top-6 rounded-full p-2 text-slate-300 hover:bg-slate-50 hover:text-slate-500 transition-colors"
          onClick={onClose}
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}

export default ConfirmationModal
