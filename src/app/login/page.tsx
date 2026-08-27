'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
    <div className="flex min-h-screen bg-white">
      {/* Left side - Form */}
      <div className="flex w-full flex-col justify-center px-8 sm:px-12 md:w-1/2 lg:w-1/3 xl:px-24">
        <div className="mx-auto w-full max-w-sm space-y-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary">RNA</h1>
            <h2 className="mt-6 text-2xl font-semibold text-slate-900">Bienvenue</h2>
            <p className="mt-2 text-sm text-slate-500">
              Veuillez entrer vos identifiants pour accéder au dashboard.
            </p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="font-medium text-slate-700">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-11 shadow-sm" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="font-medium text-slate-700">Mot de passe</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-11 shadow-sm" />
              </div>
            </div>
            
            {error && <p className="text-sm font-medium text-red-600">{error}</p>}
            
            <Button
              type="submit"
              size="lg"
              className={`h-11 w-full text-base ${success ? 'bg-emerald-600 hover:bg-emerald-600' : ''}`}
              disabled={isSubmitting}
            >
              {success ? 'Connexion réussie…' : 'Se connecter'}
            </Button>
          </form>
        </div>
      </div>
      
      {/* Right side - Decoration */}
      <div className="hidden md:block md:w-1/2 lg:w-2/3">
        <div className="flex h-full items-center justify-center bg-primary p-12 lg:p-24">
          <div className="w-full max-w-lg space-y-6 text-white">
            <h2 className="text-4xl font-bold leading-tight">
              Gérez votre parc en toute simplicité.
            </h2>
            <p className="text-lg text-primary-foreground/80">
              Plateforme centralisée pour suivre vos contrats, l'état de vos infrastructures et vos clients en temps réel.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
