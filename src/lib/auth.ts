import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import TwitterProvider from "next-auth/providers/twitter"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

// NextAuthの型定義を拡張
declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            name?: string | null;
            email?: string | null;
            image?: string | null;
        }
    }
}

export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(prisma) as any,
    session: {
        strategy: "jwt",
    },
    pages: {
        signIn: "/login",
    },
    providers: [
        TwitterProvider({
            clientId: process.env.TWITTER_CLIENT_ID as string,
            clientSecret: process.env.TWITTER_CLIENT_SECRET as string,
            version: "2.0", // OAuth 2.0を使用
            authorization: {
                params: {
                    // tweet.write: ツイート投稿権限
                    // 将来の拡張分も一括取得 (dm.write, dm.read, space.read, block/mute, bookmark 等)
                    scope: "users.read tweet.read tweet.write dm.read dm.write space.read mute.read mute.write block.read block.write bookmark.read bookmark.write offline.access",
                },
            },
            allowDangerousEmailAccountLinking: true,
        }),
        CredentialsProvider({
            name: "メールアドレスとパスワード",
            credentials: {
                email: { label: "Email", type: "email", placeholder: "your@email.com" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error("メールアドレスとパスワードを入力してください")
                }

                const user = await prisma.user.findUnique({
                    where: { email: credentials.email }
                })

                if (!user || !user.password) {
                    throw new Error("ユーザーが存在しないか、パスワードが間違っています")
                }

                const isPasswordValid = await bcrypt.compare(credentials.password, user.password)

                if (!isPasswordValid) {
                    throw new Error("パスワードが間違っています")
                }

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                }
            }
        })
    ],
    callbacks: {
        async session({ session, token }) {
            if (token && session.user) {
                // @ts-ignore
                session.user.id = token.sub as string
            }
            return session
        },
        async jwt({ token, user }) {
            if (user) {
                token.sub = user.id
            }
            return token
        }
    }
}
