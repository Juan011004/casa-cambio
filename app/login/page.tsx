import { cookies } from 'next/headers'
import { CSRF_COOKIE } from '@/lib/csrf'
import LoginForm from './LoginForm'

export default function LoginPage() {
  const csrfToken = cookies().get(CSRF_COOKIE)?.value ?? ''
  return <LoginForm csrfToken={csrfToken} />
}
