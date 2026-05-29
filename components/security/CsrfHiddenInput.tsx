import { CSRF_FORM_FIELD } from '@/lib/csrf'

type Props = {
  token: string
}

export function CsrfHiddenInput({ token }: Props) {
  if (!token) return null
  return <input type="hidden" name={CSRF_FORM_FIELD} value={token} autoComplete="off" readOnly />
}
