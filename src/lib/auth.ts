import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import TwitterProvider from "next-auth/providers/twitter"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { cookies } from "next/headers"
import { getToken } from "next-auth/jwt"

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
                    // users.read / tweet.read / tweet.write: 投稿系
                    // dm.read / dm.write: 自動DM機能用
                    // offline.access: refresh_token 取得
                    // ※ X Developer Portal の User authentication settings で
                    //   "Read and write and Direct message" を有効化している必要あり
                    scope: "users.read tweet.read tweet.write dm.read dm.write offline.access",
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
        // 既にログイン中のユーザーが 2 つ目以降の X アカウントを連携するケースを処理する。
        // JWT セッション戦略では NextAuth の自動リンクが機能しないため、手動で Account 行を
        // 現在のセッションユーザーに紐付け、文字列 URL を返すことで OAuth の「セッション切替」
        // を中断し、既存セッションを維持したまま一覧画面へ戻す。
        async signIn({ user, account }) {
            if (!account || account.provider !== "twitter") return true

            // 現セッションの JWT を Cookie から取得（= 既にログイン中か判定）
            let existingUserId: string | undefined
            try {
                const cookieStore = await cookies()
                const req = {
                    cookies: Object.fromEntries(cookieStore.getAll().map(c => [c.name, c.value])),
                    headers: {},
                } as any
                const token = await getToken({
                    req,
                    secret: process.env.NEXTAUTH_SECRET,
                })
                existingUserId = token?.sub as string | undefined
            } catch (e) {
                // Cookie 取得に失敗 → 通常ログインとして扱う
                existingUserId = undefined
            }

            // 未ログイン状態での通常サインインは従来通り adapter に任せる
            if (!existingUserId) return true

            // 既存ユーザー自身を確認（存在しない token は無視）
            const existing = await prisma.user.findUnique({ where: { id: existingUserId } })
            if (!existing) return true

            // このアカウントが別ユーザーに既に紐付いていないかチェック
            const dup = await prisma.account.findUnique({
                where: {
                    provider_providerAccountId: {
                        provider: account.provider,
                        providerAccountId: account.providerAccountId,
                    },
                },
            })
            if (dup && dup.userId !== existingUserId) {
                // 他ユーザーに連携済みの X アカウント → 拒否
                return "/dashboard/settings?error=account_in_use"
            }

            // 現ユーザーへ Account を upsert（同じ X アカウントの再連携なら token を更新）
            await prisma.account.upsert({
                where: {
                    provider_providerAccountId: {
                        provider: account.provider,
                        providerAccountId: account.providerAccountId,
                    },
                },
                update: {
                    userId: existingUserId,
                    access_token: account.access_token ?? null,
                    refresh_token: account.refresh_token ?? null,
                    expires_at: account.expires_at ?? null,
                    token_type: account.token_type ?? null,
                    scope: account.scope ?? null,
                    id_token: account.id_token ?? null,
                    session_state: (account.session_state as string) ?? null,
                },
                create: {
                    userId: existingUserId,
                    type: account.type,
                    provider: account.provider,
                    providerAccountId: account.providerAccountId,
                    access_token: account.access_token ?? null,
                    refresh_token: account.refresh_token ?? null,
                    expires_at: account.expires_at ?? null,
                    token_type: account.token_type ?? null,
                    scope: account.scope ?? null,
                    id_token: account.id_token ?? null,
                    session_state: (account.session_state as string) ?? null,
                },
            })

            // 文字列を返すとサインインを中断してリダイレクト（= 既存セッション維持）
            return "/dashboard/settings?linked=1"
        },
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
