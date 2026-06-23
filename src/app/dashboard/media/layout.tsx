import { redirect } from "next/navigation";
import { isFeatureDisabled } from "@/lib/features";

// RELEASE_MODE=mvp(本番)では非表示。深いリンクで直接到達された場合もダッシュボードへ戻す。
export default function MediaLayout({ children }: { children: React.ReactNode }) {
    if (isFeatureDisabled("media")) redirect("/dashboard");
    return <>{children}</>;
}
