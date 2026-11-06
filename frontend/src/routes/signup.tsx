import { createFileRoute, redirect } from "@tanstack/react-router";
import { SignupPage } from "@/pages/signup";
import { authStore } from "@/store/authStore";

export const Route = createFileRoute("/signup")({
  beforeLoad: () => {
    // If user is already logged in, redirect them to dashboard
    if (authStore.isAuthenticated()) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: SignupPage,
});
