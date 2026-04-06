import { redirect } from "next/navigation";

export default function Home() {
  // アクセスされたら自動的にログイン画面へリダイレクトします
  redirect("/login");
}
