import { redirect } from "next/navigation";
import { isFeatureDisabled } from "@/lib/features";

// RELEASE_MODE=mvp(本番)では非表示。深いリンクで直接到達された場合もダッシュボードへ戻す。
export default function KpiLayout({ children }: { children: React.ReactNode }) {
    if (isFeatureDisabled("kpi")) redirect("/dashboard");
    return <>{children}</>;
}
