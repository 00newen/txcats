export type ActionErrorCode = 'UNAUTHORIZED' | 'NO_VAULT'

export type ActionFailure = {
  success: false
  code: ActionErrorCode
  error: string
}

export type ActionSuccess<T> = {
  success: true
  data: T
}

export type ActionResult<T> = ActionSuccess<T> | ActionFailure

export function ok<T>(data: T): ActionSuccess<T> {
  return { success: true, data }
}

export function fail(code: ActionErrorCode, error: string): ActionFailure {
  return { success: false, code, error }
}

export function unwrap<T>(result: ActionResult<T>): T {
  if (!result.success) {
    throw new Error(result.error)
  }

  return result.data
}
