import { useCallback, useState } from "react";
import { useAuth } from "@/modules/core/hooks/useAuth";

export const useUserNavbar = () => {
  const { profile, logout } = useAuth();

  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);
  const [currency, setCurrency] = useState<"BS" | "USD">("BS");
  const [searchQuery, setSearchQuery] = useState("");

  const toggleSidebar = useCallback(() => {
    setIsSidebarExpanded((prev) => !prev);
  }, []);
  
  const handleLogout = async () => {
    setIsProfileOpen(false);
    await logout();
  };

  return {
    profile,
    isProfileOpen,
    isSidebarExpanded,
    toggleSidebar,
    setIsProfileOpen,
    isNotifOpen,
    setIsNotifOpen,
    isNotifModalOpen,
    setIsNotifModalOpen,
    currency,
    setCurrency,
    searchQuery,
    setSearchQuery,
    handleLogout,
  };
};
