"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
    const router = useRouter();
    // 招待リンク（/login?invite=XXX）から招待コードを初期値として読み取り、登録モードで開く。
    const initialInvite =
        typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("invite") || ""
            : "";

    const [isLogin, setIsLogin] = useState(!initialInvite);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [inviteCode, setInviteCode] = useState(initialInvite);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        if (isLogin) {
            // ログイン処理
            const result = await signIn("credentials", {
                redirect: false,
                email,
                password,
            });

            if (result?.error) {
                setError(result.error);
                setLoading(false);
            } else {
                router.push("/dashboard");
                router.refresh();
            }
        } else {
            // 新規登録処理
            try {
                const res = await fetch("/api/register", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password, name, inviteCode }),
                });

                const data = await res.json();

                if (res.ok) {
                    // 登録成功したらそのままログイン
                    await signIn("credentials", {
                        redirect: false,
                        email,
                        password,
                    });
                    router.push("/dashboard");
                    router.refresh();
                } else {
                    setError(data.message || "登録に失敗しました");
                    setLoading(false);
                }
            } catch (err) {
                setError("エラーが発生しました");
                setLoading(false);
            }
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12 px-4 sm:px-6 lg:px-8">
            <Card className="w-full max-w-md bg-slate-800/50 border-slate-700 backdrop-blur-sm">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl text-center font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                        ProX
                    </CardTitle>
                    <CardDescription className="text-center">
                        {isLogin ? "アカウントにログインしてください" : "新しいアカウントを作成します"}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {!isLogin && (
                            <div className="space-y-2">
                                <Label htmlFor="name">お名前</Label>
                                <Input
                                    id="name"
                                    placeholder="山田 太郎"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </div>
                        )}
                        {!isLogin && (
                            <div className="space-y-2">
                                <Label htmlFor="inviteCode">招待コード</Label>
                                <Input
                                    id="inviteCode"
                                    placeholder="クローズドβの招待コード"
                                    value={inviteCode}
                                    onChange={(e) => setInviteCode(e.target.value)}
                                />
                                <p className="text-xs text-slate-400">
                                    現在は招待制（クローズドβ）です。招待コードをお持ちの方のみご登録いただけます。
                                </p>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="email">メールアドレス</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="m@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">パスワード</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        {error && (
                            <div className="text-sm font-medium text-red-400 bg-red-900/30 p-3 rounded-md border border-red-800/50">
                                {error}
                            </div>
                        )}

                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? "処理中..." : isLogin ? "ログイン" : "アカウント作成"}
                        </Button>
                    </form>
                </CardContent>
                <CardFooter>
                    <Button
                        variant="link"
                        className="w-full text-sm text-slate-400 hover:text-slate-200"
                        onClick={() => {
                            setIsLogin(!isLogin);
                            setError("");
                        }}
                    >
                        {isLogin ? "初めての方はこちら（新規登録）" : "既にアカウントをお持ちの方（ログイン）"}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
