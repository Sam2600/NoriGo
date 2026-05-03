export function getApiErrorMessage(error, fallback = 'Something went wrong.') {
  const errors = error.response?.data?.errors

  if (errors) {
    const firstKey = Object.keys(errors)[0]
    const firstMessage = errors[firstKey]?.[0]

    if (firstMessage) {
      return firstMessage
    }
  }

  return error.response?.data?.message || fallback
}
