import { useState } from 'react'
import { useStore } from 'zustand'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authStores } from '@/store/authStore'

interface LoginFormProps {
  instanceId: string
  onSwitchToRegister: () => void
}

export function LoginForm({ instanceId, onSwitchToRegister }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const authStore = authStores.get(instanceId)
  const login = useStore(authStore, (s) => s.login)
  const isLoading = useStore(authStore, (s) => s.isLoading)
  const error = useStore(authStore, (s) => s.error)
  const setError = useStore(authStore, (s) => s.setError)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    try {
      await login(email, password)
    } catch {
      // Error is handled in the store
    }
  }

  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="mb-8 text-center">
        <h1 className="text-xl font-semibold">Sign in to Redoubt</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter your credentials to continue
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
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
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <Button type="submit" variant="brand" className="w-full" disabled={isLoading}>
          {isLoading ? 'Signing in...' : 'Sign in'}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Don't have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="text-brand hover:text-brand-hover hover:underline"
          >
            Create one
          </button>
        </p>
      </form>
    </div>
  )
}
