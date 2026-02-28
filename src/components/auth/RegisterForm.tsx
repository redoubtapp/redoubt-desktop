import { useState } from 'react'
import { useStore } from 'zustand'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authStores } from '@/store/authStore'
import { CheckCircle } from 'lucide-react'

interface RegisterFormProps {
  instanceId: string
  onSwitchToLogin: () => void
}

export function RegisterForm({ instanceId, onSwitchToLogin }: RegisterFormProps) {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const authStore = authStores.get(instanceId)
  const register = useStore(authStore, (s) => s.register)
  const isLoading = useStore(authStore, (s) => s.isLoading)
  const error = useStore(authStore, (s) => s.error)
  const setError = useStore(authStore, (s) => s.setError)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)

    try {
      const message = await register(email, username, password, inviteCode)
      setSuccessMessage(message)
    } catch {
      // Error is handled in the store
    }
  }

  if (successMessage) {
    return (
      <div className="mx-auto w-full max-w-sm text-center">
        <div className="mb-6">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-500/20">
            <CheckCircle className="h-7 w-7 text-green-500" />
          </div>
          <h1 className="text-xl font-semibold">Check your email</h1>
        </div>
        <p className="mb-6 text-sm text-muted-foreground">{successMessage}</p>
        <Button onClick={onSwitchToLogin} variant="secondary" className="w-full">
          Back to sign in
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="mb-8 text-center">
        <h1 className="text-xl font-semibold">Create an account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Join Redoubt to get started
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@example.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            maxLength={32}
            autoComplete="username"
            placeholder="Choose a username"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={12}
            autoComplete="new-password"
            placeholder="Min. 12 characters"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="invite">Invite Code</Label>
          <Input
            id="invite"
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            required
            placeholder="Enter your invite code"
          />
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <Button type="submit" variant="brand" className="w-full" disabled={isLoading}>
          {isLoading ? 'Creating account...' : 'Create account'}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-brand hover:text-brand-hover hover:underline"
          >
            Sign in
          </button>
        </p>
      </form>
    </div>
  )
}
