import { getServerCsrfToken } from '@/lib/get-server-csrf'
import LoginForm from './LoginForm'

export default function LoginPage() {
  return <LoginForm csrfToken={getServerCsrfToken()} />
}
