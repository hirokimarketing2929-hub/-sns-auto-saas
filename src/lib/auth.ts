import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import TwitterProvider from "next-auth/providers/twitter"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { cookies } from "next/headers"
import { getToken } from "next-auth/jwt"
import { encryptSecret } from "@/lib/crypto"
import { isLoginLockedOut, recordLoginFailure, clearLoginFailures } from "@/lib/rate-limit"
import type { Adapter, AdapterAccount } from "next-auth/adapters"

/**
 * PrismaAdapter をラップし、linkAccount（新規ユーザーの初回 OAuth サインインで
 * NextAuth が直接 Account を書込む経路）でも OAuth トークンを AES-256-GCM で
 * 暗号化してから保存する。
 *
 * 背景: signIn callback は「既ログイン中ユーザーの 2 つ目以降の連携」だけを
 * 手動 upsert（暗号化済み）で処理し、未ログインの初回サインインは
 * `return true` で adapter に委譲する。素の PrismaAdapter.linkAccount は
 * access_token/refresh_token/id_token を平文のまま account.create するため、
 * 初回トークンだけが平文滞留していた（004 §C-1 の既知の穴）。
 * ここで linkAccount を差し替え、初回も他経路と同じ enc:v1: 形式で保存する。
 */
function encryptedPrismaAdapter(): Adapter {
    const base = PrismaAdapter(prisma) as Adapter
    const originalLinkAccount = base.linkAccount?.bind(base)
    return {
        ...base,
        linkAccount: originalLinkAccount
            ? (account: AdapterAccount) =>
                  originalLinkAccount({
                      ...account,
                      access_token: (encryptSecret(account.access_token) as string | undefined) ?? undefined,
                      refresh_token: (encryptSecret(account.refresh_token) as string | undefined) ?? undefined,
                      id_token: (encryptSecret(account.id_token) as string | undefined) ?? undefined,
                  })
            : base.linkAccount,
    }
}

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
    adapter: encryptedPrismaAdapter() as any,
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
                // NextAuth v4 の既定は旧 twitter.com ドメインで authorize URL を生成するが、
                // X では同意画面が x.com でないと描画されず真っ白になる。x.com に明示上書きする。
                url: "https://x.com/i/oauth2/authorize",
                params: {
                    // users.read / tweet.read / tweet.write: 投稿系
                    // like.read: 自動リプライの「いいね検出」(liking_users)に必須
                    // dm.write: 自動リプライのDM送信に必須（Xアプリ権限=Read and write and Direct message が前提）。
                    //   以前 dm.* で同意画面が真っ白になったが、主因は上の twitter.com→x.com ドメイン上書きで解消済み。
                    //   dm.read は送信に不要なので付与しない。
                    // offline.access: refresh_token 取得
                    scope: "users.read tweet.read tweet.write like.read dm.write offline.access",
                },
            },
            // RT-005: allowDangerousEmailAccountLinking は撤去（既定 false）。
            // この設定は「OAuth が返すメールが既存ユーザーと一致すれば本人確認なしで自動リンク」
            // する危険設定で、未検証メール経由のアカウント乗っ取り経路になっていた。
            // 既ログインユーザーの2つ目以降の連携は下の signIn callback（明示フロー）に一本化済み。
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

                // ログイン試行ロックアウト（RT-004）。連続失敗が続くアカウントは一定時間ロックし、
                // オンライン総当たりを構造的に止める。DB照会の前に判定して負荷も抑える。
                const lock = isLoginLockedOut(credentials.email)
                if (lock.locked) {
                    throw new Error(`試行回数が上限に達しました。約${Math.ceil(lock.retryAfterSec / 60)}分後に再試行してください。`)
                }

                const user = await prisma.user.findUnique({
                    where: { email: credentials.email }
                })

                if (!user || !user.password) {
                    // 存在しないユーザーへの試行も失敗としてカウント（user enumeration ＋ 総当たり抑止）。
                    recordLoginFailure(credentials.email)
                    throw new Error("ユーザーが存在しないか、パスワードが間違っています")
                }

                const isPasswordValid = await bcrypt.compare(credentials.password, user.password)

                if (!isPasswordValid) {
                    recordLoginFailure(credentials.email)
                    throw new Error("パスワードが間違っています")
                }

                // 成功したら失敗カウンタをリセット。
                clearLoginFailures(credentials.email)

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
            const upsertedAccount = await prisma.account.upsert({
                where: {
                    provider_providerAccountId: {
                        provider: account.provider,
                        providerAccountId: account.providerAccountId,
                    },
                },
                update: {
                    userId: existingUserId,
                    // OAuth トークンは at-rest 暗号化（AES-256-GCM）して保存する。
                    access_token: (encryptSecret(account.access_token) as string) ?? null,
                    refresh_token: (encryptSecret(account.refresh_token) as string) ?? null,
                    expires_at: account.expires_at ?? null,
                    token_type: account.token_type ?? null,
                    scope: account.scope ?? null,
                    id_token: (encryptSecret(account.id_token) as string) ?? null,
                    session_state: (account.session_state as string) ?? null,
                },
                create: {
                    userId: existingUserId,
                    type: account.type,
                    provider: account.provider,
                    providerAccountId: account.providerAccountId,
                    access_token: (encryptSecret(account.access_token) as string) ?? null,
                    refresh_token: (encryptSecret(account.refresh_token) as string) ?? null,
                    expires_at: account.expires_at ?? null,
                    token_type: account.token_type ?? null,
                    scope: account.scope ?? null,
                    id_token: (encryptSecret(account.id_token) as string) ?? null,
                    session_state: (account.session_state as string) ?? null,
                },
            })

            // 既存の XAccount にこの OAuth Account が紐付いていなければ、新規 XAccount を作成して紐付ける
            const existingX = await (prisma as any).xAccount.findUnique({
                where: { oauthAccountId: upsertedAccount.id },
            }).catch(() => null);
            if (!existingX) {
                const profileName = (user as any)?.name as string | undefined;
                const displayName = profileName ? `@${profileName.replace(/^@/, "")}` : "新規Xアカウント";
                const created = await (prisma as any).xAccount.create({
                    data: {
                        userId: existingUserId,
                        displayName,
                        oauthAccountId: upsertedAccount.id,
                        xUsername: profileName ?? null,
                        xProfileImageUrl: (user as any)?.image ?? null,
                    },
                });
                // 新規連携したアカウントを active に切替
                await prisma.user.update({
                    where: { id: existingUserId },
                    data: { activeXAccountId: created.id },
                }).catch(() => undefined);
            }

            // 文字列を返すとサインインを中断してリダイレクト（= 既存セッション維持）
            return "/dashboard/settings?linked=1#x-accounts"
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
