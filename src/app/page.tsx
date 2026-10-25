import { redirect } from "next/navigation";

// Root → redirect to owner dashboard
export default function RootPage() {
  redirect("/owner");
}
