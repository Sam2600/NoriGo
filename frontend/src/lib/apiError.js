export function getApiErrorMessage(error, fallback = 'Something went wrong.') {
  const data = error?.response?.data
  const firstValidationMessage = data?.errors ? Object.values(data.errors).flat()[0] : null
  return firstValidationMessage || data?.message || fallback
}
