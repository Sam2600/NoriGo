function SubmitButton({ children, icon: Icon, isLoading, loadingText = 'Saving...', className = 'primary-button', ...props }) {
  return (
    <button className={className} type="submit" disabled={isLoading || props.disabled} {...props}>
      {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
      {isLoading ? loadingText : children}
    </button>
  )
}

export default SubmitButton
