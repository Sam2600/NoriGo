function SubmitButton({
  children,
  className = 'primary-button',
  disabled = false,
  icon: Icon,
  isLoading = false,
  loadingText = 'Processing...',
  type = 'submit',
  ...props
}) {
  return (
    <button
      aria-busy={isLoading}
      className={className}
      disabled={disabled || isLoading}
      type={type}
      {...props}
    >
      {isLoading ? (
        <>
          <span
            aria-hidden="true"
            className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-white"
          />
          <span>{loadingText}</span>
        </>
      ) : (
        <>
          {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
          {children}
        </>
      )}
    </button>
  )
}

export default SubmitButton
