import { createFileRoute, redirect } from "@tanstack/react-router";
import { UserLayout } from "@/components/user-layout";
import { authStore } from "@/store/authStore";

export const Route = createFileRoute("/_user")({
  beforeLoad: ({ location }) => {
    // If not authenticated, redirect to login page with requested redirect parameter
    if (!authStore.isAuthenticated()) {
      throw redirect({
        to: "/login",
        search: {
          redirect: location.href,
        },
      });
    }
  },
  component: UserLayout,
});
