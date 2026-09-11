'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormError } from '@/components/shared/FormError'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    const result = await signIn('credentials', { email, password, redirect: false })
    if (result?.error) {
      setError('Email ou mot de passe incorrect')
      setIsSubmitting(false)
      return
    }
    setSuccess(true)
    router.push('/map')
  }

  return (
    <div className="flex min-h-screen bg-card">
      {/* Left side - Form */}
      <div className="flex w-full flex-col justify-center px-8 sm:px-12 md:w-1/2 lg:w-1/3 xl:px-24">
        <div className="mx-auto w-full max-w-sm space-y-8">
          <div>
            <img src="/logo.png" alt="RNA" className="mx-auto h-14 w-auto" />
            <h2 className="mt-6 text-2xl font-semibold text-foreground">Bienvenue</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Veuillez entrer vos identifiants pour accéder au dashboard.
            </p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="font-medium text-foreground">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="font-medium text-foreground">Mot de passe</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-11" />
              </div>
            </div>
            
            <FormError>{error}</FormError>
            
            <Button
              type="submit"
              size="lg"
              className={`h-11 w-full text-base ${success ? 'bg-status-ok-text hover:bg-status-ok-text' : ''}`}
              disabled={isSubmitting}
            >
              {success ? 'Connexion réussie…' : 'Se connecter'}
            </Button>
          </form>
        </div>
      </div>
      
      {/* Right side - Decoration.

          This panel used to be `bg-primary`: Control Navy filling half the
          viewport, the most explicit breach of DESIGN.md's Rare Navy Rule
          ("It never fills a whole card or section"). Same copy, same layout,
          same proportions — the weight is inverted instead. The ground is now
          paper, and navy survives as a narrow accent bar and the heading color,
          which is all the rule allows it to be. The submit button on the left
          is now the only substantial navy on the screen, which is the point:
          its rarity is what makes it read as the action. */}
      <div className="hidden md:block md:w-1/2 lg:w-2/3">
        <div className="flex h-full items-center justify-center border-l border-border bg-background p-12 lg:p-24">
          <div className="w-full max-w-lg space-y-6 border-l-2 border-l-primary pl-6">
            <h2 className="text-2xl font-semibold leading-tight text-primary">
              Gérez votre parc en toute simplicité.
            </h2>
            <p className="text-sm text-muted-foreground">
              Plateforme centralisée pour suivre vos contrats, l&apos;état de vos infrastructures et vos clients en temps réel.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
