import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authConfig } from '@/lib/auth.config'
import { isLoginBlocked, recordFailedLogin, recordSuccessfulLogin } from '@/lib/login-rate-limit'

// bcrypt's cost scales with input length; capping here keeps an oversized
// payload from tying up the server before it ever reaches bcrypt.compare.
const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(72),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      authorize: async (credentials) => {
        const parsed = credentialsSchema.safeParse(credentials)
        if (!parsed.success) return null
        const { email, password } = parsed.data

        if (isLoginBlocked(email)) return null

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user) {
          recordFailedLogin(email)
          return null
        }

        const valid = await bcrypt.compare(password, user.passwordHash)
        if (!valid) {
          recordFailedLogin(email)
          return null
        }

        recordSuccessfulLogin(email)
        return { id: user.id, email: user.email, role: user.role }
      },
    }),
  ],
})
