import { createFileRoute, redirect } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin-layout";
import { authStore } from "@/store/authStore";

export const Route = createFileRoute("/admin")({
  beforeLoad: ({ location }) => {
    // Check authentication
    if (!authStore.isAuthenticated()) {
      throw redirect({
        to: "/login",
        search: {
          redirect: location.href,
        },
      });
    }
    // Check admin role
    const user = authStore.getUser();
    if (user?.role !== "admin") {
      throw redirect({
        to: "/dashboard",
      });
    }
  },
  component: AdminLayout,
});
