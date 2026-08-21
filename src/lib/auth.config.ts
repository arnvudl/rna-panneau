import type { NextAuthConfig } from 'next-auth'

// Edge-safe config: no bcrypt/Prisma here, so this can be imported
// by middleware (which runs on the Edge runtime) without pulling in
// Node-only dependencies. The full config (with the Credentials
// provider's authorize callback) lives in `src/lib/auth.ts`.
export const authConfig = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        token.id = user.id
        token.role = (user as { role: string }).role
      }
      return token
    },
    session: ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as 'DEV' | 'ADMIN' | 'USER'
      }
      return session
    },
  },
} satisfies NextAuthConfig
