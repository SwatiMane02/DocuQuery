import { createFileRoute, redirect } from "@tanstack/react-router";
import { LoginPage } from "@/pages/login";
import { authStore } from "@/store/authStore";

export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    // If user is already logged in, redirect them to dashboard
    if (authStore.isAuthenticated()) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: LoginPage,
});
