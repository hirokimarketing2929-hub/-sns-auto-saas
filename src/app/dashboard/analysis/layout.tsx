import { redirect } from "next/navigation";
import { isFeatureDisabled } from "@/lib/features";

// RELEASE_MODE=mvp(本番)では非表示。深いリンクで直接到達された場合もダッシュボードへ戻す。
export default function AnalysisLayout({ children }: { children: React.ReactNode }) {
    if (isFeatureDisabled("analysis")) redirect("/dashboard");
    return <>{children}</>;
}
